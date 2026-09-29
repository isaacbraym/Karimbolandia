import { Level, TILE, type LevelData, type EnemySpawn, type PickupKind } from './level';
import { Fx, PK } from './fx';
import { Camera } from './camera';
import { Player } from './player';
import { Bullet, Grenade, type BulletOpts, type BulletKind } from './bullets';
import { Prop, pickLoot } from './props';
import { Pickup } from './pickups';
import type { Enemy, HurtInfo } from './enemies/enemy';
import { createEnemy } from './enemies';
import { Director } from './director';
import { audio as audioEngine, type SfxName } from '../core/audio';
import { clamp, rand, type Rect } from '../core/math';
import type { ControlState } from '../core/input';
import { WEAPON_ORDER, type WeaponId } from './weapons';
import { progress, saveProgress } from '../core/storage';
import { getArt } from '../art';
import { drawNomadIdle } from '../art/nomad';
import { Corpse } from './corpse';

export interface Stats {
  kills: number;
  deaths: number;
  damageTaken: number;
  dashes: number;
  shots: number;
  pitFalls: number;
  time: number;
}

export type MusicState = 'explore' | 'combat' | 'nomad' | 'nomadCombat' | 'boss1' | 'boss2' | 'boss3' | 'silence' | 'calm' | 'victory';

export interface Hooks {
  onRespawn?: () => void;
  onBanner?: (title: string, sub?: string, dur?: number) => void;
  onComplete?: () => void;
  onMusic?: (s: MusicState) => void;
  onHint?: (key: string) => void;
}

export interface Wreck {
  x: number;
  y: number;
  t: number;
}

export class World {
  data: LevelData;
  level: Level;
  fx = new Fx();
  camera = new Camera();
  player = new Player();
  director: Director;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  grenades: Grenade[] = [];
  pickups: Pickup[] = [];
  props: Prop[] = [];
  solidRects: Rect[] = [];
  solidsDirty = true;
  wrecks: Wreck[] = [];
  corpses: Corpse[] = [];
  lastCrumbleTime = -99;
  parkedNomad: { x: number; y: number; facing: 1 | -1; hp: number } | null = null;
  nomadLost = false;
  nomadUsed = false;

  time = 0;
  score = 0;
  tokens = 0;
  emblems = new Set<number>();
  secrets = new Set<number>();
  secretRooms = new Set<string>();
  destroyedProps = new Set<number>();
  killedEnemies = new Set<number>();
  collectedPickups = new Set<number>();
  stats: Stats = { kills: 0, deaths: 0, damageTaken: 0, dashes: 0, shots: 0, pitFalls: 0, time: 0 };
  hooks: Hooks = {};
  timers: { t: number; fn: () => void }[] = [];
  speedLines = 0;
  musicState: MusicState = 'explore';
  alarmOn = false;
  rollLevel = 0;
  finished = false;
  paused = false;
  timeScale = 1;
  checkpointIdx = -1;
  checkpointSnap: ReturnType<Player['snapshot']> | null = null;
  respawnRequested = false;
  invulnerable = false; // debug
  screenW = 640;
  screenH = 360;
  screenToWorldFn: ((sx: number, sy: number) => { x: number; y: number }) | null = null;
  readonly runId = Math.random();

  constructor(data: LevelData) {
    this.data = data;
    this.level = data.level;
    this.director = new Director(this);
    this.camera.bounds = { x: 0, y: 0, w: this.level.pxW, h: this.level.pxH };
    this.startRun();
  }

  // ------------------------------------------------------------------ ciclo
  startRun() {
    this.time = 0;
    this.score = 0;
    this.tokens = 0;
    this.emblems.clear();
    this.secrets.clear();
    this.secretRooms.clear();
    this.destroyedProps.clear();
    this.killedEnemies.clear();
    this.collectedPickups.clear();
    this.stats = { kills: 0, deaths: 0, damageTaken: 0, dashes: 0, shots: 0, pitFalls: 0, time: 0 };
    this.checkpointIdx = -1;
    this.checkpointSnap = null;
    this.nomadLost = false;
    this.nomadUsed = false;
    this.parkedNomad = null;
    this.finished = false;
    this.player.resetInventory();
    this.director.reset();
    this.populate(true);
    const s = this.data.playerStart;
    this.player.reset(s.x, s.y);
    this.cameraSnap();
    this.setMusic('explore');
  }

