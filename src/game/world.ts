import { Level, T, TILE, type LevelData, type EnemySpawn, type PickupKind } from './level';
import { Fx, PK } from './fx';
import { Camera } from './camera';
import { Player } from './player';
import { Bullet, Grenade, type BulletOpts, type BulletKind } from './bullets';
import { Prop, pickLoot } from './props';
import { Pickup } from './pickups';
import type { Enemy, HurtInfo } from './enemies/enemy';
import { createEnemy } from './enemies';
import { Smasher } from './smash';
import { Director } from './director';
import { audio as audioEngine, type SfxName, type ClipName, type ClipHandle } from '../core/audio';
import { clamp, rand, type Rect } from '../core/math';
import type { ControlState } from '../core/input';
import { WEAPON_ORDER, type WeaponId } from './weapons';
import { progress, saveProgress, settings } from '../core/storage';
import { getArt } from '../art';
import { drawNomadIdle } from '../art/nomad';
import { softDot, drawSpr } from '../art/kit';
import { Corpse } from './corpse';
import { Crowd } from './civilians';

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

export const MAX_LIVES = 3;
export const COMBO_WINDOW = 3;
/** multiplicador do combo: x1 → x5 */
export const comboMult = (n: number) => (n >= 20 ? 5 : n >= 12 ? 4 : n >= 7 ? 3 : n >= 3 ? 2 : 1);

export interface Hooks {
  onRespawn?: () => void;
  onBanner?: (title: string, sub?: string, dur?: number) => void;
  onComplete?: () => void;
  onMusic?: (s: MusicState) => void;
  onHint?: (key: string) => void;
  /** o jogador morreu e ainda tem vidas: perguntar se quer continuar de onde parou */
  onContinue?: (livesLeft: number) => void;
  onGameOver?: () => void;
  /** entrada longa do Felipão começou (o jogo toca o áudio e abafa a música) */
  onBossIntro?: () => void;
  /** HQ dos dois se encarando, com `len` segundos (o mundo congela até acabar) */
  onBossComic?: (len: number) => void;
  /** entrada longa terminou (ou foi pulada): devolve a música e o controle */
  onBossIntroEnd?: () => void;
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
  lastHealthDrop = -99;
  /** 0..1 intensidade da chuva (definida pelo jogo a cada quadro) — chão molhado, respingos */
  rainLevel = 0;
  /** buracos sem fundo (queda = dano): x0..x1 em px e y = altura da borda */
  pits: { x0: number; x1: number; y: number }[] = [];
  /** cenário urbano destrutível (carros, hidrantes, lixeiras…) */
  smash!: Smasher;
  /** moradores da cidade (não são alvos nem sólidos) */
  crowd = new Crowd();
  /** combo: abates em sequência (janela de 3 s) multiplicam a pontuação */
  combo = 0;
  comboT = 0;
  bestCombo = 0;
  /** atiradores recentes que estavam FORA da tela (para a câmera abrir e mostrá-los) */
  threats: { x: number; y: number; t: number }[] = [];
  /** vidas da fase (estilo fichas de fliperama) */
  lives = MAX_LIVES;
  bossLivesGiven = false;
  /** o filminho do chefe já passou nesta partida (não repete ao continuar) */
  comicShown = false;
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
  lastJumpHeld = false;
  invulnerable = false; // debug
  screenW = 640;
  screenH = 360;
  screenToWorldFn: ((sx: number, sy: number) => { x: number; y: number }) | null = null;
  readonly runId = Math.random();
  /** cópia do mapa original (a arena do chefe desaba; restauramos ao reiniciar/morrer) */
  private baseTiles: Uint8Array;
  private baseTheme: Uint8Array;

  constructor(data: LevelData) {
    this.data = data;
    this.level = data.level;
    this.baseTiles = data.level.tiles.slice();
    this.baseTheme = data.level.theme.slice();
    this.director = new Director(this);
    this.computePits();
    this.smash = new Smasher(this);
    this.camera.bounds = { x: 0, y: 0, w: this.level.pxW, h: this.level.pxH };
    this.startRun();
  }

  // ------------------------------------------------------------------ ciclo
  restoreTiles() {
    this.level.tiles.set(this.baseTiles);
    this.level.theme.set(this.baseTheme);
    this.level.rev++;
    this.computePits();
  }

