import type { World, MusicState } from './world';
import type { Arena, EnemySpawn, DecoSpawn } from './level';
import type { ControlState } from '../core/input';
import type { Enemy, HurtInfo } from './enemies/enemy';
import type { Prop } from './props';
import { Prop as PropClass } from './props';
import { clamp, rand, type Rect } from '../core/math';
import { PK } from './fx';
import { getArt } from '../art';
import { drawNomadIdle } from '../art/nomad';
import { newNomad } from './player';
import { NOMAD_W, NOMAD_H, FOOT_H } from './movement';
import { glowSprite } from '../art/kit';
import { drawDeco } from '../art/decor';

type ArenaStatus = 'idle' | 'active' | 'cleared';
interface ArenaState {
  def: Arena;
  status: ArenaStatus;
  wave: number; // índice da onda atual
  waveTimer: number; // atraso antes de spawnar a onda
  waveSpawned: boolean;
  alive: Enemy[];
  barriers: Prop[];
  bossEnemy: Enemy | null;
  t: number;
}

interface Cine {
  kind: 'nomad' | 'bossDeath' | 'bossIntro';
  t: number;
  stage: number;
}

export class Director {
  w: World;
  arenas: ArenaState[] = [];
  cine: Cine | null = null;
  combatHold = 0;
  nomadPower = 0; // 0..1 (luzes do Nômad dormente)
  nomadWaiting = true;
  triggered = new Set<string>();
  bossActive = false;
  bossPhase = 1;
  bossRef: Enemy | null = null;
  bossIntroDone = false;
  finishTimer = -1;
  secretFlash = 0;
  lastCheckpointBanner = -1;
  nomadHintCount = 0;
  hintCooldown = 0;
  zoomOverride: number | null = null;

  constructor(w: World) {
    this.w = w;
    this.buildArenas();
  }

  private buildArenas() {
    this.arenas = this.w.data.arenas.map((def) => ({
      def, status: 'idle' as ArenaStatus, wave: 0, waveTimer: 0, waveSpawned: false, alive: [], barriers: [], bossEnemy: null, t: 0,
    }));
  }

  reset() {
    this.buildArenas();
    this.cine = null;
    this.combatHold = 0;
    this.nomadPower = 0;
    this.nomadWaiting = true;
    this.triggered.clear();
    this.bossActive = false;
    this.bossPhase = 1;
    this.bossRef = null;
    this.bossIntroDone = false;
    this.finishTimer = -1;
    this.lastCheckpointBanner = -1;
    this.zoomOverride = null;
    this.w.camera.focus = null;
    this.w.camera.lock = null;
    this.w.camera.zoomTarget = 1;
  }

  // ------------------------------------------------------------------ respawn
  onRespawn() {
    // arenas ativas (não limpas) voltam ao estado inicial
    for (const a of this.arenas) {
      if (a.status === 'active') {
        a.status = 'idle';
        a.wave = 0;
        a.waveSpawned = false;
        a.alive = [];
        a.barriers = [];
        a.bossEnemy = null;
      }
    }
    this.cine = null;
    this.bossActive = false;
    this.bossRef = null;
    this.bossIntroDone = false;
    this.zoomOverride = null;
    this.w.camera.focus = null;
    this.w.camera.lock = null;
    this.w.camera.zoomTarget = 1;
    this.w.setAlarm(false);
    this.w.rollSound(0);
    // gatilhos de cinemática já concluídos permanecem; o que não concluiu recomeça
    if (!this.w.nomadUsed) {
      this.triggered.delete('nomadMeet');
      this.nomadWaiting = true;
      this.nomadPower = 0;
    }
  }
  afterPopulate() {
    // reaplica barreiras de arenas limpas: nenhuma (cleared = livre)
  }
  afterRespawn() {
    this.w.setMusic('explore');
  }