  /** Reconstrói as entidades a partir dos dados da fase, respeitando o que já foi feito. */
  populate(fresh: boolean) {
    this.enemies = [];
    this.bullets = [];
    this.grenades = [];
    this.pickups = [];
    this.props = [];
    this.corpses = [];
    this.wrecks = this.wrecks.filter(() => !fresh);
    this.fx.reset();
    this.timers = [];
    for (const s of this.data.enemies) {
      if (s.arena) continue;
      if (this.killedEnemies.has(s.id)) continue;
      this.enemies.push(createEnemy(s));
    }
    for (const p of this.data.props) {
      if (this.destroyedProps.has(p.id)) continue;
      this.props.push(new Prop(p));
    }
    for (const p of this.data.pickups) {
      if (this.collectedPickups.has(p.id)) continue;
      this.pickups.push(new Pickup(p.kind, p.x, p.y, p.id, p.itemId ?? 0));
    }
    this.solidsDirty = true;
  }

  restart() {
    this.startRun();
  }

  /** Volta ao último checkpoint mantendo progresso (inimigos mortos, itens, segredos). */
  respawn() {
    this.respawnRequested = false;
    const cp = this.checkpointIdx >= 0 ? this.data.checkpoints[this.checkpointIdx] : null;
    const sx = cp ? cp.x : this.data.playerStart.x;
    const sy = cp ? cp.y : this.data.playerStart.y;
    this.director.onRespawn();
    this.populate(false);
    this.director.afterPopulate();
    this.player.reset(sx, sy);
    if (this.checkpointSnap) {
      this.player.restore(this.checkpointSnap);
      // munição reposta parcialmente após morrer (perdão)
      for (const id of WEAPON_ORDER) {
        const have = this.player.weapons.get(id);
        if (have !== undefined && have !== Infinity) this.player.weapons.set(id, Math.max(have, Math.ceil(WEAPON_AMMO_FLOOR[id])));
      }
      this.player.grenades = Math.max(this.player.grenades, 3);
      if (this.checkpointSnap.nomad > 0) this.director.remountAtCheckpoint(this.checkpointSnap.nomad);
    }
    this.cameraSnap();
    this.fx.addFlash(0.7, '#000000');
    this.director.afterRespawn();
  }

  requestRespawn() {
    this.respawnRequested = true;
    this.hooks.onRespawn?.();
  }

  // ------------------------------------------------------------------ helpers de serviço
  audio(name: SfxName, vol = 1, x?: number) {
    let v = vol;
    let pan = 0;
    if (x !== undefined) {
      const cx = this.camera.x + this.camera.w / 2;
      const d = Math.abs(x - cx);
      v *= clamp(1.25 - d / 620, 0, 1);
      pan = clamp((x - cx) / (this.camera.w * 0.6), -0.8, 0.8);
      if (v < 0.03) return;
    }
    audioEngine.play(name, v, pan);
  }
  music(s: MusicState) {
    this.setMusic(s);
  }
  setMusic(s: MusicState) {
    if (this.musicState === s) return;
    this.musicState = s;
    this.hooks.onMusic?.(s);
  }
  setAlarm(on: boolean) {
    if (on === this.alarmOn) return;
    this.alarmOn = on;
    audioEngine.loop('alarm', on);
  }
  rollSound(level: number) {
    this.rollLevel = level;
    audioEngine.loop('roll', level > 0.05, level, 1);
  }
  after(delay: number, fn: () => void) {
    if (delay <= 0) fn();
    else this.timers.push({ t: delay, fn });
  }
  noteShot() {
    this.stats.shots++;
  }
  screenToWorld(sx: number, sy: number) {
    if (this.screenToWorldFn) return this.screenToWorldFn(sx, sy);
    return { x: this.camera.toWorldX(sx), y: this.camera.toWorldY(sy) };
  }
  cameraSnap() {
    const p = this.player;
    this.camera.lock = this.director.currentLock();
    this.camera.snapTo(p.x, p.y);
  }
  isSafeSpot(x: number, feetY: number) {
    const L = this.level;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(feetY / TILE);
    for (let dx = -1; dx <= 1; dx++) {
      if (L.get(tx + dx, ty) !== 1) return false; // chão sólido sob 3 tiles
      if (L.get(tx + dx, ty - 1) === 3) return false;
    }
    // não dentro de arena ainda fechada
    return !this.director.insideActiveArena(x) || this.director.arenaActiveContains(x);
  }
  /** Altura Y abaixo da qual o jogador "caiu no abismo" (arenas ativas usam um limite mais curto). */
  deathY() {
    const a = this.director.activeArenaRect();
    if (a) return Math.min(this.level.pxH + 60, a.y + a.h + 140);
    return this.level.pxH + 60;
  }
  progressDashDiscovered() {
    if (!progress.dashDiscovered) {
      progress.dashDiscovered = true;
      saveProgress();
    }
  }