  startRun() {
    this.restoreTiles();
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
    this.lives = MAX_LIVES;
    this.bossLivesGiven = false;
    this.comicShown = false;
    this.combo = 0;
    this.comboT = 0;
    this.bestCombo = 0;
    this.smash?.reset();
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
    this.crowd.reset(this.data.civilians);
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
    this.restoreTiles();
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

  /** Posição (pés) do último checkpoint ou do início. */
  checkpointPos() {
    const cp = this.checkpointIdx >= 0 ? this.data.checkpoints[this.checkpointIdx] : null;
    return cp ? { x: cp.x, y: cp.y } : { x: this.data.playerStart.x, y: this.data.playerStart.y };
  }

  requestRespawn() {
    if (this.hooks.onContinue) {
      if (this.lives > 0) {
        this.hooks.onContinue(this.lives);
        return;
      }
      if (this.hooks.onGameOver) {
        this.hooks.onGameOver();
        return;
      }
    }
    this.respawnRequested = true;
    this.hooks.onRespawn?.();
  }

  /** Continuar de onde parou: gasta 1 vida, mantém inimigos/arena/chefe e o inventário. */
  reviveInPlace() {
    if (this.lives <= 0) return;
    this.lives--;
    const p = this.player;
    p.revive(this);
    // munição mínima para não continuar sem nada
    for (const id of WEAPON_ORDER) {
      const have = p.weapons.get(id);
      if (have !== undefined && have !== Infinity) p.weapons.set(id, Math.max(have, Math.ceil(WEAPON_AMMO_FLOOR[id])));
    }
    p.grenades = Math.max(p.grenades, 3);
    // limpa tiros inimigos ao redor
    this.bullets = this.bullets.filter((b) => b.team === 0 || Math.hypot(b.x - p.x, b.y - p.y) > 220);
    this.grenades = this.grenades.filter((g) => g.team === 0 || Math.hypot(g.x - p.x, g.y - p.y) > 160);
    this.cameraSnap();
    this.fx.addFlash(0.6, '#ffffff');
    this.fx.sparks(p.x, p.y - 20, 22, '#9dfcff', 320);
    this.audio('checkpoint', 1);
    this.hooks.onBanner?.('DE VOLTA!', this.lives > 0 ? `${this.lives} ${this.lives === 1 ? 'vida restante' : 'vidas restantes'}` : 'Última vida!', 2);
    this.director.onRevive();
  }

  // ------------------------------------------------------------------ helpers de serviço
  audio(name: SfxName, vol = 1, x?: number) {
    let v = vol;
    let pan = 0;
    if (x !== undefined && Number.isFinite(x) && Number.isFinite(this.camera.x)) {
      const cx = this.camera.x + this.camera.w / 2;
      const d = Math.abs(x - cx);
      v *= clamp(1.25 - d / 620, 0, 1);
      pan = clamp((x - cx) / (this.camera.w * 0.6), -0.8, 0.8);
      if (v < 0.03) return;
    }
    audioEngine.play(name, v, pan);
  }
  /** Voz/clipe gravado (sem áudio devolve um controle vazio). */
  voice(name: ClipName, vol = 1): ClipHandle {
    return audioEngine.playClip(name, { vol });
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
    this.camera.snapTo(p.x, p.y, p.facing);
  }
  /** Tile (tx,ty) é chão firme AGORA (3 tiles sólidos, sem espinho, com espaço para ficar em pé)? */
  standableAt(tx: number, ty: number) {
    const L = this.level;
    for (let dx = -1; dx <= 1; dx++) {
      if (L.get(tx + dx, ty) !== T.SOLID) return false;
      if (L.get(tx + dx, ty - 1) === T.SOLID || L.get(tx + dx, ty - 1) === T.HAZARD) return false;
    }
    if (L.get(tx, ty - 2) === T.SOLID) return false;
    return true;
  }

  /**
   * Ponto seguro válido no mapa ATUAL mais próximo de (x, feetY): o chão pode ter desabado
   * (arena do chefe) desde que o ponto foi memorizado. Dentro de arena ativa, fica dentro dela.
   */
  findSafeSpot(x: number, feetY: number): { x: number; y: number } | null {
    const tx0 = Math.floor(x / TILE);
    const ty0 = Math.floor(feetY / TILE);
    const a = this.director.activeArenaRect();
    for (let r = 0; r <= 40; r++) {
      for (const s of r === 0 ? [1] : [-1, 1]) {
        const tx = tx0 + s * r;
        const px = tx * TILE + TILE / 2;
        if (a && (px < a.x + 40 || px > a.x + a.w - 40)) continue;
        for (const dy of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, 7, 8]) {
          const ty = ty0 + dy;
          if (this.standableAt(tx, ty)) return { x: px, y: ty * TILE };
        }
      }
    }
    return null;
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
    this.noteThreat(x, y);
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
    // explosões destroem o cenário urbano em volta
    this.smash.area(x - radius * 0.75, x + radius * 0.75, y - radius, y + radius * 0.7, 0, 'blast');
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

  /** Drop de vida adaptativo: raro com vida cheia, frequente quando o jogador está ferido. */
  wantsHealthDrop() {
    const pl = this.player;
    const hp = pl.nomad ? Math.min(pl.hp / pl.maxHp, 1) : pl.hp / pl.maxHp;
    const missing = 1 - clamp(hp, 0, 1);
    if (this.time - this.lastHealthDrop < 14) return false;
    if (!rand.chance(0.015 + 0.3 * missing * missing)) return false;
    this.lastHealthDrop = this.time;
    return true;
  }

  /** Registra um disparo inimigo feito de fora da área visível (perto o bastante para importar). */
  noteThreat(x: number, y: number) {
    const c = this.camera;
    const m = 20;
    const inside = x > c.x + m && x < c.x + c.w - m && y > c.y + m && y < c.y + c.h - m;
    // já está enquadrado por causa do zoom-out? continua contando enquanto seguir atirando
    const known = this.threats.find((th) => Math.abs(th.x - x) < 140 && Math.abs(th.y - y) < 140);
    if (known) {
      known.x = x;
      known.y = y;
      known.t = this.time;
      return;
    }
    if (inside) return;
    const p = this.player;
    if (Math.abs(x - p.x) > 900 || Math.abs(y - p.y) > 520) return;
    this.threats.push({ x, y, t: this.time });
    if (this.threats.length > 12) this.threats.shift();
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
        if (!pl.heal(30, this)) return false;
        a('heal');
        break;
      case 'healthBig':
        if (!pl.heal(80, this)) return false;
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
      this.combo = this.comboT > 0 ? this.combo + 1 : 1;
      this.comboT = COMBO_WINDOW;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const mult = comboMult(this.combo);
      const pts = Math.round(e.score * mult);
      this.score += pts;
      this.fx.popup(e.x, e.y - e.body.h / 2 - 8, mult > 1 ? `+${pts} x${mult}` : `+${pts}`, mult > 1 ? '#ff9ad0' : '#ffe27a');
      if (this.combo >= 5 && this.combo % 5 === 0) this.audio('coin', 0.6);
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
  onNomadLost(temp = false, expired = false) {
    this.director.onNomadLost(temp, expired);
  }

  // ------------------------------------------------------------------ atualização
  update(dt: number, ctl: ControlState) {
    this.lastJumpHeld = ctl.jump.held;
    this.time += dt;
    this.stats.time = this.time;
    this.smash.update(dt);
    this.updatePits(dt);
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
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
    // BZZZ do pernilongo enquanto plana (tom varia com velocidade e subida/descida)
    if (p.glide && p.mode === 'foot') audioEngine.loop('glide', true, clamp(Math.abs(p.body.vx) / 218, 0, 1), clamp(-p.body.vy / 220, -1, 1));
    else audioEngine.loop('glide', false);
    if (this.invulnerable && p.mode !== 'dead') {
      p.hp = p.maxHp;
      if (p.nomad) p.nomad.hp = p.nomad.maxHp;
    }

    // ativação de inimigos por proximidade da câmera/jogador
    const cx = this.camera.x + this.camera.w / 2;
    const cy = this.camera.y + this.camera.h / 2;
    // entrada do Felipão: o resto do mundo espera (ninguém ataca durante a cena)
    const introFreeze = this.director.longIntroActive();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (introFreeze && !e.isBoss) continue;
      if (!e.awake) {
        const dx = Math.abs(e.x - cx);
        const dy = Math.abs(e.y - cy);
        if (dx < e.stats.wake && dy < 520) e.awake = true;
        else continue;
      }
      // acordado mas muito longe da câmera (ficou para trás): congela até voltar à cena
      if (!e.isBoss && !e.spawnedByArena && Math.abs(e.x - cx) > 1500) continue;
      e.update(this, dt);
    }
    // contato inimigo → jogador
    if (p.targetable && !p.isDashing && !introFreeze) {
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
    for (const pk of this.pickups) if (pk.body || Math.abs(pk.x - cx) < 900) pk.update(this, dt);
    for (let i = this.pickups.length - 1; i >= 0; i--) if (!this.pickups[i].alive) this.pickups.splice(i, 1);
    for (const pr of this.props) pr.update(dt);
    for (let i = this.props.length - 1; i >= 0; i--) if (!this.props[i].alive) this.props.splice(i, 1);
    for (const w of this.wrecks) w.t += dt;
    this.crowd.update(this, dt);
    for (const c of this.corpses) c.update(dt);
    for (let i = this.corpses.length - 1; i >= 0; i--) if (this.corpses[i].dead) this.corpses.splice(i, 1);

    this.fx.update(dt, (x, y) => this.level.solidAtPx(x, y));
    if (this.speedLines > 0) this.speedLines -= dt;

    // câmera
    const cam = this.camera;
    this.director.cameraUpdate(dt);
    cam.update(dt, p.x, p.y - (p.mode === 'nomad' ? 6 : 14), p.facing, p.body.vx, p.body.onGround, this.fx.shake, settings.screenShake);
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
    {
      const c = this.camera;
      const m = 90;
      this.fx.view = { x0: c.x - m, y0: c.y - m, x1: c.x + c.w + m, y1: c.y + c.h + m };
    }
    this.director.drawDecos(g, 'back');
    // tiles
    art.tiles.render(g, L, cam.x, cam.y, cam.w, cam.h, this.time);
    this.drawWet(g);
    this.drawPits(g);
    // destroços do Nômad
    for (const w of this.wrecks) if (cam.visible(w.x, w.y, 160)) this.drawWreck(g, w);
    // Nômad estacionado / aguardando
    this.director.drawNomadWorld(g);
    // props
    for (const pr of this.props) {
      if (!cam.visible(pr.x, pr.y, 90)) continue;
      pr.draw(g, this.time);
    }
    this.director.drawBarriers(g);
    for (const pk of this.pickups) if (cam.visible(pk.x, pk.y, 40)) pk.draw(g, this);
    this.drawShadows(g);
    this.crowd.draw(g, this);
    this.fx.draw(g, false);
    for (const c of this.corpses) if (cam.visible(c.x, c.y, 140)) c.render(g);
    for (const e of this.enemies) {
      if (!e.isBoss && e.spawn.type !== 'sniper' && !cam.visible(e.x, e.y, 160)) continue; // fora da tela: não desenha (a mira laser do sniper sempre aparece)
      const r = e.isBoss ? 0 : e.react;
      const pop = e.spawnedByArena && e.age < 0.28 ? e.age / 0.28 : 1;
      if (Math.abs(r) > 0.004 || pop < 1) {
        // tranco do impacto (achata + inclina para trás do golpe) e "pop" de entrada com overshoot
        const px = e.x;
        const py = e.flying ? e.y : e.feetY;
        const ps = pop < 1 ? 0.55 + 0.45 * (1 + 2.2 * Math.pow(pop - 1, 3) + 1.2 * Math.pow(pop - 1, 2)) : 1;
        g.save();
        g.translate(px + e.reactDir * r * 3, py);
        g.rotate(e.reactDir * r * 0.14);
        g.scale((1 + r * 0.1) * ps, (1 - r * 0.09) * ps);
        g.translate(-px, -py);
        e.draw(g, this);
        g.restore();
      } else e.draw(g, this);
    }
    this.player.draw(g, this);
    for (const gr of this.grenades) gr.draw(g);
    for (const b of this.bullets) b.draw(g);
    this.director.drawWorldOverlays(g);
    this.fx.draw(g, true);
    this.director.drawDecos(g, 'front');
    this.crowd.drawBalloon(g, this);
    this.fx.drawPopups(g);
    void art.props;
  }

  /** Sombras suaves no chão sob personagens (profundidade 2.5D). */
  /**
   * Encontra os buracos sem fundo: colunas sem nenhum chão até o fim do mapa, entre duas bordas.
   * Chamado ao montar a fase e sempre que o mapa muda (chão do chefe desaba / reinício).
   */
  computePits() {
    const L = this.level;
    const noFloor = (tx: number) => {
      for (let ty = 8; ty < L.h; ty++) {
        const t = L.get(tx, ty);
        if (t === T.SOLID || t === T.ONEWAY) return false;
      }
      return true;
    };
    const topAt = (tx: number) => {
      for (let ty = 1; ty < L.h; ty++) if (L.get(tx, ty) === T.SOLID && L.get(tx, ty - 1) !== T.SOLID) return ty;
      return -1;
    };
    const pits: { x0: number; x1: number; y: number }[] = [];
    let tx = 1;
    while (tx < L.w - 1) {
      if (!noFloor(tx)) {
        tx++;
        continue;
      }
      const s = tx;
      while (tx < L.w - 1 && noFloor(tx)) tx++;
      const e = tx - 1;
      const lt = topAt(s - 1);
      const rt = topAt(e + 1);
      const edge = lt >= 0 && rt >= 0 ? Math.max(lt, rt) : lt >= 0 ? lt : rt;
      if (edge >= 0 && e - s + 1 >= 2 && s > 3 && e < L.w - 4) pits.push({ x0: s * TILE, x1: (e + 1) * TILE, y: edge * TILE });
    }
    this.pits = pits;
  }

  /** Fumaça e brasas subindo dos buracos (ajuda a enxergar o perigo). */
  private updatePits(dt: number) {
    const cam = this.camera;
    for (const p of this.pits) {
      if (p.x1 < cam.x - 60 || p.x0 > cam.x + cam.w + 60) continue;
      if (p.y < cam.y - 80 || p.y > cam.y + cam.h + 200) continue;
      const wdt = p.x1 - p.x0;
      const k = (wdt / 100) * dt * this.fx.density;
      let ns = k * 5;
      while (ns > 0) {
        if (Math.random() < ns) {
          this.fx.add(PK.Smoke, p.x0 + Math.random() * wdt, p.y + 16, rand.spread(14), -rand.range(34, 64), rand.range(1.8, 2.8), rand.range(16, 24), rand.pick(['#b8a4b0', '#9c8aa0', '#c9a89a']), { size1: 44, a0: 0.5, drag: 0.35 });
        }
        ns -= 1;
      }
      let ne = k * 14;
      while (ne > 0) {
        if (Math.random() < ne) {
          const ex = p.x0 + Math.random() * wdt;
          const ey = p.y + rand.range(0, 30);
          const evx = rand.spread(30);
          const evy = -rand.range(80, 190);
          const el = rand.range(1.1, 2.1);
          this.fx.add(PK.Ember, ex, ey, evx, evy, el, rand.range(2.6, 4.2), rand.pick(['#ffd27a', '#ffb347', '#ff7a2a']), { a0: 1, drag: 0.5 });
          // halo da brasa (brilho que o bloom realça)
          if (Math.random() < 0.5) this.fx.add(PK.Fire, ex, ey, evx, evy, el * 0.8, rand.range(6, 10), '#ff7a2a', { size1: 3, a0: 0.55, drag: 0.5 });
        }
        ne -= 1;
      }
    }
  }

  /** Brilho alaranjado pulsando no fundo dos buracos + borda de aviso. */
  private drawPits(g: CanvasRenderingContext2D) {
    const cam = this.camera;
    for (const p of this.pits) {
      if (p.x1 < cam.x - 20 || p.x0 > cam.x + cam.w + 20) continue;
      if (p.y < cam.y - 40 || p.y > cam.y + cam.h + 160) continue;
      const fl = 0.75 + 0.25 * Math.sin(this.time * 3.1 + p.x0 * 0.01) + 0.08 * Math.sin(this.time * 11 + p.x0);
      // calor subindo: brilho forte no fundo do buraco e um "véu" acima da borda (visível na altura do jogador)
      const gr = g.createLinearGradient(0, p.y + 160, 0, p.y - 110);
      gr.addColorStop(0, `rgba(255,120,40,${0.9 * fl})`);
      gr.addColorStop(0.55, `rgba(255,90,30,${0.45 * fl})`);
      gr.addColorStop(0.72, `rgba(255,100,40,${0.26 * fl})`);
      gr.addColorStop(1, 'rgba(255,60,30,0)');
      g.save();
      // fundo escuro do buraco (contraste com o chão)
      const dk = g.createLinearGradient(0, p.y, 0, p.y + 120);
      dk.addColorStop(0, 'rgba(8,2,16,0.75)');
      dk.addColorStop(1, 'rgba(8,2,16,0)');
      g.fillStyle = dk;
      g.fillRect(p.x0, p.y, p.x1 - p.x0, 120);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = gr;
      g.fillRect(p.x0 + 2, p.y - 110, p.x1 - p.x0 - 4, 270);
      // bordas incandescentes
      g.fillStyle = `rgba(255,150,70,${0.55 * fl})`;
      g.fillRect(p.x0 - 1, p.y, 3, 14);
      g.fillRect(p.x1 - 2, p.y, 3, 14);
      g.restore();
    }
  }

  /** Chuva: borda molhada nas superfícies e poças refletindo o neon (ciano/magenta). */
  private drawWet(g: CanvasRenderingContext2D) {
    const r = this.rainLevel;
    if (r < 0.08) return;
    const cam = this.camera;
    const L = this.level;
    const tx0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const tx1 = Math.min(L.w - 1, Math.floor((cam.x + cam.w) / TILE) + 1);
    const ty0 = Math.max(1, Math.floor(cam.y / TILE));
    const ty1 = Math.min(L.h - 1, Math.floor((cam.y + cam.h) / TILE) + 1);
    const t = this.time;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        if (L.get(tx, ty) !== T.SOLID) continue;
        const up = L.get(tx, ty - 1);
        if (up === T.SOLID || up === T.ONEWAY) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        g.globalAlpha = 0.14 * r;
        g.fillStyle = '#cfe6ff';
        g.fillRect(x, y, TILE + 0.5, 1.6);
        const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
        if (h % 3 === 0) {
          const pw = 10 + (h % 13);
          const px = x + ((h >> 4) % (TILE - pw + 1)) + pw / 2;
          const col = (h >> 7) % 2 ? '#ff4fd0' : '#39f0ff';
          const sh = 0.6 + 0.4 * Math.sin(t * 2.5 + (h % 17));
          g.globalAlpha = 0.2 * r * sh;
          g.fillStyle = col;
          g.beginPath();
          g.ellipse(px, y + 1.2, pw / 2, 1.8, 0, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 0.35 * r * sh;
          g.fillStyle = '#ffffff';
          g.fillRect(px - pw * 0.25 + Math.sin(t * 1.3 + h) * 2, y + 0.4, pw * 0.2, 0.8);
        }
      }
    }
    g.restore();
  }

  private drawShadows(g: CanvasRenderingContext2D) {
    const sh = softDot('#000000', 16);
    const cam = this.camera;
    const put = (x: number, y: number, wd: number, a: number) => {
      const gy = this.level.groundBelow(x, y - 4, 500);
      if (gy === null) return;
      const h = gy - y;
      if (h < -6 || h > 320) return;
      const k = 1 - Math.min(0.75, Math.max(0, h) / 380);
      g.globalAlpha = a * k;
      g.drawImage(sh.c, x - wd * k, gy - 3, wd * 2 * k, 8 * k + 2);
    };
    const p = this.player;
    if (p.mode === 'foot' || p.mode === 'nomad') put(p.x, p.feetY, p.mounted ? 30 : 15, 0.42);
    for (const e of this.enemies) {
      if (!e.alive || e.isBoss || !cam.visible(e.x, e.y, 60)) continue;
      put(e.x, e.feetY, Math.max(10, e.body.w * 0.6), 0.34);
    }
    const civs = this.crowd.list;
    for (let i = 0; i < civs.length; i++) {
      const c = civs[i];
      if (!cam.visible(c.x, c.y, 60)) continue;
      put(c.x, c.y - c.hop, c.spawn.look?.build === 'kid' ? 9 : 13, 0.34);
    }
    g.globalAlpha = 1;
  }

  private drawWreck(g: CanvasRenderingContext2D, w: Wreck) {
    const art = getArt();
    // carcaça escurecida do Nômad, tombada, soltando fumaça e faíscas
    drawSpr(g, art.nomad.wreck, w.x, w.y, {});
    if (Math.random() < 0.15) this.fx.smoke(w.x + rand.spread(14), w.y - 40, 1, '#2a2438', 9, 40, 1.1);
    if (Math.random() < 0.05) this.fx.sparks(w.x + rand.spread(14), w.y - 40, 3, '#ffb347', 120);
    if (Math.random() < 0.07) this.fx.add(PK.Fire, w.x + rand.spread(12), w.y - 44, 0, -30, 0.5, 8, '#ff7a1a', { size1: 2 });
  }
}

const WEAPON_AMMO_FLOOR: Record<WeaponId, number> = { pistol: Infinity, rifle: 60, shotgun: 12, launcher: 5, energy: 25 };
