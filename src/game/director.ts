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
import { BASE_ZOOM } from './camera';
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

const GATE_TILE = 596; // portão da garagem (tile)
const HORDE_FROM = 600; // início do trecho de guerra (Nômad)
const HORDE_TO = 1040;
const SUPPORT_AT = 90; // s de jogo (a pé, fora de arenas) até a entrega do Nômad de apoio
const SUPPORT_TIME = 50; // s de uso
const ctlJumpHeld = (w: World) => w.lastJumpHeld;

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
  /** depois da apresentação, o jogador embarca pulando em cima do Nômad */
  nomadMountable = false;
  /** Nômad de apoio: cai do céu após ~1,5 min de jogo e dura ~50 s */
  support: { x: number; y: number; t: number; ready: boolean } | null = null;
  supportClock = 0;
  supportUsed = false;
  supportMounting = false;
  /** portão da garagem: só abre depois de embarcar no Nômad (ele é obrigatório) */
  nomadGate: PropClass | null = null;
  gateHintCd = 0;
  /** hordas frenéticas enquanto se pilota o Nômad */
  hordeT = 0;
  hordeSeq = 0;
  streak = 0;
  streakT = 0;

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
    this.nomadMountable = false;
    this.support = null;
    this.supportClock = 0;
    this.supportUsed = false;
    this.supportMounting = false;
    this.nomadGate = null;
    this.hordeT = 0;
    this.streak = 0;
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
    this.w.camera.zoomTarget = BASE_ZOOM;
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
    if (!this.supportUsed) {
      this.support = null;
      this.supportClock = Math.max(this.supportClock, SUPPORT_AT - 25);
    }
    this.supportMounting = false;
    this.bossActive = false;
    this.bossRef = null;
    this.bossIntroDone = false;
    this.zoomOverride = null;
    this.w.camera.focus = null;
    this.w.camera.lock = null;
    this.w.camera.zoomTarget = BASE_ZOOM;
    this.w.setAlarm(false);
    this.w.rollSound(0);
    // gatilhos de cinemática já concluídos permanecem; o que não concluiu recomeça
    if (!this.w.nomadUsed) {
      this.triggered.delete('nomadMeet');
      this.nomadMountable = false;
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
    const pl = this.w.player;
    if (pl.mounted && pl.nomad && !e.isBoss) {
      // frenesi: cada abate recupera um pouco do Nômad e alimenta a sequência
      pl.nomad.hp = Math.min(pl.nomad.maxHp, pl.nomad.hp + 4);
      this.streak++;
      this.streakT = 3.2;
      if (this.streak >= 5 && this.streak % 5 === 0) {
        this.w.score += this.streak * 20;
        this.w.fx.popup(pl.x, pl.y - 60, `SEQUÊNCIA x${this.streak}!`, '#ffe27a', 11);
      }
    }
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
  onRevive() {
    this.cine = null;
    this.w.camera.focus = null;
    this.w.music(this.w.player.mounted ? 'nomad' : 'combat');
  }
  onPropBroken(p: Prop) {
    void p;
  }
  onNomadMounted() {
    this.nomadWaiting = false;
    this.w.setMusic('nomad');
    this.w.camera.focus = null;
    this.zoomOverride = null;
    this.cine = null;
    if (this.supportMounting) {
      this.supportMounting = false;
      this.supportUsed = true;
      this.support = null;
      const n = this.w.player.nomad;
      if (n) {
        n.timeLeft = n.maxTime = SUPPORT_TIME;
        n.hp = n.maxHp = 200;
      }
      this.banner('NÔMAD DE APOIO', `Emprestado por ${SUPPORT_TIME}s`, 2.6);
      return;
    }
    this.banner('NÔMAD ONLINE', 'Destrua tudo!', 2.6);
    this.openNomadGate();
    this.saveCheckpointHere();
  }
  onNomadLost(temp = false, expired = false) {
    if (temp) this.banner(expired ? 'APOIO ENCERRADO' : 'NÔMAD DE APOIO PERDIDO', 'Continue a pé!', 2.4);
    else this.banner('NÔMAD DESTRUÍDO', 'Continue a pé!', 2.4);
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

    this.updateNomadGate(dt);
    this.updateMountCheck();
    this.updateSupport(dt);
    this.updateHorde(dt);

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

  /** Karimbo pousando em cima (ou encostando + pulo) do Nômad estacionado → embarca. */
  private updateMountCheck() {
    const w = this.w;
    const p = w.player;
    if (!this.nomadMountable || w.nomadUsed || p.mode !== 'foot' || this.cine) return;
    const ns = w.data.nomadSpawn;
    const dx = Math.abs(p.x - ns.x);
    const top = ns.y - 106;
    const feet = p.feetY;
    const onTop = dx < 40 && feet > top - 10 && feet < top + 46 && p.body.vy >= -80;
    const touching = dx < 38 && feet > ns.y - 66 && ctlJumpHeld(w);
    if (onTop || touching) {
      this.nomadMountable = false;
      w.audio('nomadEnter', 1, ns.x);
      p.startMount(w, ns.x, ns.y);
    }
  }

  /** Nômad de apoio: entrega aérea depois de ~90 s; embarca-se pulando em cima, como o principal. */
  private updateSupport(dt: number) {
    const w = this.w;
    const p = w.player;
    // tempo limitado do Nômad emprestado
    if (p.nomad && p.nomad.timeLeft !== Infinity && p.mode === 'nomad') {
      const n = p.nomad;
      const before = n.timeLeft;
      n.timeLeft -= dt;
      if (n.timeLeft < 8 && Math.floor(n.timeLeft) !== Math.floor(before)) w.audio('warning', 0.35);
      if (n.timeLeft <= 0) p.ejectNomad(w, true);
    }
    if (this.supportUsed) return;
    const s = this.support;
    if (!s) {
      const passed = w.nomadUsed || w.nomadLost;
      if (p.mode === 'foot' && !this.cine && !this.insideActiveArena(p.x) && passed) this.supportClock += dt;
      if (this.supportClock < SUPPORT_AT || p.mode !== 'foot' || !p.body.onGround || this.cine || this.insideActiveArena(p.x)) return;
      // longe do chefe (a arena final tem seu próprio ritmo)
      const boss = w.data.arenas.find((a) => a.id === 'boss');
      if (boss && p.x > boss.rect.x - 200) return;
      const spot = this.findSupportSpot();
      if (!spot) return;
      this.support = { x: spot.x, y: spot.y, t: 0, ready: false };
      w.audio('warning', 0.8);
      this.banner('NÔMAD DE APOIO', 'Entrega aérea a caminho!', 2.6);
      return;
    }
    if (!s.ready) {
      if (s.t >= 50) return; // montagem em andamento
      s.t += dt;
      if (s.t >= 1.1) {
        s.ready = true;
        w.audio('nomadEnter', 0.9, s.x);
        w.audio('explosion', 0.5, s.x);
        w.fx.addShake(5, 0.35);
        w.fx.smoke(s.x, s.y - 4, 8, '#8b84a3', 26);
        w.fx.sparks(s.x, s.y - 10, 18, '#ffe27a', 300);
        this.banner('PULE EM CIMA!', 'Nômad de apoio pronto', 2.2);
      }
      return;
    }
    // embarque (mesma regra do Nômad principal)
    if (p.mode !== 'foot' || this.cine) return;
    const dx = Math.abs(p.x - s.x);
    const top = s.y - 106;
    const feet = p.feetY;
    const onTop = dx < 40 && feet > top - 10 && feet < top + 46 && p.body.vy >= -80;
    const touching = dx < 38 && feet > s.y - 66 && ctlJumpHeld(w);
    if (onTop || touching) {
      this.supportMounting = true;
      w.audio('nomadEnter', 1, s.x);
      p.startMount(w, s.x, s.y);
      this.support = { ...s, ready: false, t: 99 }; // fica visível durante a montagem
    }
  }

  private findSupportSpot(): { x: number; y: number } | null {
    const w = this.w;
    const p = w.player;
    const L = w.level;
    const hw = NOMAD_W / 2 + 8;
    for (const off of [120, -120, 170, -170, 90, -90]) {
      const x = p.x + off;
      const gy = L.groundBelow(x, p.feetY - 30, 200);
      if (gy === null) continue;
      if (Math.abs(gy - p.feetY) > 40) continue;
      let ok = true;
      for (const ox of [-hw, 0, hw]) {
        const g2 = L.groundBelow(x + ox, gy - 40, 120);
        if (g2 === null || Math.abs(g2 - gy) > 2) ok = false;
        for (const oy of [10, 40, 76, 110]) if (L.solidAtPx(x + ox, gy - oy)) ok = false;
      }
      if (ok) return { x, y: gy };
    }
    return null;
  }

  /** O portão da garagem fica fechado até o jogador embarcar no Nômad. */
  private updateNomadGate(dt: number) {
    const w = this.w;
    const p = w.player;
    if (this.gateHintCd > 0) this.gateHintCd -= dt;
    // cinemática interrompida (morte/continuar): garante que o Nômad continue embarcável
    if (!w.nomadUsed && !w.nomadLost && this.triggered.has('nomadMeet') && !this.cine && !this.nomadMountable && p.mode === 'foot') {
      this.nomadMountable = true;
      this.nomadPower = 1;
    }
    const need = !w.nomadUsed && !w.nomadLost;
    if (!need) return;
    const g = this.nomadGate;
    if (!g || !g.alive || !w.props.includes(g)) {
      const gx = GATE_TILE * 32 + 16;
      const gy = 32 * 32; // chão principal
      const pr = new PropClass({ id: -900, kind: 'door', x: gx, y: gy, w: 20, h: gy, solid: true, critical: true });
      pr.barrier = true;
      pr.hittable = false;
      w.props.push(pr);
      w.solidsDirty = true;
      this.nomadGate = pr;
    }
    // aviso quando o jogador chega no portão
    if (p.mode === 'foot' && p.x > (GATE_TILE - 9) * 32 && this.gateHintCd <= 0 && !this.cine) {
      this.gateHintCd = 6;
      this.banner('NÔMAD NECESSÁRIO', 'Pule em cima dele para abrir o portão', 2.2);
      w.hooks.onHint?.('mountNomad');
    }
  }

  private openNomadGate() {
    const g = this.nomadGate;
    if (!g) return;
    g.alive = false;
    this.w.fx.sparks(g.x, g.y - 60, 24, '#ffe27a', 380);
    this.w.audio('unlock', 1);
    this.w.solidsDirty = true;
    this.nomadGate = null;
  }

  /** Frenesi: enquanto pilota o Nômad no trecho de guerra, novas levas chegam sem parar. */
  private updateHorde(dt: number) {
    const w = this.w;
    const p = w.player;
    if (this.streakT > 0) {
      this.streakT -= dt;
      if (this.streakT <= 0) this.streak = 0;
    }
    if (p.mode !== 'nomad' || this.cine || this.activeArenaRect() || p.nomad?.timeLeft !== Infinity) return;
    if (p.x < HORDE_FROM * 32 || p.x > HORDE_TO * 32) return;
    this.hordeT -= dt;
    if (this.hordeT > 0) return;
    this.hordeT = 2.3;
    const alive = w.enemies.filter((e) => e.alive && e.spawnedByArena === false && Math.abs(e.x - p.x) < 800).length;
    if (alive >= 9) return;
    const cam = w.camera;
    const n = alive < 4 ? 3 : 2;
    const kinds: EnemySpawn['type'][] = ['rifle', 'rifle', 'shotgun', 'drone', 'spider', 'shield', 'minimech'];
    for (let i = 0; i < n; i++) {
      const type = kinds[(this.hordeSeq * 3 + i * 5 + Math.floor(w.time)) % kinds.length];
      // três quartos da leva chegam pela frente
      const ahead = (this.hordeSeq + i) % 4 !== 0 ? p.facing : -p.facing;
      const x = ahead === 1 ? cam.x + cam.w + 50 + i * 26 : cam.x - 50 - i * 26;
      const flying = type === 'drone';
      let y: number;
      if (flying) y = cam.y + 50 + i * 24;
      else {
        const gy = w.level.groundBelow(x, p.feetY - 120, 500);
        if (gy === null) continue;
        y = gy;
      }
      const s: EnemySpawn = { id: -5000 - (this.hordeSeq++ % 4000), type, x, y, facing: (ahead === 1 ? -1 : 1) as -1 | 1 };
      const e = w.spawnEnemy(s);
      e.spawnedByArena = false;
    }
    this.combatHold = Math.max(this.combatHold, 2.5);
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
      case 'bossWarn':
        w.audio('warning', 1);
        this.banner('ALERTA!', 'Algo enorme se aproxima...', 3);
        w.fx.addShake(3, 0.5);
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
      w.camera.zoomTarget = 1.4;
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
      if (c.stage === 2 && c.t > 3.3) {
        // fim da apresentação: o jogador embarca pulando em cima do Nômad
        this.cine = null;
        this.nomadMountable = true;
        p.lockInput = false;
        w.camera.focus = null;
        w.camera.zoomTarget = BASE_ZOOM;
        w.setMusic('explore');
        w.hooks.onHint?.('mountNomad');
      }
    } else if (c.kind === 'bossIntro') {
      // câmera mostra a entrada do chefe (jogador e chefe no quadro)
      const spawn = w.data.enemies.find((e) => e.type === 'boss')!;
      w.camera.focus = { x: (spawn.x + p.x) / 2, y: spawn.y - 86, rate: 2.6 };
      w.camera.zoomTarget = 0.95;
      if (c.t > 3.8) {
        this.cine = null;
        w.camera.focus = null;
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
      if (a.wave < a.def.waves.length && a.def.id !== 'boss') this.dropSupplies(false);
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
    this.dropSupplies(true);
    w.setMusic(w.player.mounted ? 'nomad' : 'explore');
  }

  // ------------------------------------------------------------------ boss
  /** Suprimentos caem do alto perto do jogador (vida + munição). */
  private dropSupplies(big: boolean) {
    const w = this.w;
    const p = w.player;
    // vida só quando faz falta (ou ao fim da arena)
    if (big) w.spawnDrop('healthBig', p.x - 40, p.y - 100);
    else if (p.hp < p.maxHp * 0.7) w.spawnDrop('health', p.x - 40, p.y - 100);
    w.spawnDrop('ammo', p.x + 40, p.y - 100);
  }

  private startBoss(a: ArenaState) {
    const w = this.w;
    this.bossActive = true;
    this.bossPhase = 1;
    this.bossIntroDone = false;
    w.setMusic('silence');
    w.player.lockInput = true;
    w.player.body.vx = 0;
    this.cine = { kind: 'bossIntro', t: 0, stage: 0 };
    w.camera.zoomTarget = 0.95;
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
    w.camera.zoomTarget = 1.1;
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
      const zoom = 0.98;
      cam.zoomTarget = zoom;
      const vw = cam.viewW / zoom;
      if (b && (b.alive || b.hp > 0)) {
        const mid = p.x + clamp((b.x - p.x) * 0.5, -vw * 0.28, vw * 0.28);
        cam.focus = { x: mid, y: spawn.y - 76, rate: 4.2 };
      } else cam.focus = { x: spawn.x - 200, y: spawn.y - 76, rate: 3 };
      return;
    }
    // zoom padrão: um pouco mais aberto ao pilotar o Nômad
    cam.zoomTarget = this.zoomOverride ?? (w.player.mounted ? BASE_ZOOM - 0.1 : BASE_ZOOM);
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
        if (this.nomadMountable) {
          // seta pulsante: "pule aqui"
          const bob = Math.sin(w.time * 6) * 4;
          const ay = ns.y - 128 + bob;
          g.fillStyle = '#ffe27a';
          g.strokeStyle = '#170f2e';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(ns.x - 9, ay - 12);
          g.lineTo(ns.x + 9, ay - 12);
          g.lineTo(ns.x, ay);
          g.closePath();
          g.stroke();
          g.fill();
        }
      }
    }
    if (w.player.mode === 'mounting' && !this.supportMounting) {
      const ns = w.data.nomadSpawn;
      drawNomadIdle(g, art.nomad, ns.x, ns.y, w.time, 1, 1);
    }
    const sp = this.support;
    if (sp && w.camera.visible(sp.x, sp.y, 200)) {
      if (!sp.ready && sp.t < 50) {
        // casulo em queda livre, com rastro
        const k = Math.min(1, sp.t / 1.1);
        const y = sp.y - (1 - k * k) * 520;
        drawNomadIdle(g, art.nomad, sp.x, y, w.time, 1, 1);
        const spr = glowSprite('#ff8a3a', 32);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.6;
        g.drawImage(spr.c, sp.x - 60, y - 190, 120, 160);
        g.globalAlpha = 0.25;
        g.fillStyle = '#ffb060';
        g.fillRect(sp.x - 3, y - 520, 6, 420);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        // marca no chão
        g.strokeStyle = 'rgba(255,90,60,0.8)';
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(sp.x, sp.y - 1, 46 * (0.5 + k * 0.5), 7, 0, 0, 6.283);
        g.stroke();
      } else {
        drawNomadIdle(g, art.nomad, sp.x, sp.y, w.time, 1, 1);
        if (sp.ready) {
          const bob = Math.sin(w.time * 6) * 4;
          const ay = sp.y - 128 + bob;
          g.fillStyle = '#7ff9ff';
          g.strokeStyle = '#170f2e';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(sp.x - 9, ay - 12);
          g.lineTo(sp.x + 9, ay - 12);
          g.lineTo(sp.x, ay);
          g.closePath();
          g.stroke();
          g.fill();
        }
      }
    }
    if (w.parkedNomad) {
      const pn = w.parkedNomad;
      drawNomadIdle(g, art.nomad, pn.x, pn.y, w.time, pn.facing, 0.3);
    }
  }

  drawBarriers(g: CanvasRenderingContext2D) {
    const t = this.w.time;
    const all: PropClass[] = [];
    for (const a of this.arenas) all.push(...a.barriers);
    if (this.nomadGate && this.nomadGate.alive) all.push(this.nomadGate);
    {
      for (const b of all) {
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
