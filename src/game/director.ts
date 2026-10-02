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
import { BASE_ZOOM, EXPLORE_ZOOM, MIN_THREAT_ZOOM, SWING_ZOOM } from './camera';
import { glowSprite } from '../art/kit';
import { drawDeco, resetDecoBudget } from '../art/decor';
import { drawSpr } from '../art/kit';
import { INTRO_TOTAL, INTRO_DROP, INTRO_COMIC, INTRO_COMIC_LEN, type IntroOverlay } from './bossIntro';
import type { Felipao } from './enemies/felipao';
import { OPEN_BEATS } from './narrator';

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
  kind: 'nomad' | 'bossDeath' | 'bossIntro' | 'opening' | 'soldier';
  t: number;
  stage: number;
  /** entrada longa do chefe (primeira vez da partida, guiada pelo áudio) */
  long?: boolean;
  /** quando o Felipão pousou (entrada longa) */
  landT?: number;
  /** a HQ foi entregue ao jogo (hook) e já terminou */
  comicHooked?: boolean;
  comicDone?: boolean;
  /** tremor/poeira da entrada (ritmo próprio) */
  fxT?: number;
  beat?: number;
}

/** Faixa de energia das barreiras (degradê horizontal), desenhada uma vez. */
let barrierC: HTMLCanvasElement | null = null;
function barrierStrip() {
  if (barrierC) return barrierC;
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 2;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 40, 0);
  grd.addColorStop(0, 'rgba(60,240,255,0)');
  grd.addColorStop(0.5, 'rgba(90,240,255,0.55)');
  grd.addColorStop(1, 'rgba(60,240,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 40, 2);
  barrierC = c;
  return c;
}

/** batidas do suspense: [tempo, céu piscando, flash vermelho] */
const SUSPENSE_BEATS: [number, number, number][] = [
  [0.45, 0.5, 0.05],
  [1.3, 0.9, 0.08],
  [2.05, 0.6, 0.05],
  [2.6, 1, 0.1],
  [3.1, 0.8, 0.08],
];