  // ------------------------------------------------------------------ spawn de coisas
  spawnPlayerBullet(x: number, y: number, vx: number, vy: number, o: BulletOpts) {
    this.bullets.push(new Bullet(x, y, vx, vy, o));
  }
  spawnEnemyBullet(x: number, y: number, ang: number, speed: number, dmg: number, kind: BulletKind, extra: Partial<BulletOpts> = {}) {
    const o: BulletOpts = { kind, team: 1, dmg, life: extra.life ?? 3, r: extra.r ?? (kind === 'bossShell' ? 5 : 3), ...extra };
    if (kind === 'sniper') {
      o.r = 3;
      o.life = 1.4;
      o.color = '#ffffff';
      o.trail = '#ff5a5a';
    } else if (kind === 'orb') {
      o.color = extra.color ?? '#ff8ad4';
      o.trail = extra.trail ?? '#ff3fb4';
    } else if (kind === 'bossOrb') {
      o.color = extra.color ?? '#fff2a0';
      o.trail = extra.trail ?? '#ffb83a';
    } else if (kind === 'missile') {
      o.explode = extra.explode ?? { radius: 58, dmg: 30 };
      o.homing = extra.homing ?? 0;
      o.color = '#ffd27a';
      o.trail = '#ff8a3a';
      o.r = 5;
    } else {
      o.color = extra.color ?? '#ffe7a8';
      o.trail = extra.trail ?? '#ff5a4a';
    }
    this.bullets.push(new Bullet(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, o));
  }
  spawnDrop(kind: PickupKind, x: number, y: number) {
    if (this.pickups.length > 120) return;
    this.pickups.push(new Pickup(kind, x, y, -1, 0, true));
  }
  spawnEnemy(s: EnemySpawn): Enemy {
    const e = createEnemy(s);
    e.awake = true;
    e.spawnedByArena = !!s.arena;
    this.enemies.push(e);
    return e;
  }