  /** Reembarca no Nômad ao respawnar num checkpoint pós-encontro. */
  remountAtCheckpoint(hp: number) {
    const p = this.w.player;
    const s = newNomad();
    s.hp = Math.max(hp, s.maxHp * 0.6);
    p.nomad = s;
    const feet = p.body.y + p.body.h / 2;
    p.body.w = NOMAD_W;
    p.body.h = NOMAD_H;
    p.body.y = feet - NOMAD_H / 2 - 0.5;
    p.invuln = 0.4;
    p.mode = 'nomad';
    void FOOT_H;
    this.nomadWaiting = false;
    this.w.nomadUsed = true;
  }

  // ------------------------------------------------------------------ consultas
  currentLock(): Rect | null {
    for (const a of this.arenas) if (a.status === 'active') return a.def.rect;
    const p = this.w.player;
    for (const z of this.w.data.camZones) {
      const r = z.rect;
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return r;
    }
    return null;
  }
  activeArenaRect(): Rect | null {
    for (const a of this.arenas) if (a.status === 'active') return a.def.rect;
    return null;
  }
  insideActiveArena(x: number) {
    for (const a of this.arenas) {
      if (a.status === 'active' && x >= a.def.rect.x && x <= a.def.rect.x + a.def.rect.w) return true;
    }
    return false;
  }
  arenaActiveContains(x: number) {
    return this.insideActiveArena(x);
  }

  banner(title: string, sub?: string, dur = 2.2) {
    this.w.hooks.onBanner?.(title, sub, dur);
  }

  // ------------------------------------------------------------------ eventos
  onEnemyKilled(e: Enemy, info?: HurtInfo) {
    void info;
    for (const a of this.arenas) {
      const i = a.alive.indexOf(e);
      if (i >= 0) a.alive.splice(i, 1);
    }
    if (e.isBoss) this.onBossDefeated(e);
  }
  onPlayerDied() {
    if (this.cine) this.cine = null;
    this.w.camera.focus = null;
  }
  onPropBroken(p: Prop) {
    void p;
  }
  onNomadMounted() {
    this.nomadWaiting = false;
    this.w.setMusic('nomad');
    this.banner('NÔMAD ONLINE', 'Robô de guerra', 2.6);
    this.w.camera.focus = null;
    this.zoomOverride = null;
    this.cine = null;
    this.saveCheckpointHere();
  }
  onNomadLost() {
    this.banner('NÔMAD DESTRUÍDO', 'Continue a pé!', 2.4);
    this.w.setAlarm(false);
    this.w.rollSound(0);
    this.w.setMusic('explore');
  }

  private saveCheckpointHere() {
    // checkpoint "nomad" = índice do primeiro checkpoint marcado como pós-encontro (se existir)
    const cps = this.w.data.checkpoints;
    const p = this.w.player;
    let idx = -1;
    for (let i = 0; i < cps.length; i++) if (cps[i].x <= p.x + 40) idx = i;
    if (idx >= 0 && idx > this.w.checkpointIdx) this.activateCheckpoint(idx, true);
  }

  private activateCheckpoint(idx: number, quiet = false) {
    const w = this.w;
    w.checkpointIdx = idx;
    w.checkpointSnap = w.player.snapshot();
    if (!quiet) {
      w.audio('checkpoint', 1);
      this.banner('CHECKPOINT', w.data.checkpoints[idx].name, 1.8);
      w.fx.sparks(w.player.x, w.player.y, 16, '#9dfcff', 260);
    }
  }

  // ------------------------------------------------------------------ atualização
  update(dt: number, ctl: ControlState) {
    void ctl;
    const w = this.w;
    const p = w.player;
    if (this.hintCooldown > 0) this.hintCooldown -= dt;

    // checkpoints
    if (p.mode === 'foot' || p.mode === 'nomad') {
      const cps = w.data.checkpoints;
      for (let i = w.checkpointIdx + 1; i < cps.length; i++) {
        if (p.x >= cps[i].x && !this.insideActiveArena(p.x)) {
          this.activateCheckpoint(i);
          break;
        }
      }
    }
    // gatilhos
    for (const t of w.data.triggers) {
      if (this.triggered.has(t.id)) continue;
      const r = t.rect;
      if (p.mode !== 'dead' && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        this.fireTrigger(t.id, t.once);
      }
    }
    // salas secretas
    for (const s of w.data.secretRooms) {
      if (w.secretRooms.has(s.id)) continue;
      const r = s.rect;
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        w.secretRooms.add(s.id);
        w.audio('secret', 0.7);
        w.fx.popup(p.x, p.y - 50, 'ÁREA SECRETA!', '#9ffcff', 10);
        w.score += 300;
        this.secretFlash = 1;
      }
    }
    if (this.secretFlash > 0) this.secretFlash -= dt;