export const SUPPORT_AT = 90; // s de jogo (a pé, fora de arenas) até a entrega do Nômad de apoio
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
  /** Sorteado uma vez por partida: o Nômad extra é opcional. */
  supportWillArrive = true;
  supportMounting = false;
  /** portão da garagem: só abre depois de embarcar no Nômad (ele é obrigatório) */
  nomadGate: PropClass | null = null;
  gateHintCd = 0;
  /** relâmpago no céu pedido pela cinemática (o jogo consome e zera) */
  skyPulse = 0;
  /** rachaduras do pouso do Felipão (decalques no chão) */
  cracks: { x: number; y: number }[] = [];
  /** arte da entrada (posta pelo jogo; nos testes fica nula) */
  introArt: IntroOverlay | null = null;
  /** hordas frenéticas enquanto se pilota o Nômad */
  hordeT = 0;
  hordeSeq = 0;
  streak = 0;
  streakT = 0;

  /** onde o Felipão nasce (consultado todo quadro na luta: guardado em vez de procurar na lista) */
  private _bossSpawn: EnemySpawn | null = null;
  get bossSpawn(): EnemySpawn {
    if (!this._bossSpawn) this._bossSpawn = this.w.data.enemies.find((e) => e.type === 'boss')!;
    return this._bossSpawn;
  }
  /** limpeza periódica das hordas que ficaram para trás */
  private hordeGcT = 0;

  /** portão da garagem (tile) e trecho das hordas do Nômad — derivados da fase */
  private gateTile = 0;
  private hordeFrom = 0;
  private hordeTo = 0;
  private enemySpawnById = new Map<number, EnemySpawn>();
  private firstSoldier: EnemySpawn | null = null;
  /** câmera aberta do balanço nos cipós (1 = aberta; cai ao pisar no chão) */
  private swingCamT = 0;
  /** decorações de primeiro plano com paralaxe (poucas: percorridas direto) */
  private parDecos: number[] = [];
  /** Busca espacial das decorações; a ordenação original é preservada ao desenhar. */
  private decoBuckets = { back: new Map<number, number[]>(), front: new Map<number, number[]>() };

  constructor(w: World) {
    this.w = w;
    for (const spawn of w.data.enemies) this.enemySpawnById.set(spawn.id, spawn);
    const shootX = w.data.triggers.find((t) => t.id === 'hint:shoot')?.rect.x ?? 0;
    this.firstSoldier = w.data.enemies
      .filter((e) => !e.arena && e.type === 'rifle' && e.x >= shootX)
      .reduce<EnemySpawn | null>((best, e) => !best || e.x < best.x ? e : best, null);
    w.data.decos.forEach((d, i) => {
      if (d.par) {
        this.parDecos.push(i);
        return;
      }
      const key = Math.floor(d.x / 512);
      const buckets = this.decoBuckets[d.layer];
      const list = buckets.get(key) ?? [];
      list.push(i);
      buckets.set(key, list);
    });
    this.gateTile = Math.floor(w.data.nomadSpawn.x / 32) + 36;
    this.hordeFrom = this.gateTile + 4;
    const dm = w.data.triggers.find((t) => t.id === 'dismount');
    this.hordeTo = dm ? Math.floor(dm.rect.x / 32) - 6 : this.hordeFrom + 440;
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
    this.supportWillArrive = this.w.data.stage !== 2 && Math.random() < 0.5;
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
    this.cracks.length = 0;
    this.skyPulse = 0;
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
    if (this.cine?.long) this.w.hooks.onBossIntroEnd?.();
    this.cine = null;
    this.w.player.lockInput = false;
    this.cracks.length = 0;
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
  /** Zona de guerra ativa (não o chefe): quantos faltam abater, onda atual e inimigos vivos. */
  warZone(): { remaining: number; wave: number; waves: number; enemies: Enemy[]; waiting: boolean } | null {
    for (const a of this.arenas) {
      if (a.status !== 'active' || a.def.id === 'boss') continue;
      const alive = a.alive.filter((e) => e.alive);
      let remaining = alive.length;
      const from = a.wave + (a.waveSpawned ? 1 : 0);
      for (let i = from; i < a.def.waves.length; i++) remaining += a.def.waves[i].spawns.filter((_, j) => this.waveEnemyEnabled(a, j)).length;
      return { remaining, wave: Math.min(a.wave + 1, a.def.waves.length), waves: a.def.waves.length, enemies: alive, waiting: !a.waveSpawned };
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
      // frenesi preserva o combo, sem regenerar a blindagem por abate
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
        n.hp = n.maxHp = 270;
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
    w.blockBehind(idx);
    w.hooks.onCheckpoint?.(idx);
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

    if (w.data.stage !== 2) {
      this.updateNomadGate(dt);
      this.updateMountCheck();
      this.updateSupport(dt);
      this.updateHorde(dt);
    } else if (this.finishTimer < 0 && !w.finished && w.data.finishX > 0 && p.x >= w.data.finishX && p.mode !== 'dead') {
      // selva (prévia): a saída do acampamento encerra a fase
      this.banner('FIM DA PRÉVIA', 'A selva continua... (fase 2 em construção)', 3.5);
      w.setMusic('victory');
      w.audio('victory', 1);
      this.finishTimer = 3.2;
    }

    // dica sutil do segundo avanço
    this.updateDashHint();

    // fim de fase
    if (this.finishTimer >= 0) {
      // a tela de resultados espera o narrador terminar a fala da vitória
      if (!w.narrator.pending(28)) this.finishTimer -= dt;
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
  /** voz do Karimbo no pouso do apoio, adiada enquanto o narrador fala (s restantes de espera) */
  private supportVoiceT = 0;

  private updateSupport(dt: number) {
    const w = this.w;
    const p = w.player;
    if (this.supportVoiceT > 0) {
      this.supportVoiceT -= dt;
      if (!w.narrator.busy()) {
        this.supportVoiceT = 0;
        w.voice('karimboNomad');
      }
    }
    // tempo limitado do Nômad emprestado
    if (p.nomad && p.nomad.timeLeft !== Infinity && p.mode === 'nomad') {
      const n = p.nomad;
      const before = n.timeLeft;
      n.timeLeft -= dt;
      if (n.timeLeft < 8 && Math.floor(n.timeLeft) !== Math.floor(before)) w.audio('warning', 0.35);
      if (n.timeLeft <= 0) p.ejectNomad(w, true);
    }
    if (this.supportUsed || !this.supportWillArrive) return;
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
        if (w.narrator.busy()) this.supportVoiceT = 6;
        else w.voice('karimboNomad');
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
      const gx = this.gateTile * 32 + 16;
      const gy = 32 * 32; // chão principal
      const pr = new PropClass({ id: -900, kind: 'door', x: gx, y: gy, w: 20, h: gy, solid: true, critical: true });
      pr.barrier = true;
      pr.hittable = false;
      w.props.push(pr);
      w.solidsDirty = true;
      this.nomadGate = pr;
    }
    // aviso quando o jogador chega no portão
    if (p.mode === 'foot' && p.x > (this.gateTile - 9) * 32 && p.x < (this.gateTile + 2) * 32 && this.gateHintCd <= 0 && !this.cine) {
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
    // inimigos das hordas que ficaram muito para trás (fora da tela) saem do mundo: antes se
    // acumulavam (~90) e eram percorridos por vários laços a cada quadro
    this.hordeGcT -= dt;
    if (this.hordeGcT <= 0) {
      this.hordeGcT = 1.5;
      const list = w.enemies;
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (e.spawn.id <= -5000 && Math.abs(e.x - p.x) > 1700 && !w.camera.visible(e.x, e.y, 200)) {
          e.alive = false;
          list.splice(i, 1);
        }
      }
    }
    if (p.mode !== 'nomad' || this.cine || this.activeArenaRect() || p.nomad?.timeLeft !== Infinity) return;
    if (p.x < this.hordeFrom * 32 || p.x > this.hordeTo * 32) return;
    this.hordeT -= dt;
    if (this.hordeT > 0) return;
    this.hordeT = 2.3;
    const alive = w.enemies.filter((e) => e.alive && e.spawnedByArena === false && Math.abs(e.x - p.x) < 800).length;
    if (alive >= 9) return;
    const cam = w.camera;
    const n = alive < 4 ? 3 : 2;
    const kinds: EnemySpawn['type'][] = ['rifle', 'rifle', 'shotgun', 'drone', 'roller', 'spider', 'shield', 'minimech', 'roller'];
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
      case 'soldierMeet':
        if (this.firstSoldier && w.player.mode === 'foot' && !this.cine && !w.killedEnemies.has(this.firstSoldier.id) && !w.narrator.played.has(2)) {
          this.cine = { kind: 'soldier', t: 0, stage: 0 };
          w.player.lockInput = true;
          w.player.body.vx = 0;
          // Disparos lançados antes da trava não podem atingir o soldado durante a fala.
          w.bullets = w.bullets.filter((b) => b.team !== 0);
          w.grenades = w.grenades.filter((g) => g.team !== 0);
          w.narrator.request(2, 15, undefined, 3);
        }
        break;
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
    if (c.kind === 'soldier') {
      const soldier = this.firstSoldier;
      if (!soldier) { this.endSoldierMeet(); return; }
      w.camera.focus = { x: soldier.x - 150, y: soldier.y - 65, rate: 3.2 };
      w.camera.zoomTarget = 0.9;
      p.lockInput = true;
      p.body.vx = 0;
      // Espera a decodificação e depois a duração real do áudio, mesmo além da estimativa.
      const nr = w.narrator;
      if (!nr.played.has(2) && nr.pending(2)) return;
      if (!nr.busy()) this.endSoldierMeet();
    } else if (c.kind === 'nomad') {
      const ns = w.data.nomadSpawn;
      w.camera.focus = { x: ns.x - 20, y: ns.y - 64, rate: 3.2 };
      w.camera.zoomTarget = 1.4;
      p.body.vx = 0;
      // a voz do Karimbo nunca cruza com o narrador: a cena segura até ele terminar
      if (c.stage === 0 && c.t > 0.7 && w.narrator.busy()) c.t = 0.7;
      if (c.stage === 0 && c.t > 0.7) {
        c.stage = 1;
        w.audio('nomadBoot', 1);
        // voz do Karimbo ao encontrar o Nômad (no momento em que ele liga)
        w.voice('karimboNomad');
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
    } else if (c.kind === 'opening') {
      this.updateOpening(dt, c);
    } else if (c.kind === 'bossIntro' && c.long) {
      this.updateLongIntro(dt, c);
    } else if (c.kind === 'bossIntro') {
      // câmera mostra a entrada do chefe (jogador e chefe no quadro)
      const spawn = this.bossSpawn;
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

  soldierIntroActive() {
    return this.cine?.kind === 'soldier';
  }

  private endSoldierMeet() {
    this.cine = null;
    this.w.player.lockInput = false;
    this.w.camera.focus = null;
    this.w.camera.zoomTarget = BASE_ZOOM;
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

  private waveEnemyEnabled(a: ArenaState, index: number) {
    return a.def.id === 'boss' || this.w.player.mounted || index % 4 !== 3;
  }

  private spawnWave(a: ArenaState) {
    const w = this.w;
    a.waveSpawned = true;
    const wave = a.def.waves[a.wave];
    if (!wave) return;
    const cam = w.camera;
    for (let i = 0; i < wave.spawns.length; i++) {
      if (!this.waveEnemyEnabled(a, i)) continue;
      const id = wave.spawns[i];
      const sp = this.enemySpawnById.get(id);
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
    // último abate em câmera lenta
    w.fx.slowmo = 0.5;
    w.fx.slowScale = 0.3;
    w.fx.addFlash(0.2, '#ffffff');
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
    // entrada longa (áudio + HQ) só na primeira vez da partida; ao continuar/voltar, a curta
    const long = !w.comicShown;
    if (long) w.comicShown = true;
    // chegou no chefe: +3 vidas extras (uma vez por partida)
    let livesNow = false;
    if (!w.bossLivesGiven) {
      w.bossLivesGiven = true;
      w.lives += 3;
      livesNow = true;
    }
    this.bossActive = true;
    this.bossPhase = 1;
    this.bossIntroDone = false;
    w.setMusic('silence');
    w.player.lockInput = true;
    w.player.body.vx = 0;
    if (long) {
      // se o narrador estiver falando ("presença pesada..."), a cena segura no suspense até ele
      // terminar; só então o áudio da entrada começa (as vozes nunca se cruzam)
      const wait = w.narrator.busy();
      w.narrator.queue.length = 0;
      this.cine = { kind: 'bossIntro', t: 0, stage: wait ? -1 : 0, long: true, fxT: 0, beat: 0 };
      this.introLives = livesNow;
      // nada de tiros inimigos voando durante a entrada
      w.bullets = w.bullets.filter((b) => b.team === 0);
      w.grenades = w.grenades.filter((g) => g.team === 0);
      w.camera.zoomTarget = 0.95;
      if (!wait) {
        w.audio('warning', 0.7);
        w.hooks.onBossIntro?.();
      }
      return;
    }
    if (livesNow) {
      w.after(4.2, () => {
        w.audio('extraLife', 1);
        this.banner('+3 VIDAS!', 'Bônus para enfrentar o Felipão', 2.2);
      });
    }
    this.cine = { kind: 'bossIntro', t: 0, stage: 0 };
    w.camera.zoomTarget = 0.95;
    w.after(0.8, () => {
      this.spawnBoss(a);
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
  private introLives = false;

  private bossArena(): ArenaState | undefined {
    return this.arenas.find((x) => x.def.id === 'boss');
  }

  private spawnBoss(a: ArenaState | undefined): Enemy {
    const w = this.w;
    const sp = this.bossSpawn;
    const e = w.spawnEnemy({ ...sp, arena: 'boss' });
    this.bossRef = e;
    if (a) {
      a.alive.push(e);
      a.bossEnemy = e;
    }
    return e;
  }

  // ------------------------------------------------------------------ abertura (narrador)
  /**
   * Abertura dramática na primeira partida: letreiro de cinema, câmera passeando pelas ruínas e
   * voltando ao herói no ritmo da fala 1 ("O homem. A lenda. As orelhas. ... Karimbo!").
   */
  startOpening() {
    const w = this.w;
    this.cine = { kind: 'opening', t: 0, stage: 0, fxT: 0, beat: 0 };
    w.player.lockInput = true;
    w.player.body.vx = 0;
    w.narrator.request(1, 22, undefined, 3);
  }
  openingActive() {
    return this.cine?.kind === 'opening';
  }
  /** Tempo da abertura (−1 fora dela). */
  openingTime() {
    return this.cine?.kind === 'opening' ? this.cine.t : -1;
  }
  /** O relógio do áudio da fala 1 manda na cena. */
  syncOpening(audioT: number) {
    const c = this.cine;
    if (c?.kind !== 'opening' || audioT < 0) return;
    if (Math.abs(audioT - c.t) > 0.05) c.t = audioT;
  }
  skipOpening() {
    if (!this.openingActive()) return;
    this.w.narrator.stop();
    this.endOpening();
  }
  private endOpening() {
    const w = this.w;
    this.cine = null;
    w.player.lockInput = false;
    w.camera.focus = null;
  }
  private updateOpening(dt: number, c: Cine) {
    const w = this.w;
    const p = w.player;
    const cam = w.camera;
    const nr = w.narrator;
    p.lockInput = true;
    p.body.vx = 0;
    // a fala ainda não começou (áudio terminando de decodificar): espera até tocar
    if (!nr.played.has(1)) {
      c.t = 0;
      if (!nr.pending(1)) this.endOpening(); // áudio indisponível: não prende a partida
      return;
    }
    const t = c.t;
    const B = OPEN_BEATS;
    if (t < B.hero) {
      // passeio pela cidade em ruínas, à frente do herói, voltando devagar
      const k = t / B.hero;
      cam.focus = { x: p.x + 820 - k * 620, y: p.y - 80, rate: 1.6 };
      cam.zoomTarget = 0.9;
    } else if (t < B.man) {
      cam.focus = { x: p.x + 30, y: p.y - 30, rate: 2.6 };
      cam.zoomTarget = 1.15;
    } else if (t < B.legend) {
      cam.focus = { x: p.x + 16, y: p.y - 24, rate: 4 };
      cam.zoomTarget = 1.32;
    } else if (t < B.ears) {
      cam.focus = { x: p.x + 8, y: p.y - 18, rate: 4 };
      cam.zoomTarget = 1.5;
    } else if (t < B.name) {
      // "As orelhas." — close nas orelhas
      cam.focus = { x: p.x, y: p.y - 12, rate: 4.5 };
      cam.zoomTarget = 1.85;
    } else {
      cam.focus = { x: p.x + 60, y: p.y - 30, rate: 3 };
      cam.zoomTarget = 1.27;
    }
    const beat = c.beat ?? 0;
    const beats = [B.man, B.legend, B.ears, B.name];
    if (beat < beats.length && t >= beats[beat]) {
      c.beat = beat + 1;
      if (beat < 2) {
        w.fx.addShake(2, 0.15);
        w.fx.addFlash(0.07, '#ffffff');
      } else if (beat === 2) {
        p.earPop(1);
        w.fx.addShake(1.5, 0.12);
      } else {
        // "Karimbo!"
        w.fx.addShake(5, 0.35);
        w.fx.addFlash(0.35, '#fff2c0');
        w.fx.add(PK.Ring, p.x, p.y - 30, 0, 0, 0.45, 10, '#ffe27a', { size1: 120, a0: 0.9, front: true });
        w.fx.sparks(p.x, p.y - 40, 18, '#ffe27a', 260);
        w.audio('slam', 0.6);
        p.earPop(1.4);
      }
    }
    if (!nr.busy() && t > B.name) this.endOpening();
  }

  /** Entrada longa em andamento (o jogo esconde o HUD, trava o jogador e permite pular). */
  longIntroActive() {
    return !!this.cine && this.cine.kind === 'bossIntro' && !!this.cine.long;
  }
  /** Tempo da entrada longa (−1 fora dela). */
  introTime() {
    return this.cine?.long ? this.cine.t : -1;
  }
  /** Quando o Felipão pousou na entrada longa (−1 se ainda não). */
  introLandT() {
    return this.cine?.long ? this.cine.landT ?? -1 : -1;
  }
  /** Mantém a cena sincronizada com o áudio (o relógio do áudio manda). */
  syncIntro(audioT: number) {
    const c = this.cine;
    if (!c?.long || c.stage >= 3) return;
    if (Math.abs(audioT - c.t) > 0.05) c.t = Math.min(audioT, INTRO_COMIC);
  }
  /** O jogo terminou de mostrar a HQ: a luta começa. */
  onComicDone() {
    const c = this.cine;
    if (c?.long) c.comicDone = true;
  }

  private updateLongIntro(dt: number, c: Cine) {
    const w = this.w;
    const p = w.player;
    const sp = this.bossSpawn;
    const t = c.t;
    p.body.vx = 0;
    p.lockInput = true;
    const cam = w.camera;
    if (c.stage === -1) {
      // ---- esperando o narrador terminar: travado, câmera no palco, tremor leve
      c.t = 0;
      cam.focus = { x: p.x + Math.min((sp.x - p.x) * 0.5, cam.w * 0.28), y: sp.y - 62, rate: 2 };
      cam.zoomTarget = 0.97;
      c.fxT = (c.fxT ?? 0) - dt;
      if (c.fxT <= 0) {
        c.fxT = 0.5;
        w.fx.addShake(0.8, 0.2);
      }
      if (!w.narrator.busy()) {
        c.stage = 0;
        c.fxT = 0;
        w.audio('warning', 0.7);
        w.hooks.onBossIntro?.();
      }
      return;
    }
    if (c.stage === 0) {
      // ---- suspense: o Felipão ainda não aparece
      const k = clamp(t / INTRO_DROP, 0, 1);
      // jogador sempre no quadro, olhando para onde o chefe vai cair
      cam.focus = { x: p.x + Math.min((sp.x - p.x) * 0.5, cam.w * 0.28), y: sp.y - 62 - k * 18, rate: 2.2 };
      cam.zoomTarget = 0.97 - 0.08 * k;
      c.fxT = (c.fxT ?? 0) - dt;
      if (c.fxT <= 0) {
        c.fxT = 0.12;
        w.fx.addShake(0.6 + 4.6 * k * k, 0.18);
      }
      // poeira e cascalho caindo do alto
      let n = (8 + 34 * k) * dt * w.fx.density;
      while (n > 0) {
        if (Math.random() < n) {
          const x = cam.x + Math.random() * cam.w;
          w.fx.add(PK.Dust, x, cam.y - 6, rand.spread(14), rand.range(70, 150), rand.range(1.1, 1.8), rand.range(4, 7), '#a89cb8', { size1: 2, a0: 0.7, drag: 0.1 });
          if (k > 0.45 && Math.random() < 0.25) w.fx.debris(x, cam.y - 4, 1, ['#3a3350', '#5a4f70'], 40);
        }
        n -= 1;
      }
      // céu e luzes piscando
      const beat = c.beat ?? 0;
      if (beat < SUSPENSE_BEATS.length && t >= SUSPENSE_BEATS[beat][0]) {
        const [, sky, red] = SUSPENSE_BEATS[beat];
        c.beat = beat + 1;
        this.skyPulse = Math.max(this.skyPulse, sky);
        w.fx.addFlash(red, '#ff2a3a');
        if (beat === 1) w.audio('thunder', 0.7);
        if (beat === 3) w.audio('warning', 0.55);
      }
      if (t >= INTRO_DROP) {
        c.stage = 1;
        c.beat = SUSPENSE_BEATS.length;
        const e = this.spawnBoss(this.bossArena()) as Felipao;
        e.introHold = true;
        w.audio('thruster', 1);
        w.fx.addShake(5, 0.4);
      }
    } else if (c.stage === 1) {
      // ---- caindo do céu: a câmera espera no ponto de pouso e ele entra pelo alto do quadro
      const b = this.bossRef as Felipao | null;
      cam.focus = { x: sp.x - 40, y: sp.y - 80, rate: 4 };
      cam.zoomTarget = 1;
      if (!b || b.state !== 'enter' || t > INTRO_DROP + 2.2) {
        if (b) b.skipEnter();
        c.stage = 2;
        c.landT = t;
        this.bossLanded();
      }
    } else if (c.stage === 2) {
      // ---- revelação: zoom lento, reator/aura/canhões acendendo
      const b = this.bossRef as Felipao | null;
      const lt = c.landT ?? t;
      const k = clamp((t - lt) / Math.max(0.5, INTRO_COMIC - lt), 0, 1);
      const ease = k * k * (3 - 2 * k);
      cam.focus = { x: sp.x - 30 + (p.x - sp.x) * 0.12 * (1 - ease), y: sp.y - 76, rate: 1.8 };
      cam.zoomTarget = 1.02 + 0.4 * ease;
      if (b) b.introPower = clamp((t - lt - 0.35) / 1.5, 0, 1);
      const beat = c.beat ?? 0;
      const B = SUSPENSE_BEATS.length;
      if (beat === B && t > lt + 0.75) {
        c.beat = beat + 1;
        w.audio('bossRoar', 1);
        w.fx.addShake(7, 0.7);
        w.fx.addFlash(0.25, '#ffe2b0');
        this.skyPulse = 1;
      } else if (beat === B + 1 && t > lt + 1.7) {
        // canhões se armando
        c.beat = beat + 1;
        w.audio('servo', 1);
        w.audio('laserCharge', 0.8);
        if (b) w.fx.sparks(b.x, b.y - 90, 14, '#ffd27a', 260);
      } else if (beat === B + 2 && t > lt + 2.6) {
        c.beat = beat + 1;
        if (b) b.doBurp(w, true);
      }
      if (t >= INTRO_COMIC) {
        // ---- HQ dos dois se encarando (o jogo congela o mundo enquanto passa)
        c.stage = 3;
        c.comicHooked = !!w.hooks.onBossComic;
        w.hooks.onBossComic?.(INTRO_COMIC_LEN);
      }
    } else if (c.comicHooked ? c.comicDone : t >= INTRO_TOTAL) {
      // sem jogo por cima (testes/sem tela), a HQ "passa" pelo tempo dos áudios
      this.finishBossIntro();
    }
  }

  /** Pouso do Felipão na entrada: chão racha, onda de choque e flash. */
  private bossLanded() {
    const w = this.w;
    const sp = this.bossSpawn;
    const x = this.bossRef ? this.bossRef.x : sp.x;
    this.cracks.length = 0;
    this.cracks.push({ x, y: sp.y });
    w.fx.addShake(14, 0.9);
    w.fx.addFlash(0.6, '#ffffff');
    w.fx.add(PK.Ring, x, sp.y - 6, 0, 0, 0.7, 14, '#ffd27a', { size1: 280, a0: 0.9, front: true });
    w.fx.add(PK.Ring, x, sp.y - 6, 0, 0, 0.45, 10, '#ffffff', { size1: 170, a0: 1, front: true });
    w.fx.debris(x, sp.y - 4, 18, ['#59628a', '#3a4064', '#ff8a2a'], 420);
    w.fx.sparks(x, sp.y - 6, 26, '#ffd27a', 420);
    w.fx.smoke(x, sp.y - 10, 10, '#4d4560', 30, 30, 1.6);
    w.audio('bigExplosion', 0.8);
    this.skyPulse = 1;
  }

  /** Fim da entrada longa: a luta começa (música do chefe, controle de volta). */
  private finishBossIntro() {
    const w = this.w;
    const c = this.cine;
    if (!c?.long) return;
    let b = this.bossRef as Felipao | null;
    if (!b) {
      b = this.spawnBoss(this.bossArena()) as Felipao;
      b.skipEnter();
      this.bossLanded();
    }
    b.skipEnter();
    b.introHold = false;
    b.introPower = 0;
    this.cine = null;
    // corte seco (a HQ termina num flash): enquadramento da luta, com o Karimbo no quadro
    const cam = w.camera;
    cam.focus = null;
    cam.zoom = cam.zoomTarget = 0.98;
    cam.snapTo(w.player.x, w.player.y, w.player.x <= b.x ? 1 : -1);
    this.bossIntroDone = true;
    w.player.lockInput = false;
    w.setMusic('boss1');
    w.fx.addFlash(0.35, '#ffffff');
    if (this.introLives) {
      this.introLives = false;
      w.audio('extraLife', 1);
      this.banner('+3 VIDAS!', 'Bônus para enfrentar o Felipão', 2.2);
    }
    w.hooks.onBossIntroEnd?.();
  }

  /** Toque/tiro/pulo: pula a sequência inteira e vai direto para a luta. */
  skipBossIntro() {
    if (!this.longIntroActive()) return;
    this.finishBossIntro();
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
      const spawn = this.bossSpawn;
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
    // Câmera dinâmica:
    //  • exploração → mais perto do personagem
    //  • combate → zoom padrão
    //  • atiradores fora da tela → abre o zoom e desloca o quadro para mostrá-los
    const p = w.player;
    const explore = this.combatHold <= 0 && !this.activeArenaRect();
    let zoom = explore ? EXPLORE_ZOOM : BASE_ZOOM;
    if (p.mounted) zoom -= 0.1;
    // balançando nos cipós: câmera bem mais aberta (mostra o próximo cipó e o abismo); segura
    // aberta no voo entre um cipó e outro e só fecha quando ele pisa no chão de novo
    if (p.vine) this.swingCamT = 1;
    else if (p.body.onGround) this.swingCamT = Math.max(0, this.swingCamT - 1 / 50);
    if (this.swingCamT > 0) zoom = Math.min(zoom, SWING_ZOOM);
    for (let i = w.threats.length - 1; i >= 0; i--) if (w.time - w.threats[i].t >= 2.6) w.threats.splice(i, 1);
    cam.threat = null;
    if (w.threats.length && p.mode !== 'dead') {
      let x0 = p.x, x1 = p.x, y0 = p.y - 40, y1 = p.y;
      for (const t of w.threats) {
        x0 = Math.min(x0, t.x);
        x1 = Math.max(x1, t.x);
        y0 = Math.min(y0, t.y);
        y1 = Math.max(y1, t.y);
      }
      const needW = x1 - x0 + 190;
      const needH = y1 - y0 + 170;
      zoom = Math.max(MIN_THREAT_ZOOM, Math.min(zoom, BASE_ZOOM, cam.viewW / needW, cam.viewH / needH));
      cam.threat = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    }
    cam.zoomTarget = this.zoomOverride ?? zoom;
    cam.focus = null;
  }

  // ------------------------------------------------------------------ desenho
  drawDecos(g: CanvasRenderingContext2D, layer: 'back' | 'front') {
    if (layer === 'back') resetDecoBudget(2);
    const cam = this.w.camera;
    const t = this.w.time;
    const decos = this.w.data.decos as DecoSpawn[];
    const smashed = this.w.smash.smashed;
    const visible: number[] = [];
    const buckets = this.decoBuckets[layer];
    const left = Math.floor((cam.x - 200) / 512);
    const right = Math.floor((cam.x + cam.w + 200) / 512);
    for (let key = left; key <= right; key++) {
      const list = buckets.get(key);
      if (list) visible.push(...list);
    }
    visible.sort((a, b) => a - b);
    for (const i of visible) {
      const d = decos[i];
      if (d.x < cam.x - 200 || d.x > cam.x + cam.w + 200) continue;
      if (smashed.has(i)) continue;
      drawDeco(g, d, t);
    }
    if (layer === 'front' && this.parDecos.length) {
      // primeiro plano "perto da câmera": desloca-se mais rápido que o mundo (profundidade)
      const cx = cam.x + cam.w / 2;
      const cy = cam.y + cam.h / 2;
      for (const i of this.parDecos) {
        const d = decos[i];
        const par = d.par!;
        const ox = (d.x - cx) * par;
        if (Math.abs(d.x + ox - cx) > cam.w / 2 + 320) continue;
        // o que pende do alto fica preso na altura; o que nasce do chão também sobe/desce com a câmera
        const oy = d.kind === 'pPillar' || d.kind === 'pLeaves' ? (d.y - cy) * par * 0.6 : 0;
        g.save();
        g.translate(ox, oy);
        drawDeco(g, d, t);
        g.restore();
      }
    }
    if (layer === 'back') {
      for (const d of this.w.smash.extra) {
        if (d.x < cam.x - 200 || d.x > cam.x + cam.w + 200) continue;
        drawDeco(g, d, t);
      }
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
    // sem listas temporárias nem gradiente por quadro (faixa de energia pré-desenhada)
    for (const a of this.arenas) for (const b of a.barriers) this.drawBarrier(g, b);
    if (this.nomadGate && this.nomadGate.alive) this.drawBarrier(g, this.nomadGate);
  }

  private drawBarrier(g: CanvasRenderingContext2D, b: PropClass) {
    const t = this.w.time;
    const x = b.x;
    const top = b.y - b.h / 2;
    if (!this.w.camera.visible(x, top + b.h / 2, b.h / 2 + 40)) return;
    g.globalCompositeOperation = 'lighter';
    g.drawImage(barrierStrip(), x - 10, top, 20, b.h);
    g.fillStyle = 'rgba(200,255,255,0.7)';
    const n = Math.floor(b.h / 24);
    for (let i = 0; i < n; i++) {
      const yy = top + ((i * 24 + t * 60) % b.h);
      g.fillRect(x - 1.5, yy, 3, 8);
    }
    g.globalCompositeOperation = 'source-over';
  }

  drawWorldOverlays(g: CanvasRenderingContext2D) {
    // rachaduras do pouso do Felipão (somem onde o chão desabou)
    const spr = this.introArt?.crack;
    if (!spr || !this.cracks.length) return;
    const L = this.w.level;
    for (const ck of this.cracks) {
      if (!this.w.camera.visible(ck.x, ck.y, 140)) continue;
      if (!L.solidAtPx(ck.x, ck.y + 4)) continue;
      drawSpr(g, spr, ck.x, ck.y, {});
    }
  }
}