  /** Explosão com dano em área. team: 0=do jogador (fere inimigos), 1=inimiga (fere jogador), 2=neutra (fere todos). */
  explode(x: number, y: number, radius: number, dmg: number, team: 0 | 1 | 2, o: { kb?: number; fromNomad?: boolean; big?: boolean; propsToo?: boolean; noProps?: boolean; silent?: boolean } = {}) {
    const size = radius * 0.5;
    if (!o.silent) {
      this.fx.explosion(x, y, size);
      this.audio(radius > 80 ? 'bigExplosion' : 'explosion', 1, x);
    }
    this.fx.addShake(clamp(radius / 14, 2, 9), 0.28);
    if (radius > 70) this.fx.addFlash(0.12, '#fff2d0');
    const kb = o.kb ?? 300;
    if (team === 0 || team === 2) {
      for (const e of this.enemies) {
        if (!e.alive || !e.canBeHit) continue;
        const hb = e.hitbox;
        const cx = clamp(x, hb.x, hb.x + hb.w);
        const cy = clamp(y, hb.y, hb.y + hb.h);
        const d = Math.hypot(cx - x, cy - y);
        if (d > radius) continue;
        const f = 1 - (d / radius) * 0.55;
        const dir = e.x >= x ? 1 : -1;
        e.hurt(this, Math.max(1, Math.round(dmg * f)), { kx: dir * kb * f, ky: -kb * 0.55 * f, x: e.x, y: e.y - 6, type: 'explosion', dir });
      }
    }
    if (!o.noProps) {
      for (const p of this.props) {
        if (!p.alive || !p.hittable) continue;
        const cx = clamp(x, p.x - p.w / 2, p.x + p.w / 2);
        const cy = clamp(y, p.y - p.h / 2, p.y + p.h / 2);
        if (Math.hypot(cx - x, cy - y) > radius) continue;
        p.hurt(this, dmg * 1.5, 'explosion', Math.sign(p.x - x));
      }
    }
    if (team === 1 || team === 2) {
      const pl = this.player;
      if (pl.targetable) {
        const hb = pl.hitbox;
        const cx = clamp(x, hb.x, hb.x + hb.w);
        const cy = clamp(y, hb.y, hb.y + hb.h);
        const d = Math.hypot(cx - x, cy - y);
        if (d <= radius) {
          const f = 1 - (d / radius) * 0.5;
          pl.hit(this, Math.max(4, Math.round(dmg * f)), pl.x >= x ? 1 : -1, { kx: kb * 0.5, ky: -300 });
        }
      }
    }
    // empurra granadas/pickups próximos
    for (const p of this.pickups) {
      if (!p.body) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius) {
        p.body.vx += ((p.x - x) / (d + 1)) * 200;
        p.body.vy -= 160;
      }
    }
  }

  dropLoot(p: Prop) {
    const kind = pickLoot(p.loot, new Set(this.player.weapons.keys()));
    const x = p.x;
    const y = p.y;
    if (!kind) return;
    switch (kind) {
      case 'tokens':
        for (let i = 0; i < rand.int(4, 7); i++) this.spawnDrop('token', x, y);
        break;
      case 'points':
        for (let i = 0; i < 3; i++) this.spawnDrop('token', x, y);
        this.score += 150;
        break;
      case 'ammo':
        this.spawnDrop('ammo', x, y);
        break;
      case 'health':
        this.spawnDrop('health', x, y);
        break;
      case 'nade':
        this.spawnDrop('nade', x, y);
        break;
      case 'repair':
        this.spawnDrop('repair', x, y);
        break;
      case 'rifle':
      case 'shotgun':
      case 'launcher':
      case 'energy':
        this.spawnDrop(kind, x, y);
        break;
      case 'emblem': {
        const pk = new Pickup('emblem', x, y, -1, p.spawn.lootId ?? 0, true);
        pk.life = Infinity;
        this.pickups.push(pk);
        break;
      }
      case 'secret': {
        const pk = new Pickup('secret', x, y, -1, p.spawn.lootId ?? 0, true);
        pk.life = Infinity;
        this.pickups.push(pk);
        break;
      }
      default:
        break;
    }
  }

  propBroken(p: Prop) {
    this.solidsDirty = true;
    this.director.onPropBroken(p);
  }

  /** Retorna true se o item foi consumido. */
  collect(pk: Pickup): boolean {
    const pl = this.player;
    const a = (n: SfxName) => this.audio(n, 0.9, pk.x);
    switch (pk.kind) {
      case 'token':
        this.tokens++;
        this.score += 10;
        a('coin');
        break;
      case 'emblem':
        if (pk.id >= 0) this.collectedPickups.add(pk.id);
        this.emblems.add(pk.itemId);
        this.score += 500;
        a('emblem');
        this.fx.addFlash(0.15, '#ffe27a');
        this.fx.sparks(pk.x, pk.y, 18, '#ffe27a', 260);
        this.fx.popup(pk.x, pk.y - 20, `EMBLEMA ${this.emblems.size}/10`, '#ffe27a', 10);
        break;
      case 'secret':
        if (pk.id >= 0) this.collectedPickups.add(pk.id);
        this.secrets.add(pk.itemId);
        this.score += 2000;
        a('secret');
        this.fx.addFlash(0.3, '#9ffcff');
        this.fx.sparks(pk.x, pk.y, 30, '#9ffcff', 320);
        this.fx.popup(pk.x, pk.y - 26, `ORELHA DOURADA ${this.secrets.size}/3`, '#9ffcff', 10);
        this.hooks.onBanner?.('ORELHA DOURADA!', `Segredo ${this.secrets.size} de 3`, 2.4);
        break;
      case 'health':
        if (!pl.heal(25, this)) return false;
        a('heal');
        break;
      case 'healthBig':
        if (!pl.heal(60, this)) return false;
        a('heal');
        break;
      case 'ammo':
        if (!pl.addAmmo(this)) return false;
        a('pickup');
        break;
      case 'nade':
        if (pl.grenades >= pl.maxGrenades) return false;
        pl.grenades = Math.min(pl.maxGrenades, pl.grenades + 3);
        this.fx.popup(pl.x, pl.y - 40, '+GRANADAS', '#ffd27a');
        a('pickup');
        break;
      case 'rifle':
      case 'shotgun':
      case 'launcher':
      case 'energy':
        pl.giveWeapon(pk.kind as WeaponId, this);
        this.fx.popup(pl.x, pl.y - 44, pk.kind === 'rifle' ? 'RIFLE!' : pk.kind === 'shotgun' ? 'SHOTGUN!' : pk.kind === 'launcher' ? 'LANÇA-GRANADAS!' : 'PLASMA!', '#ffffff', 10);
        break;
      case 'repair':
        if (!pl.repairNomad(80, this)) return false;
        a('heal');
        break;
    }
    if (pk.id >= 0 && pk.kind !== 'emblem' && pk.kind !== 'secret') this.collectedPickups.add(pk.id);
    return true;
  }

  onEnemyKilled(e: Enemy, info?: HurtInfo) {
    if (!e.silentDeath) {
      this.stats.kills++;
      this.score += e.score;
      this.fx.popup(e.x, e.y - e.body.h / 2 - 8, `+${e.score}`, '#ffe27a');
      e.drops(this);
    }
    if (!e.spawnedByArena && !e.spawn.arena) this.killedEnemies.add(e.spawn.id);
    this.director.onEnemyKilled(e, info);
  }

  onPlayerDied() {
    this.director.onPlayerDied();
  }
  onNomadMounted() {
    this.nomadUsed = true;
    this.director.onNomadMounted();
  }
  onNomadLost() {
    this.director.onNomadLost();
  }

  // ------------------------------------------------------------------ atualização
  update(dt: number, ctl: ControlState) {
    this.time += dt;
    this.stats.time = this.time;
    const p = this.player;

    // timers
    for (let i = this.timers.length - 1; i >= 0; i--) {
      this.timers[i].t -= dt;
      if (this.timers[i].t <= 0) {
        const fn = this.timers[i].fn;
        this.timers.splice(i, 1);
        fn();
      }
    }
    if (this.solidsDirty) this.rebuildSolids();

    this.director.update(dt, ctl);
    p.update(this, dt, ctl);
    if (this.invulnerable && p.mode !== 'dead') {
      p.hp = p.maxHp;
      if (p.nomad) p.nomad.hp = p.nomad.maxHp;
    }

    // ativação de inimigos por proximidade da câmera/jogador
    const cx = this.camera.x + this.camera.w / 2;
    const cy = this.camera.y + this.camera.h / 2;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (!e.awake) {
        const dx = Math.abs(e.x - cx);
        const dy = Math.abs(e.y - cy);
        if (dx < e.stats.wake && dy < 520) e.awake = true;
        else continue;
      }
      e.update(this, dt);
    }
    // contato inimigo → jogador
    if (p.targetable && !p.isDashing) {
      for (const e of this.enemies) {
        if (!e.alive || e.contactDmg <= 0 || !e.awake) continue;
        const a = e.hitbox;
        const b = p.hitbox;
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
          p.hit(this, e.contactDmg, Math.sign(p.x - e.x) || 1, { kx: 220, ky: -260 });
        }
      }
    }
    // limpa mortos
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) {
        e.deadT += dt;
        if (e.deadT > 0.05) this.enemies.splice(i, 1);
      }
    }

    for (const b of this.bullets) b.update(this, dt);
    for (let i = this.bullets.length - 1; i >= 0; i--) if (this.bullets[i].dead) this.bullets.splice(i, 1);
    for (const g of this.grenades) g.update(this, dt);
    for (let i = this.grenades.length - 1; i >= 0; i--) if (this.grenades[i].dead) this.grenades.splice(i, 1);
    for (const pk of this.pickups) pk.update(this, dt);
    for (let i = this.pickups.length - 1; i >= 0; i--) if (!this.pickups[i].alive) this.pickups.splice(i, 1);
    for (const pr of this.props) pr.update(dt);
    for (let i = this.props.length - 1; i >= 0; i--) if (!this.props[i].alive) this.props.splice(i, 1);
    for (const w of this.wrecks) w.t += dt;
    for (const c of this.corpses) c.update(dt);
    for (let i = this.corpses.length - 1; i >= 0; i--) if (this.corpses[i].dead) this.corpses.splice(i, 1);

    this.fx.update(dt, (x, y) => this.level.solidAtPx(x, y));
    if (this.speedLines > 0) this.speedLines -= dt;

    // câmera
    const cam = this.camera;
    this.director.cameraUpdate(dt);
    const shakeOn = true;
    cam.update(dt, p.x, p.y - (p.mode === 'nomad' ? 6 : 14), p.facing, p.body.vx, p.body.onGround, this.fx.shake, shakeOn);
  }

  rebuildSolids() {
    this.solidRects.length = 0;
    for (const p of this.props) {
      if (p.alive && p.solid) this.solidRects.push({ x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h });
    }
    this.solidsDirty = false;
  }

  // ------------------------------------------------------------------ desenho
  drawWorld(g: CanvasRenderingContext2D) {
    const art = getArt();
    const cam = this.camera;
    const L = this.level;
    // decorações de fundo
    this.director.drawDecos(g, 'back');
    // tiles
    art.tiles.render(g, L, cam.x, cam.y, cam.w, cam.h, this.time);
    // destroços do Nômad
    for (const w of this.wrecks) this.drawWreck(g, w);
    // Nômad estacionado / aguardando
    this.director.drawNomadWorld(g);
    // props
    for (const pr of this.props) {
      if (!cam.visible(pr.x, pr.y, 90)) continue;
      pr.draw(g, this.time);
    }
    this.director.drawBarriers(g);
    for (const pk of this.pickups) if (cam.visible(pk.x, pk.y, 40)) pk.draw(g, this);
    this.fx.draw(g, false);
    for (const c of this.corpses) c.render(g);
    for (const e of this.enemies) {
      if (!e.awake && !cam.visible(e.x, e.y, 120)) continue;
      e.draw(g, this);
    }
    this.player.draw(g, this);
    for (const gr of this.grenades) gr.draw(g);
    for (const b of this.bullets) b.draw(g);
    this.director.drawWorldOverlays(g);
    this.fx.draw(g, true);
    this.director.drawDecos(g, 'front');
    this.fx.drawPopups(g);
    void art.props;
  }

  private drawWreck(g: CanvasRenderingContext2D, w: Wreck) {
    const art = getArt();
    // carcaça escurecida do Nômad
    g.save();
    g.globalAlpha = 0.95;
    drawNomadIdle(g, art.nomad, w.x, w.y, 0, 1, 0);
    g.globalCompositeOperation = 'source-atop';
    g.restore();
    if (Math.random() < 0.15) this.fx.smoke(w.x + rand.spread(14), w.y - 30, 1, '#2a2438', 9, 40, 1.1);
    if (Math.random() < 0.05) this.fx.sparks(w.x + rand.spread(14), w.y - 30, 3, '#ffb347', 120);
    if (Math.random() < 0.07) this.fx.add(PK.Fire, w.x + rand.spread(12), w.y - 34, 0, -30, 0.5, 8, '#ff7a1a', { size1: 2 });
  }
}

const WEAPON_AMMO_FLOOR: Record<WeaponId, number> = { pistol: Infinity, rifle: 60, shotgun: 12, launcher: 5, energy: 25 };