    // arenas
    for (const a of this.arenas) this.updateArena(a, dt);

    // cinemática
    if (this.cine) this.updateCine(dt);

    // dica sutil do segundo avanço
    this.updateDashHint();

    // fim de fase
    if (this.finishTimer >= 0) {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0) {
        this.finishTimer = -1;
        w.finished = true;
        w.hooks.onComplete?.();
      }
    }

    this.updateMusic(dt);
  }

  private fireTrigger(id: string, once: boolean) {
    const w = this.w;
    if (once) this.triggered.add(id);
    switch (id) {
      case 'nomadMeet':
        if (!w.nomadUsed && !w.nomadLost && w.player.mode === 'foot') {
          this.cine = { kind: 'nomad', t: 0, stage: 0 };
          w.player.lockInput = true;
          w.player.body.vx = 0;
        }
        break;
      case 'dismount':
        if (w.player.mode === 'nomad') {
          w.player.dismount(w, w.player.x);
          w.setAlarm(false);
          w.rollSound(0);
          this.banner('NÔMAD ESTACIONADO', 'A passagem é estreita — siga a pé', 3);
          w.setMusic('explore');
        }
        break;
      default:
        break;
    }
  }

  private updateCine(dt: number) {
    const w = this.w;
    const c = this.cine!;
    const p = w.player;
    c.t += dt;
    if (c.kind === 'nomad') {
      const ns = w.data.nomadSpawn;
      w.camera.focus = { x: ns.x - 20, y: ns.y - 64, rate: 3.2 };
      w.camera.zoomTarget = 1.22;
      p.body.vx = 0;
      if (c.stage === 0 && c.t > 0.7) {
        c.stage = 1;
        w.audio('nomadBoot', 1);
        w.setMusic('calm');
      }
      if (c.stage === 1) {
        this.nomadPower = clamp((c.t - 0.7) / 1.4, 0, 1);
        if (Math.random() < 0.3) w.fx.sparks(ns.x, ns.y - 60, 3, '#ffe27a', 180);
      }
      if (c.stage === 1 && c.t > 1.9) {
        c.stage = 2;
        this.banner('NÔMAD', 'Protótipo de guerra da Legião', 2.6);
        w.fx.addShake(3, 0.4);
        w.fx.addFlash(0.25, '#ffe9b0');
      }
      if (c.stage === 2 && c.t > 3.5) {
        c.stage = 3;
        w.audio('nomadEnter', 1, ns.x);
        p.startMount(w, ns.x, ns.y);
        w.camera.zoomTarget = 1.1;
      }
      if (c.stage === 3) {
        // mount concluído em Player.finishMount → onNomadMounted limpa a cinemática
        if (p.mode === 'nomad') this.cine = null;
      }
    } else if (c.kind === 'bossDeath') {
      this.updateBossDeath(dt, c);
    }
  }

  // ------------------------------------------------------------------ arenas
  private updateArena(a: ArenaState, dt: number) {
    const w = this.w;
    const p = w.player;
    if (a.status === 'cleared') return;
    if (a.status === 'idle') {
      if (p.mode !== 'dead' && p.mode !== 'mounting' && p.x >= a.def.triggerX && p.x < a.def.rect.x + a.def.rect.w && !this.cine) this.startArena(a);
      return;
    }
    a.t += dt;
    if (!a.waveSpawned) {
      a.waveTimer -= dt;
      if (a.waveTimer <= 0) this.spawnWave(a);
      return;
    }
    // onda atual limpa?
    a.alive = a.alive.filter((e) => e.alive);
    if (a.alive.length === 0 && !(a.def.id === 'boss' && !this.bossIntroDone)) {
      a.wave++;
      if (a.wave >= a.def.waves.length) {
        if (a.def.id !== 'boss') this.clearArena(a);
      } else {
        a.waveSpawned = false;
        a.waveTimer = a.def.waves[a.wave].delay;
      }
    }
  }

  private startArena(a: ArenaState) {
    const w = this.w;
    a.status = 'active';
    a.wave = 0;
    a.waveSpawned = false;
    a.waveTimer = a.def.waves[0]?.delay ?? 0.6;
    a.t = 0;
    w.audio('lock', 1);
    w.fx.addShake(3, 0.3);
    if (a.def.banner) this.banner(a.def.banner, undefined, 1.6);
    // barreiras
    if (!a.def.soft) {
      const r = a.def.rect;
      const mk = (x: number) => {
        const pr = new PropClass({ id: -1000 - this.arenas.indexOf(a) * 2 - (x === r.x ? 0 : 1), kind: 'door', x, y: r.y + r.h, w: 20, h: r.h, solid: true, critical: true });
        pr.barrier = true;
        pr.hittable = false;
        w.props.push(pr);
        a.barriers.push(pr);
      };
      // barreiras nas laterais, mas só fecha o lado por onde NÃO estamos entrando se já estivermos dentro
      mk(r.x - 6 + 10);
      mk(r.x + r.w + 6 - 10);
      w.solidsDirty = true;
    }
    if (a.def.id === 'boss') {
      this.startBoss(a);
    } else {
      w.setMusic(w.player.mounted ? 'nomadCombat' : 'combat');
    }
  }

  private spawnWave(a: ArenaState) {
    const w = this.w;
    a.waveSpawned = true;
    const wave = a.def.waves[a.wave];
    if (!wave) return;
    const cam = w.camera;
    for (const id of wave.spawns) {
      const sp = w.data.enemies.find((e) => e.id === id);
      if (!sp) continue;
      const s: EnemySpawn = { ...sp };
      const r = a.def.rect;
      // entrada: cair do céu / correr pela lateral
      if (s.drop) {
        s.y = a.def.dropY ?? Math.max(cam.y - 40, r.y + 10);
      } else if (s.fromSide) {
        s.x = s.fromSide === -1 ? Math.max(r.x + 30, cam.x - 30) : Math.min(r.x + r.w - 30, cam.x + cam.w + 30);
      }
      s.x = clamp(s.x, r.x + 30, r.x + r.w - 30);
      const e = w.spawnEnemy(s);
      a.alive.push(e);
      if (s.drop) {
        e.body.vy = 100;
        w.fx.add(PK.Fire, e.x, s.y, 0, 0, 0.3, 16, '#ffb347', { size1: 3 });
      }
    }
    w.audio('alarm', 0.5);
  }

  private clearArena(a: ArenaState) {
    const w = this.w;
    a.status = 'cleared';
    w.audio('unlock', 1);
    for (const b of a.barriers) {
      b.alive = false;
      w.fx.sparks(b.x, b.y, 10, '#7ff9ff', 300);
    }
    a.barriers = [];
    w.solidsDirty = true;
    this.banner('ÁREA LIMPA', undefined, 1.2);
    w.score += 500;
    this.combatHold = 0;
    // suprimentos
    const r = a.def.rect;
    const cx = r.x + r.w / 2;
    w.spawnDrop('health', cx, r.y + r.h - 60);
    w.spawnDrop('ammo', cx + 24, r.y + r.h - 60);
    w.setMusic(w.player.mounted ? 'nomad' : 'explore');
  }

  // ------------------------------------------------------------------ boss
  private startBoss(a: ArenaState) {
    const w = this.w;
    this.bossActive = true;
    this.bossPhase = 1;
    this.bossIntroDone = false;
    w.setMusic('silence');
    w.player.lockInput = true;
    w.player.body.vx = 0;
    w.camera.zoomTarget = 0.96;
    w.after(0.8, () => {
      const sp = w.data.enemies.find((e) => e.type === 'boss')!;
      const e = w.spawnEnemy({ ...sp, arena: 'boss' });
      this.bossRef = e;
      a.alive.push(e);
      a.bossEnemy = e;
      this.banner('FELIPÃO', 'O Chefe da Legião', 3.2);
      w.audio('bossRoar', 1);
      w.fx.addShake(8, 0.8);
      w.fx.addFlash(0.3, '#ffffff');
      w.setMusic('boss1');
    });
    w.after(3.2, () => {
      this.bossIntroDone = true;
      w.player.lockInput = false;
    });
  }

  setBossPhase(n: number) {
    this.bossPhase = n;
    this.w.setMusic(n === 1 ? 'boss1' : n === 2 ? 'boss2' : 'boss3');
  }

  private onBossDefeated(e: Enemy) {
    const w = this.w;
    this.bossActive = false;
    this.cine = { kind: 'bossDeath', t: 0, stage: 0 };
    w.player.lockInput = true;
    w.setMusic('silence');
    w.camera.focus = { x: e.x, y: e.y - 40, rate: 3 };
    w.camera.zoomTarget = 1.08;
    w.fx.slowmo = 2.6;
    w.fx.slowScale = 0.3;
    for (const en of w.enemies) if (en.alive && en !== e) en.kill(w);
    w.bullets.length = 0;
    this.bossDeathPos = { x: e.x, y: e.y };
  }
  bossDeathPos = { x: 0, y: 0 };

  private updateBossDeath(dt: number, c: Cine) {
    const w = this.w;
    const { x, y } = this.bossDeathPos;
    // explosões em sequência
    if (c.stage === 0) {
      if (Math.random() < dt * 9) {
        const ex = x + rand.spread(60);
        const ey = y + rand.spread(70);
        w.fx.explosion(ex, ey, rand.range(16, 34));
        w.audio(Math.random() < 0.4 ? 'bigExplosion' : 'explosion', 0.9, ex);
        w.fx.addShake(6, 0.2);
      }
      if (c.t > 2.4) {
        c.stage = 1;
        w.fx.explosion(x, y, 90);
        w.audio('bossDie', 1.2);
        w.fx.addFlash(1, '#ffffff');
        w.fx.addShake(14, 0.8);
        w.setMusic('victory');
        w.audio('victory', 1);
        // chuva de tokens
        for (let i = 0; i < 26; i++) w.spawnDrop('token', x + rand.spread(50), y - 30);
      }
    } else if (c.stage === 1 && c.t > 4.6) {
      c.stage = 2;
      this.banner('FASE COMPLETA!', 'Karimbolândia está a salvo... por enquanto', 3.5);
      this.finishTimer = 3.2;
    }
  }

  // ------------------------------------------------------------------ dica do segundo avanço
  private updateDashHint() {
    const w = this.w;
    const n = w.player.nomad;
    if (!n) return;
    // depois de 3 usos do primeiro avanço sem nunca acionar o segundo, mostra a janela sutilmente
    n.hintShown = n.dash1Uses >= 3 && !n.dash2Used && !this.discovered();
  }
  discovered() {
    return this.w.stats.dashes > 0 && this.w.player.nomad?.dash2Used === true;
  }

  // ------------------------------------------------------------------ música dinâmica
  private updateMusic(dt: number) {
    const w = this.w;
    if (this.bossActive || this.cine?.kind === 'bossDeath' || w.finished) return;
    if (this.cine?.kind === 'nomad') return;
    const p = w.player;
    if (p.mode === 'dead') return;
    let near = 0;
    for (const e of w.enemies) {
      if (!e.alive || !e.awake || e.isBoss) continue;
      if (Math.abs(e.x - p.x) < 520 && Math.abs(e.y - p.y) < 300) near++;
    }
    if (near > 0) this.combatHold = 3.2;
    else this.combatHold -= dt;
    const fighting = this.combatHold > 0;
    const activeArena = this.arenas.some((a) => a.status === 'active');
    let s: MusicState;
    if (p.mounted) s = fighting || activeArena ? 'nomadCombat' : 'nomad';
    else s = fighting || activeArena ? 'combat' : 'explore';
    w.setMusic(s);
  }

  // ------------------------------------------------------------------ câmera
  cameraUpdate(dt: number) {
    void dt;
    const w = this.w;
    const cam = w.camera;
    cam.lock = this.currentLock();
    if (this.cine) return; // a cinemática controla a câmera
    if (this.bossActive) {
      // enquadra jogador e chefe juntos (o chefe nunca deve sair da tela)
      const p = w.player;
      const spawn = w.data.enemies.find((e) => e.type === 'boss')!;
      const b = this.bossRef;
      const zoom = 0.9;
      cam.zoomTarget = zoom;
      const vw = cam.viewW / zoom;
      if (b && (b.alive || b.hp > 0)) {
        const mid = p.x + clamp((b.x - p.x) * 0.5, -vw * 0.28, vw * 0.28);
        cam.focus = { x: mid, y: spawn.y - 76, rate: 4.2 };
      } else cam.focus = { x: spawn.x - 200, y: spawn.y - 76, rate: 3 };
      return;
    }
    // zoom padrão: um pouco mais aberto ao pilotar o Nômad
    cam.zoomTarget = this.zoomOverride ?? (w.player.mounted ? 0.94 : 1);
    cam.focus = null;
  }

  // ------------------------------------------------------------------ desenho
  drawDecos(g: CanvasRenderingContext2D, layer: 'back' | 'front') {
    const cam = this.w.camera;
    const t = this.w.time;
    for (const d of this.w.data.decos as DecoSpawn[]) {
      if (d.layer !== layer) continue;
      if (d.x < cam.x - 200 || d.x > cam.x + cam.w + 200) continue;
      drawDeco(g, d, t);
    }
  }

  drawNomadWorld(g: CanvasRenderingContext2D) {
    const w = this.w;
    const art = getArt();
    // Nômad aguardando (antes de embarcar)
    if (!w.nomadUsed && !w.nomadLost && w.player.mode !== 'mounting') {
      const ns = w.data.nomadSpawn;
      if (w.camera.visible(ns.x, ns.y, 140)) {
        drawNomadIdle(g, art.nomad, ns.x, ns.y, w.time, 1, this.nomadPower);
        // aura/holofote
        const spr = glowSprite('#ffe27a', 32);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.05 + this.nomadPower * 0.1;
        g.drawImage(spr.c, ns.x - 80, ns.y - 100, 160, 120);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
    }
    if (w.player.mode === 'mounting') {
      const ns = w.data.nomadSpawn;
      drawNomadIdle(g, art.nomad, ns.x, ns.y, w.time, 1, 1);
    }
    if (w.parkedNomad) {
      const pn = w.parkedNomad;
      drawNomadIdle(g, art.nomad, pn.x, pn.y, w.time, pn.facing, 0.3);
    }
  }

  drawBarriers(g: CanvasRenderingContext2D) {
    const t = this.w.time;
    for (const a of this.arenas) {
      for (const b of a.barriers) {
        const x = b.x;
        const top = b.y - b.h / 2;
        g.globalCompositeOperation = 'lighter';
        const grd = g.createLinearGradient(x - 10, 0, x + 10, 0);
        grd.addColorStop(0, 'rgba(60,240,255,0)');
        grd.addColorStop(0.5, 'rgba(90,240,255,0.55)');
        grd.addColorStop(1, 'rgba(60,240,255,0)');
        g.fillStyle = grd;
        g.fillRect(x - 10, top, 20, b.h);
        g.fillStyle = 'rgba(200,255,255,0.7)';
        const n = Math.floor(b.h / 24);
        for (let i = 0; i < n; i++) {
          const yy = top + ((i * 24 + t * 60) % b.h);
          g.fillRect(x - 1.5, yy, 3, 8);
        }
        g.globalCompositeOperation = 'source-over';
      }
    }
  }

  drawWorldOverlays(g: CanvasRenderingContext2D) {
    void g;
  }
}
