import { Level, T, TILE, type LevelData, type EnemySpawn, type EnemyType, type PickupKind } from './level';
import { difficulty, setStageScale } from '../core/difficulty';
import { Fx, PK } from './fx';
import { Camera } from './camera';
import { Player } from './player';
import { Bullet, Grenade, type BulletOpts, type BulletKind } from './bullets';
import { Prop, pickLoot } from './props';
import { Pickup } from './pickups';
import { updateWreckEffects } from './wreckEffects';
import type { Enemy, HurtInfo } from './enemies/enemy';
import { createEnemy } from './enemies';
import { Smasher } from './smash';
import { Director } from './director';
import { audio as audioEngine, type SfxName, type ClipName, type ClipHandle } from '../core/audio';
import { clamp, rand, type Rect } from '../core/math';
import type { ControlState } from '../core/input';
import { WEAPON_ORDER, type WeaponId } from './weapons';
import { progress, saveProgress, settings } from '../core/storage';
import { collectCoin, grantSkin } from '../core/skins';
import { getArt } from '../art';
import { drawNomadIdle } from '../art/nomad';
import { softDot, drawSpr } from '../art/kit';
import { Corpse } from './corpse';
import { Crowd } from './civilians';
import { Narrator } from './narrator';
import { music, JUNGLE_MELODY, STAGE_MELODY } from '../core/music';
import { Waters } from './water';
import { LakeMap } from './lake/lakeMap';
import type { MinigameId, MinigameOpts, MinigameResult } from './minigames/types';
import { ThinkerScene } from './lake/thinkerReveal';
import { LetterScene } from './letterScene';
import { drawLetterScene } from '../art/letterActors';
import { piranhasAggro } from './enemies/piranha';
import { JungleWildlife } from './wildlife';
import { Village } from './village';
import { Merchant } from './merchant';
import { ClubScene } from './club';
import { drawClub } from '../art/club';
import { Exploration } from './exploration';
import { drawExploration } from '../art/exploration';
import { Encounters } from './encounters';
import { Vine } from './vines';
import type { DoorSpawn } from './level';
import { drawWaterBack, drawWaterFront, drawDeepLights } from '../art/waterDraw';
import { drawBlockade, COLLAPSE_SHAKE, COLLAPSE_FALL } from '../art/blockade';
import { setDecoFocus } from '../art/jungleDecor';
import { drawVines, drawRoomBack, drawRoomDark, drawDoorPrompt, drawDrums, drawBeams } from '../art/jungleWorld';
import { ForestLight } from './forestLight';
import { InteriorStore } from './interiorStore';
import { drawForestLight } from '../art/forestLight';
import { ForestTrail, drawVillageRoofs } from '../art/forestTrail';
import { JungleLandscape } from '../art/jungleLandscape';
import { CityStreet } from '../art/cityStreet';

export interface Stats {
  kills: number;
  deaths: number;
  damageTaken: number;
  dashes: number;
  shots: number;
  pitFalls: number;
  time: number;
}

export type MusicState = 'fight' | 'fight1' | 'fight2' | 'fight3' | 'fightBreak' | 'chase' | 'monument' | 'explore' | 'combat' | 'nomad' | 'nomadCombat' | 'boss1' | 'boss2' | 'boss3' | 'silence' | 'calm' | 'victory' | 'rhythm' | 'celebrate' | 'club' | 'drop' | 'rave';

export const MAX_LIVES = 3;
/** moedas por pérola do lago */
export const PEARL_COINS = 5;
export const COMBO_WINDOW = 3;
/** multiplicador do combo: x1 → x5 */
export const comboMult = (n: number) => (n >= 20 ? 5 : n >= 12 ? 4 : n >= 7 ? 3 : n >= 3 ? 2 : 1);

export interface Hooks {
  onWeaponAcquired?: (id: WeaponId) => void;
  onRespawn?: () => void;
  onBanner?: (title: string, sub?: string, dur?: number) => void;
  /** o mundo pede um minijogo (o Game atende: íris, carregamento sob demanda, sessão); `done` recebe o resultado */
  onMinigame?: (id: MinigameId, done: (r: MinigameResult) => void, opts?: MinigameOpts) => void;
  /** pré-busca silenciosa do módulo do minijogo (jogador chegando perto do gatilho) */
  onMinigamePrefetch?: (id: MinigameId) => void;
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
  /** narrador: tocar a fala N / cortar a atual / a fala terminou (pelo relógio do narrador) */
  onNarrate?: (id: number) => void;
  onNarrStop?: () => void;
  onNarrEnd?: () => void;
  /** narrador: o áudio da fala N já está pronto para tocar? (sem hook = sim) */
  narrReady?: (id: number) => boolean;
  /** áudio real ainda em reprodução (sem hook, usa a duração simulada nos testes) */
  narrPlaying?: (id: number) => boolean;
  /** narrador: comece a preparar (decodificar) a fala N */
  onNarrPrepare?: (id: number) => void;
  /** checkpoint alcançado (o jogo salva o progresso no navegador) */
  onCheckpoint?: (idx: number) => void;
  /** Optional event reward: persist at the current checkpoint without moving it. */
  onProgress?: () => void;
  /** Require fresh presses when a brief scripted participation releases control. */
  onControlReturned?: () => void;
}

export interface Wreck {
  x: number;
  y: number;
  t: number;
}

export class World {
  readonly forestLight: ForestLight;
  readonly forestTrail: ForestTrail;
  private readonly jungleLandscape = new JungleLandscape();
  readonly cityStreet: CityStreet;
  data: LevelData;
  level: Level;
  fx = new Fx();
  camera = new Camera();
  player = new Player();
  director: Director;
  /** narrador da história (falas por lugar/evento, nunca por cima das vozes dos personagens) */
  narrator!: Narrator;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  readonly interceptableBullets = new Set<Bullet>();
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
  /** pântanos e lagos (fase 2): nado, peixes, bolhas */
  water!: Waters;
  /** minimapa do lago (fase 2); null nas outras fases */
  lakeMap: LakeMap | null = null;
  /** revelação da Praça do Pensador (só existe se a fase tem a estátua) */
  thinker!: ThinkerScene;
  /** pombo-correio e macaco que rouba a carta da Júlia (fase 2) */
  letter!: LetterScene;
  private pearlIds: number[] = [];
  /** pérolas do lago já coletadas (derivado dos IDs coletados; sem campo novo no save) */
  pearls() { let n = 0; for (const id of this.pearlIds) if (this.collectedPickups.has(id)) n++; return n; }
  pearlTotal() { return this.pearlIds.length; }
  private fearPt = { x: 0, y: 0 };
  /** Cardume fiel (12/12 pérolas): nasce perto do Karimbo no lago e foge das piranhas. */
  private updateLoyal(p: Player) {
    const wt = this.water;
    if (!this.pearlIds.length) return;
    if (wt.loyalLead < 0) {
      if (this.pearls() < this.pearlIds.length || !this.lakeMap?.contains(p.x, p.y)) return;
      wt.spawnLoyal(p.x - p.facing * 60, p.y);
      if (wt.loyalLead < 0) return;
    }
    wt.loyalX = p.x;
    wt.loyalY = p.y;
    let best = 300 * 300;
    wt.loyalFear = null;
    for (const e of this.enemies) {
      if (e.type !== 'piranha' || e.hp <= 0) continue;
      const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
      if (d < best) { best = d; this.fearPt.x = e.x; this.fearPt.y = e.y; wt.loyalFear = this.fearPt; }
    }
  }
  wildlife!: JungleWildlife;
  village!: Village;
  merchant!: Merchant;
  club!: ClubScene;
  exploration!: Exploration;
  encounters!: Encounters;
  /** interiores jogáveis: flags por cômodo + reputação na aldeia (persistidos no save) */
  readonly interiors = new InteriorStore();
  /** portas trancadas por expulsão: cômodo → checkpoint em que aconteceu (abre no seguinte) */
  readonly interiorLock = new Map<string, number>();
  /** 0..1 cabeça do Karimbo debaixo d'água (som abafado, tom da tela) */
  underwater = 0;
  /**
   * Escombros que fecham o caminho de volta depois de um checkpoint (x em px; -Infinity = nenhum).
   * Tudo o que fica atrás deles sai do mundo: menos inimigos, caixas e itens percorridos a cada
   * quadro — a fase fica tão leve no fim quanto no começo.
   */
  blockX = -Infinity;
  blockY = 0;
  /** animação do desmoronamento (s desde o início; -1 = parado) */
  blockAnimT = -1;
  private blockImpact = false;
  /** tambores-trampolim (estado da animação do couro) */
  drumHit = new Map<number, number>();
  /** sala do ritmo: notas pegas (cada uma toca a próxima nota da melodia), total e concluída */
  rhythm = { active: false, got: 0, total: 0, done: false, club: false, room: null as { x: number; y: number; w: number; h: number } | null };
  /** lasers da boate acesos neste quadro (por id) */
  beamOn: boolean[] = [];
  private beamHitCd = 0;
  /** cipós de balançar (fase 2) */
  vines: Vine[] = [];
  /** porta do templo em que o Karimbo está parado (mostra "↑ ENTRAR") */
  doorNear: DoorSpawn | null = null;
  /** transição de porta: escurece, teletransporta e clareia */
  doorT = -1;
  private doorGo: DoorSpawn | null = null;
  /** Entrada solicitada: aguarda o áudio real da descoberta, ainda do lado de fora. */
  private clubDoorWait: DoorSpawn | null = null;
  /** 0..1 tela preta da transição (o jogo desenha por cima do mundo) */
  blackout = 0;
  private lastMoveY = 0;
  private roomShown = false;
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
  rhythmRepeats = new Set<number>();
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
    this.forestTrail = new ForestTrail(data.level);
    this.cityStreet = new CityStreet(data.level);
    this.data = data;
    setStageScale(data.stage);
    this.level = data.level;
    this.forestLight = new ForestLight(data);
    this.baseTiles = data.level.tiles.slice();
    this.baseTheme = data.level.theme.slice();
    this.water = new Waters(data.water ?? [], this.level, data.decos);
    this.lakeMap = LakeMap.create(this.level, data.water ?? []);
    this.thinker = new ThinkerScene(this);
    this.letter = new LetterScene(this);
    this.pearlIds = data.pickups.filter((p) => p.kind === 'pearl').map((p) => p.id);
    this.wildlife = new JungleWildlife(data);
    this.village = new Village(data);
    this.merchant = new Merchant(data);
    this.club = new ClubScene(this);
    this.exploration = new Exploration(data);
    this.encounters = new Encounters(data);
    this.vines = (data.vines ?? []).map((v) => new Vine(v));
    this.director = new Director(this);
    this.narrator = new Narrator(this);
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
    this.rhythmRepeats.clear();
    this.interiors?.clear();
    this.lakeMap?.reset();
    this.interiorLock?.clear();
    this.stats = { kills: 0, deaths: 0, damageTaken: 0, dashes: 0, shots: 0, pitFalls: 0, time: 0 };
    this.checkpointIdx = -1;
    this.checkpointSnap = null;
    this.blockX = -Infinity;
    this.blockAnimT = -1;
    this.nomadLost = this.data.stage === 2; // selva: não há Nômad
    this.nomadUsed = false;
    this.parkedNomad = null;
    this.lives = MAX_LIVES;
    this.bossLivesGiven = false;
    this.comicShown = false;
    this.combo = 0;
    this.comboT = 0;
    this.bestCombo = 0;
    this.smash?.reset();
    this.narrator?.reset();
    this.water?.reset();
    this.wildlife?.reset();
    // o que já foi feito é apagado ANTES de cada sistema reler `encounters.completed` (o jacaré volta a dançar)
    this.encounters?.reset(true);
    this.village?.reset(this);
    this.club?.reset(this);
    this.thinker?.reset(this);
    this.letter?.reset(this);
    for (const v of this.vines) {
      v.held = false;
      v.a = 0;
      v.av = 0;
    }
    this.doorT = -1;
    this.blackout = 0;
    this.doorGo = null;
    this.clubDoorWait = null;
    this.drumHit.clear();
    const rr = this.data.secretRooms.find((s) => s.id === 'ritmo' || s.id === 'club');
    // cada nota aparece duas vezes (volta logo depois de pega): o dobro de pulos no ritmo
    this.rhythm = { active: false, got: 0, total: this.data.pickups.filter((p) => p.kind === 'note').length * 2, done: false, club: rr?.id === 'club', room: rr ? rr.rect : null };
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
    this.interceptableBullets.clear();
    this.grenades = [];
    this.pickups = [];
    this.props = [];
    this.corpses = [];
    this.wrecks = this.wrecks.filter(() => !fresh);
    this.fx.reset();
    this.timers = [];
    const dismountX = this.data.triggers.find((t) => t.id === 'dismount')?.rect.x ?? Infinity;
    let footGrunts = 0;
    const diff = difficulty();
    for (const s of this.data.enemies) {
      if (s.arena) continue;
      // Nos trechos percorridos a pé, reduz só tropas comuns; encontros especiais permanecem.
      // A dificuldade decide quantos ficam de fora (FÁCIL tira mais, DIFÍCIL não tira nenhum).
      if ((s.x < this.data.nomadSpawn.x || s.x >= dismountX) &&
          (s.type === 'rifle' || s.type === 'shotgun' || s.type === 'drone') && ++footGrunts % 4 === 0 && diff.thinEvery === 4) continue;
      if (diff.thinEvery === 3 && (s.type === 'rifle' || s.type === 'shotgun' || s.type === 'drone') && s.id % 3 === 0) continue;
      if (this.killedEnemies.has(s.id)) continue;
      this.enemies.push(createEnemy(diff.promote ? promoteSpawn(s, this.data.stage) : s));
    }
    for (const p of this.data.props) {
      if (this.destroyedProps.has(p.id)) continue;
      this.props.push(new Prop(p));
    }
    for (const p of this.data.pickups) {
      if (this.collectedPickups.has(p.id)) {
        if (p.kind === 'note' && !this.rhythmRepeats.has(p.id) && !this.rhythm.done)
          this.pickups.push(new Pickup('note', p.x, p.y, p.id, 1));
        continue;
      }
      this.pickups.push(new Pickup(p.kind, p.x, p.y, p.id, p.itemId ?? 0));
    }
    this.crowd.reset(this.data.civilians);
    this.solidsDirty = true;
    this.applyBlock();
  }

  /** Tambor sob os pés (para o pulo do trampolim). */
  drumAt(x: number, feetY: number) {
    for (const d of this.data.drums ?? []) if (Math.abs(x - d.x) <= d.w / 2 + 6 && Math.abs(feetY - d.y) < 4) return d;
    return null;
  }
  /** Batida no tambor: som (grave → agudo conforme o tambor), couro afundando e anel de som. */
  hitDrum(id: number) {
    const d = this.data.drums[id];
    const n = this.data.drums.length;
    if (d.style === 'speaker') audioEngine.wub(n > 1 ? id / (n - 1) : 0.5);
    else audioEngine.drum(n > 1 ? id / (n - 1) : 0.5, 1, 0);
    this.drumHit.set(id, 1);
    this.fx.add(PK.Ring, d.x, d.y + 2, 0, 0, 0.35, 8, '#ffe27a', { size1: d.w * 1.4, a0: 0.7, front: true });
  }

  /** Sala do ritmo: ao entrar, a música vira só percussão e as notas tocam a melodia. */
  private updateRhythm(dt: number) {
    void dt;
    const r = this.rhythm;
    const room = r.room!;
    const p = this.player;
    const inside = p.x >= room.x && p.x <= room.x + room.w && p.y >= room.y - 20 && p.y <= room.y + room.h + 20;
    if (inside && !r.active) {
      r.active = true;
      // concluída: a música inteira toca enquanto se está na sala (comemoração)
      if (r.done) this.setMusic(r.club ? 'drop' : 'celebrate');
      else {
        this.setMusic(r.club ? 'club' : 'rhythm');
        if (r.club && this.club.active) { /* a cena da balada anuncia por conta própria */ }
        else if (r.club) this.hooks.onBanner?.('PISTA DE NEON', 'Passe pelos lasers no ritmo e pegue as notas: você toca a música!', 3.4);
        else this.hooks.onBanner?.('SALA DO RITMO', 'Pule nos tambores e pegue as notas: você toca a música!', 3.2);
      }
    } else if (!inside && r.active) {
      r.active = false;
      this.setMusic('explore');
    }
  }

  /** Nota musical pega: toca a próxima nota da melodia, encaixada no compasso. */
  private onNote(pk: Pickup) {
    const r = this.rhythm;
    if (pk.itemId === 1 && pk.id >= 0) this.rhythmRepeats.add(pk.id);
    const idx = r.got++;
    const mel = r.club ? STAGE_MELODY : JUNGLE_MELODY;
    const midi = mel[idx % mel.length];
    if (r.club) audioEngine.synth(midi + 12, music.quantize(2));
    else audioEngine.flute(midi, music.quantize(2));
    this.score += 100;
    const col = r.club ? '#7ff9ff' : '#ffe27a';
    this.fx.popup(pk.x, pk.y - 18, `♪ ${r.got}/${r.total}`, col, 10);
    this.fx.sparks(pk.x, pk.y, 10, col, 200);
    // primeira vez: a nota volta no mesmo lugar logo depois (dá para brincar mais no ritmo)
    if (pk.itemId === 0 && !r.done) {
      const x = pk.x;
      const y = pk.y;
      this.after(1.3, () => {
        if (r.done) return;
        this.pickups.push(new Pickup('note', x, y, pk.id, 1));
        this.fx.add(PK.Ring, x, y, 0, 0, 0.35, 4, col, { size1: 30, a0: 0.8, front: true });
      });
    }
    if (r.got >= r.total && !r.done) {
      r.done = true;
      // final: o refrão inteiro toca sozinho, no ritmo, sobre a música completa (e continua
      // tocando enquanto o Karimbo estiver na sala)
      let t = music.quantize(1);
      const step = 60 / music.bpm() / 2;
      for (const m of mel.slice(0, 24)) {
        if (r.club) audioEngine.synth(m + 12, t, 0.9);
        else audioEngine.flute(m, t, 0.9);
        t += step;
      }
      this.setMusic(r.club ? 'drop' : 'celebrate');
      this.after(0.4, () => audioEngine.play('secret', 1));
      this.score += 3000;
      if (r.club) this.hooks.onBanner?.('DROP!', 'A pista é sua — que festa!', 3.5);
      else this.hooks.onBanner?.('SINFONIA DA SELVA!', 'Você tocou a música do templo', 3.5);
      this.fx.addFlash(0.35, '#ffe27a');
      const cx = r.room!.x + r.room!.w / 2;
      const cy = r.room!.y + 30;
      for (let i = 0; i < 30; i++) this.spawnDrop('token', cx + rand.spread(r.room!.w * 0.4), cy);
      this.spawnDrop('healthBig', cx, cy);
      for (let i = 0; i < 4; i++) this.after(0.3 + i * 0.25, () => this.fx.sparks(cx + rand.spread(200), cy + rand.range(0, 120), 24, i % 2 ? '#ff5ab4' : '#ffe27a', 360));
    }
  }

  /** Lasers da boate: acendem em tempos alternados da música; encostar aceso machuca. */
  private updateBeams(dt: number) {
    const bp = music.beatPos();
    const beats = bp >= 0 ? bp : (this.time * 124) / 60;
    const k = Math.floor(beats) % 2;
    const frac = beats - Math.floor(beats);
    if (this.beamHitCd > 0) this.beamHitCd -= dt;
    const p = this.player;
    const hb = p.hitbox;
    for (const b of this.data.beams) {
      // aceso no seu tempo, apagando um pouco antes do fim (dá para "entrar" no contratempo)
      const on = k === b.phase && frac < 0.86;
      this.beamOn[b.id] = on;
      if (!on || this.beamHitCd > 0 || p.mode === 'dead') continue;
      if (hb.x < b.x + 5 && hb.x + hb.w > b.x - 5 && hb.y < b.y1 && hb.y + hb.h > b.y0) {
        this.beamHitCd = 0.6;
        p.hit(this, 14, Math.sign(p.x - b.x) || -1, { kx: 260, ky: -220 });
        this.fx.sparks(b.x, p.y, 12, '#ff3fb4', 260);
      }
    }
  }

  /** O Karimbo está dentro de um interior (templo)? */
  inRoom() {
    const rs = this.data.rooms;
    if (!rs || !rs.length) return false;
    const p = this.player;
    for (const r of rs) if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return true;
    return false;
  }

  /** Portas do templo: parado na porta, ↑ ou ↓ entra; a tela escurece e o Karimbo aparece do outro lado. */
  private updateDoors(dt: number, ctl: ControlState) {
    const p = this.player;
    const my = ctl.moveY;
    const edge = Math.abs(my) > 0.6 && Math.abs(this.lastMoveY) <= 0.6;
    this.lastMoveY = my;
    if (this.clubDoorWait && (p.mode !== 'foot' || !p.body.onGround
      || Math.abs(p.x - this.clubDoorWait.x) >= 24 || Math.abs(p.feetY - this.clubDoorWait.y) >= 10)) this.clubDoorWait = null;
    if (this.doorT >= 0) {
      this.doorT += dt;
      const T_OUT = 0.28;
      this.blackout = this.doorT < T_OUT ? this.doorT / T_OUT : Math.max(0, 1 - (this.doorT - T_OUT - 0.08) / 0.3);
      p.lockInput = true;
      p.body.vx = 0;
      if (this.doorGo && this.doorT >= T_OUT) {
        const d = this.doorGo;
        this.doorGo = null;
        p.body.x = d.tx;
        p.body.y = d.ty - p.body.h / 2 - 0.5;
        p.body.vx = 0;
        p.body.vy = 0;
        p.lastSafe = { x: d.tx, y: d.ty };
        this.cameraSnap();
        const passage = this.data.rooms.find(r => r.passage && d.tx >= r.x && d.tx < r.x + r.w && d.ty >= r.y && d.ty <= r.y + r.h)?.passage;
        if (d.kind === 'in' && passage) {
          this.director.banner(passage.title, passage.clue, 4);
        } else if (d.kind === 'in' && !this.roomShown) {
          this.roomShown = true;
          this.director.banner(this.data.stage === 1 ? 'BALADA' : 'TEMPLO ESQUECIDO',
            this.data.stage === 1 ? 'Saída sinalizada nos fundos da pista →' : 'Dois caminhos... ache a saída', 2.6);
        } else if (d.kind === 'out') this.director.banner(this.data.stage === 1 ? 'DE VOLTA À CIDADE' : 'DE VOLTA À SELVA', undefined, 1.6);
      }
      if (this.doorT > T_OUT + 0.4) {
        this.doorT = -1;
        this.blackout = 0;
        p.lockInput = false;
      }
      return;
    }
    this.doorNear = null;
    if (p.mode !== 'foot' || p.vine || !p.body.onGround) return;
    for (const d of this.data.doors) {
      if (Math.abs(p.x - d.x) < 24 && Math.abs(p.feetY - d.y) < 10) {
        this.doorNear = d;
        if (edge && this.data.stage === 1 && d.kind === 'in' && this.club.room
          && d.tx >= this.club.room.x && d.tx <= this.club.room.x + this.club.room.w && this.narrator.enabled) {
          this.clubDoorWait = d;
          this.narrator.request(8, 60, () => this.clubDoorWait === d, 3, true);
        }
        if ((edge && !this.clubDoorWait) || (this.clubDoorWait === d && (!this.narrator.enabled
          || (!this.narrator.pending(8) && !this.narrator.busy())))) {
          this.clubDoorWait = null;
          this.doorGo = d;
          this.doorT = 0;
          this.audio('lock', 0.8, d.x);
          this.doorNear = null;
        }
        return;
      }
    }
  }

  /** Checkpoints salvam progresso sem fechar a exploração nem apagar entidades atrás do jogador. */
  blockBehind(idx: number, fx = true) {
    void idx; void fx;
    this.blockX = -Infinity;
    this.blockAnimT = -1;
    this.props = this.props.filter(p => p.spawn.id !== -950);
    this.solidsDirty = true;
  }

  /** Desmoronamento: poeira/fagulhas tremendo, queda e impacto (tremor, estrondo, destroços). */
  private updateCollapse(dt: number) {
    const x = this.blockX;
    const y = this.blockY;
    const jungle = this.data.stage === 2;
    this.blockAnimT += dt;
    const t = this.blockAnimT;
    if (t < COLLAPSE_SHAKE) {
      if (Math.random() < dt * 30) this.fx.add(PK.Dust, x + 46 + rand.spread(30), y - rand.range(60, 260), rand.spread(20), rand.range(30, 90), 0.8, rand.range(3, 6), jungle ? '#8a6a44' : '#9a94b0', { g: 300, a0: 0.7 });
      if (!jungle && Math.random() < dt * 20) this.fx.add(PK.Ember, x + 46 + rand.spread(30), y - 270, rand.spread(40), -rand.range(60, 140), 1.2, rand.range(2, 3.5), '#ffb347', { a0: 1, drag: 0.4 });
      this.fx.addShake(1.2, 0.05);
    } else if (!this.blockImpact && t >= COLLAPSE_SHAKE + COLLAPSE_FALL) {
      this.blockImpact = true;
      this.audio(jungle ? 'crush' : 'bigExplosion', 1, x);
      this.audio('debris', 1, x);
      this.fx.addShake(8, 0.5);
      this.fx.smoke(x - 40, y - 20, 14, jungle ? '#8a7a5a' : '#8b84a3', 50, 40, 1.2);
      for (let i = 0; i < 26; i++) {
        this.fx.add(PK.Debris, x - 60 + rand.spread(120), y - rand.range(10, 60), rand.spread(260), -rand.range(120, 420), rand.range(0.8, 1.4), rand.range(2.5, 5), jungle ? rand.pick(['#5a4030', '#3f9446', '#7a5a40']) : rand.pick(['#5a5f7a', '#6a6f8a', '#3a3f55']), { g: 1200, rot: rand.range(0, 6), vr: rand.spread(14), bounce: 0.3 });
      }
      if (!jungle) for (let i = 0; i < 14; i++) this.fx.add(PK.Ember, x + rand.spread(70), y - rand.range(20, 90), rand.spread(120), -rand.range(80, 260), rand.range(1, 1.8), rand.range(2, 4), '#ffb347', { a0: 1, drag: 0.4 });
      this.fx.add(PK.Ring, x - 30, y - 6, 0, 0, 0.45, 10, '#e8e0d0', { size1: 120, a0: 0.6 });
    }
    if (t > COLLAPSE_SHAKE + COLLAPSE_FALL + 0.1) this.blockAnimT = -1;
  }

  /** Tira do mundo o que ficou atrás dos escombros e (re)coloca a parede sólida. */
  private applyBlock() {
    if (!Number.isFinite(this.blockX)) return;
    const cut = this.blockX;
    // a masmorra do templo (interior isolado) nunca é apagada: só se chega lá pela porta
    const rooms = this.data.rooms ?? [];
    const keep = (x: number, y: number) => x >= cut || rooms.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    this.enemies = this.enemies.filter((e) => e.isBoss || e.spawnedByArena || keep(e.x, e.y));
    this.props = this.props.filter((p) => p.spawn.id === -950 ? false : p.barrier || keep(p.x, p.y));
    this.pickups = this.pickups.filter((p) => keep(p.x, p.y));
    this.corpses = this.corpses.filter((c) => c.x >= cut);
    this.wrecks = this.wrecks.filter((wk) => wk.x >= cut);
    this.crowd.list = this.crowd.list.filter((c) => c.x >= cut);
    const h = 16 * TILE;
    const wall = new Prop({ id: -950, kind: 'wall', x: this.blockX, y: this.blockY, w: 60, h, solid: true, critical: true });
    wall.barrier = true;
    wall.hittable = false;
    this.props.push(wall);
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
    this.village.reset(this);
    this.club.reset(this);
    this.thinker?.reset(this);
    this.letter?.reset(this);
    this.encounters.reset();
    this.narrator.onRespawn();
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
    this.interceptableBullets.clear();
    for (const b of this.bullets) if (b.interceptable && !b.dead) this.interceptableBullets.add(b);
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
    // World reactions do not depend on the speaker volume or camera attenuation.
    if(x!==undefined)this.wildlife.hear(name,x,vol);
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
    // o narrador não começa enquanto um personagem fala
    this.narrator.voiceStarted(CLIP_LEN[name]);
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
          if (!this.canReturnTo(px, ty * TILE)) continue;
          if (this.standableAt(tx, ty)) return { x: px, y: ty * TILE };
        }
      }
    }
    return null;
  }

  /** Salas são mapas separados; na trilha, o retorno deve ficar depois da barreira. */
  canReturnTo(x: number, feetY: number) {
    return !Number.isFinite(this.blockX) || x - this.player.body.w / 2 > this.blockX + 30 ||
      this.data.rooms.some(r => x >= r.x && x <= r.x + r.w && feetY >= r.y && feetY <= r.y + r.h);
  }

  isSafeSpot(x: number, feetY: number) {
    if (!this.canReturnTo(x, feetY)) return false;
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
  deathY(x?: number) {
    // acima/abaixo do lago fundo vale o mapa inteiro (a água pega o Karimbo, mesmo com arena ativa ao lado)
    const overLake = x !== undefined && this.water.zones.some((z) => z.kind === 'lake' && x >= z.x - 64 && x < z.x + z.w + 64);
    const a = this.director.activeArenaRect();
    if (a && !overLake) return Math.min(this.level.pxH + 60, a.y + a.h + 140);
    // nos demais buracos a queda continua curta
    if (this.data.voidRow !== undefined && !overLake) return this.data.voidRow * TILE + 60;
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
  clearEnemyBullets() {
    for (const b of this.bullets) if (b.team !== 0) b.dead = true;
    this.bullets = this.bullets.filter(b => b.team === 0);
    this.interceptableBullets.clear();
  }
  spawnEnemyBullet(x: number, y: number, ang: number, speed: number, dmg: number, kind: BulletKind, extra: Partial<BulletOpts> = {}) {
    this.noteThreat(x, y);
    speed *= difficulty().bulletSpeed;
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
    const bullet = new Bullet(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, o);
    this.bullets.push(bullet);
    if (bullet.interceptable) {
      this.interceptableBullets.add(bullet);
      this.hooks.onHint?.('interceptGrenade');
    }
  }
  spawnDrop(kind: PickupKind, x: number, y: number) {
    // limite só para o que cai (antes contava as moedas fixas da fase: na selva nada caía)
    let drops = 0;
    for (const p of this.pickups) if (p.id < 0) drops++;
    if (drops > 120) return;
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
    if (!rand.chance((0.015 + 0.3 * missing * missing) * difficulty().supply)) return false;
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
      case 'note':
        if (pk.id >= 0) this.collectedPickups.add(pk.id);
        this.onNote(pk);
        break;
      case 'token':
        if (pk.id >= 0) this.collectedPickups.add(pk.id);
        this.tokens++;
        collectCoin();
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
      case 'relic': {
        if (pk.id >= 0) this.collectedPickups.add(pk.id);
        const first = !progress.relics.includes(pk.itemId);
        this.score += first ? 3000 : 300;
        a('secret');
        this.fx.addFlash(0.35, '#7ff9e0');
        this.fx.sparks(pk.x, pk.y, 34, '#7ff9e0', 320);
        const coins = first ? 60 : 5;
        for (let i = 0; i < coins; i++) collectCoin();
        this.tokens += coins;
        if (first) {
          progress.relics.push(pk.itemId);
          const n = progress.relics.length;
          let sub = `+${coins} moedas • ${n}/5 relíquias`;
          if (n >= 5 && grantSkin('atlante', 'relics')) sub = 'TRAJE ATLANTE LIBERADO • vista no menu PERSONAGEM';
          else saveProgress();
          this.hooks.onBanner?.(`RELÍQUIA DE ATLÂNTIDA ${n}/5`, sub, 3);
        } else this.fx.popup(pk.x, pk.y - 22, 'RELÍQUIA JÁ GUARDADA • +5', '#7ff9e0', 9);
        break;
      }
      case 'pearl': {
        if (pk.id >= 0) this.collectedPickups.add(pk.id);
        this.score += 150;
        a('coin');
        this.fx.sparks(pk.x, pk.y, 14, '#ffe6f2', 220);
        for (let i = 0; i < PEARL_COINS; i++) collectCoin();
        this.tokens += PEARL_COINS;
        const got = this.pearls(), total = this.pearlTotal();
        this.fx.popup(pk.x, pk.y - 22, `PÉROLA ${got}/${total} • +${PEARL_COINS}`, '#ffe6f2', 9);
        if (got >= total) this.hooks.onBanner?.('CARDUME FIEL!', 'Os neons de Atlântida vão com você', 3);
        break;
      }
      case 'chest':
        if (pk.id >= 0) this.collectedPickups.add(pk.id);
        this.score += 800;
        a('secret');
        this.fx.addFlash(0.2, '#ffe27a');
        this.fx.sparks(pk.x, pk.y, 26, '#ffe27a', 300);
        for (let i = 0; i < 22; i++) this.spawnDrop('token', pk.x, pk.y - 6);
        this.fx.popup(pk.x, pk.y - 26, 'TESOURO!', '#ffe27a', 11);
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
    this.narrator.update(dt);
    this.village.update(this, dt, ctl);
    this.club.update(this, dt);
    this.thinker.update(this, dt);
    this.letter.update(this, dt);
    p.update(this, dt, this.letter.control(this.thinker.control(this.club.control(ctl))));
    this.encounters.update(this, dt);
    this.wildlife.update(this, dt);
    this.updateLoyal(p);
    if (this.water.zones.length) this.water.update(dt, p.x, p.y, p.swimming, this.camera.x, this.camera.x + this.camera.w);
    if (this.lakeMap && this.lakeMap.contains(p.x, p.y) && this.lakeMap.reveal(p.x, p.y)) {
      const lm = this.lakeMap.takeLandmark();
      if (lm) this.hooks.onBanner?.('DESCOBERTO!', lm.name, 2.2);
    }
    for (const v of this.vines) if (Math.abs(v.x - p.x) < 1400) v.update(dt, this.time);
    if (this.blockAnimT >= 0) this.updateCollapse(dt);
    if (this.data.doors?.length) this.updateDoors(dt, ctl);
    if (this.rhythm.room) this.updateRhythm(dt);
    // a cena da balada manda na música até o fim (nada de trilha de combate por cima)
    this.club.music(this);
    this.thinker.music(this);
    if (this.data.beams?.length) this.updateBeams(dt);
    for (const [id, k] of this.drumHit) {
      const n = k - dt * 4;
      if (n <= 0) this.drumHit.delete(id);
      else this.drumHit.set(id, n);
    }
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
    const introFreeze = this.director.longIntroActive() || this.director.soldierIntroActive();
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
      e.flushDamage(this, dt);
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
    for (let i = this.bullets.length - 1; i >= 0; i--) if (this.bullets[i].dead) {
      this.interceptableBullets.delete(this.bullets[i]);
      this.bullets.splice(i, 1);
    }
    for (const g of this.grenades) g.update(this, dt);
    for (let i = this.grenades.length - 1; i >= 0; i--) if (this.grenades[i].dead) this.grenades.splice(i, 1);
    for (const pk of this.pickups) if (pk.body || Math.abs(pk.x - cx) < 900) pk.update(this, dt);
    for (let i = this.pickups.length - 1; i >= 0; i--) if (!this.pickups[i].alive) this.pickups.splice(i, 1);
    for (const pr of this.props) pr.update(dt);
    for (let i = this.props.length - 1; i >= 0; i--) if (!this.props[i].alive) this.props.splice(i, 1);
    updateWreckEffects(this.wrecks, this.fx, this.camera, dt);
    this.crowd.update(this, dt);
    for (const c of this.corpses) c.update(dt);
    for (let i = this.corpses.length - 1; i >= 0; i--) if (this.corpses[i].dead) this.corpses.splice(i, 1);

    this.fx.update(dt, (x, y) => this.level.solidAtPx(x, y));
    if (this.speedLines > 0) this.speedLines -= dt;

    // câmera
    const cam = this.camera;
    this.director.cameraUpdate(dt);
    this.village.camera(this);
    this.club.camera(this);
    this.thinker.camera(this);
    this.letter.camera(this);
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
    setDecoFocus(this.player.x, this.player.y);
    if (this.data.stage === 2 && !this.inRoom()) this.jungleLandscape.draw(g, cam, this.time);
    if (this.water.zones.length) drawWaterBack(g, this);
    if (this.data.rooms?.length) drawRoomBack(g, this);
    if (!this.inRoom()) this.forestTrail.draw(g, cam.x, cam.y, cam.w, cam.h);
    if (!this.inRoom()) this.cityStreet.draw(g, cam.x, cam.y, cam.w, cam.h, this.time);
    this.director.drawDecos(g, 'back');
    drawClub(g, this, 'floor');
    // tiles
    art.tiles.render(g, L, cam.x, cam.y, cam.w, cam.h, this.time);
    drawVillageRoofs(g, L, cam.x, cam.w);
    this.drawWet(g);
    this.drawPits(g);
    this.wildlife.drawTrees(g, this);
    this.wildlife.drawCroc(g, this);
    // destroços do Nômad
    for (const w of this.wrecks) if (cam.visible(w.x, w.y, 160)) this.drawWreck(g, w);
    // escombros fechando o caminho de volta
    if (Number.isFinite(this.blockX) && cam.visible(this.blockX, this.blockY - 100, 320)) drawBlockade(g, this.data.stage, this.blockX, this.blockY, this.blockAnimT, this.time);
    // Nômad estacionado / aguardando
    this.director.drawNomadWorld(g);
    if (this.vines.length) drawVines(g, this);
    if (this.doorNear) drawDoorPrompt(g, this, this.doorNear);
    // props
    for (const pr of this.props) {
      if (!cam.visible(pr.x, pr.y, 90)) continue;
      pr.draw(g, this.time);
    }
    // interiores: a escuridão cobre o cenário; o que é de jogo (tambores, lasers, itens, inimigos,
    // o Karimbo) fica por cima, sempre legível
    if (this.data.rooms?.length) drawRoomDark(g, this);
    if (this.data.drums?.length) drawDrums(g, this);
    if (this.data.beams?.length) drawBeams(g, this);
    drawForestLight(g, this);
    this.director.drawBarriers(g);
    for (const pk of this.pickups) if (cam.visible(pk.x, pk.y, 40)) pk.draw(g, this);
    this.drawShadows(g);
    this.crowd.draw(g, this);
    this.village.draw(g, this);
    drawLetterScene(g, this, this.letter);
    drawExploration(g,this);
    this.merchant.draw(g,this);
    this.encounters.draw(g,this);
    for (const e of this.enemies) if (e.alive) e.drawWarnings(g, this);
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
    for (const e of this.enemies) if (cam.visible(e.x, e.y, 80)) e.drawStatus(g);
    drawClub(g, this, 'back');
    this.player.draw(g, this);
    if (this.data.stage === 2 && !this.inRoom()) this.jungleLandscape.draw(g, cam, this.time, true);
    if (!this.inRoom()) this.forestTrail.draw(g, cam.x, cam.y, cam.w, cam.h, true, this.time);
    if (!this.inRoom()) this.cityStreet.draw(g, cam.x, cam.y, cam.w, cam.h, this.time, true);
    drawClub(g, this, 'front');
    for (const gr of this.grenades) gr.draw(g);
    for (const b of this.bullets) if (cam.visible(b.x, b.y, b.interceptable ? 24 : 60)) b.draw(g);
    this.director.drawWorldOverlays(g);
    if (this.water.zones.length) {
      drawWaterFront(g, this);
      drawDeepLights(g, this);
    }
    this.fx.draw(g, true);
    this.director.drawDecos(g, 'front');
    this.encounters.drawPrompts(g, this);
    this.crowd.drawBalloon(g, this);
    this.village.draw(g, this, true);
    drawLetterScene(g, this, this.letter, true);
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
      if (this.data.stage === 2) {
        // selva: névoa subindo do desfiladeiro (sem brasas)
        let nm = k * 4;
        while (nm > 0) {
          if (Math.random() < nm) this.fx.add(PK.Smoke, p.x0 + Math.random() * wdt, p.y + 60, rand.spread(10), -rand.range(20, 40), rand.range(2.4, 3.4), rand.range(22, 30), rand.pick(['#e6f2dc', '#d4e8d0', '#c8dccc']), { size1: 60, a0: 0.32, drag: 0.3 });
          nm -= 1;
        }
        continue;
      }
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
      // (degradês pré-desenhados uma vez; a pulsação é a transparência — mesmo visual, sem gradiente por quadro)
      const sp = pitSprites();
      if (this.data.stage === 2) {
        // desfiladeiro da selva: escuro e enevoado
        g.drawImage(sp.dark, p.x0, p.y + 20, p.x1 - p.x0, 220);
        continue;
      }
      g.save();
      // fundo escuro do buraco (contraste com o chão)
      g.drawImage(sp.dark, p.x0, p.y, p.x1 - p.x0, 120);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = Math.min(1, fl / 1.08);
      g.drawImage(sp.heat, p.x0 + 2, p.y - 110, p.x1 - p.x0 - 4, 270);
      g.globalAlpha = 1;
      // bordas incandescentes
      g.fillStyle = '#ff9646';
      g.globalAlpha = Math.min(1, 0.55 * fl);
      g.fillRect(p.x0 - 1, p.y, 3, 14);
      g.fillRect(p.x1 - 2, p.y, 3, 14);
      g.globalAlpha = 1;
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
  }
}

/** Degradês dos buracos (fundo escuro + calor subindo), desenhados uma vez em faixas finas. */
let pitSpr: { dark: HTMLCanvasElement; heat: HTMLCanvasElement } | null = null;
function pitSprites() {
  if (pitSpr) return pitSpr;
  const dark = document.createElement('canvas');
  dark.width = 4;
  dark.height = 120;
  const dg = dark.getContext('2d')!;
  const dk = dg.createLinearGradient(0, 0, 0, 120);
  dk.addColorStop(0, 'rgba(8,2,16,0.75)');
  dk.addColorStop(1, 'rgba(8,2,16,0)');
  dg.fillStyle = dk;
  dg.fillRect(0, 0, 4, 120);
  const heat = document.createElement('canvas');
  heat.width = 4;
  heat.height = 270;
  const hg = heat.getContext('2d')!;
  // mesmas paradas de antes × 1,08 (pico da pulsação); a pulsação vira transparência
  const gr = hg.createLinearGradient(0, 270, 0, 0);
  gr.addColorStop(0, 'rgba(255,120,40,0.972)');
  gr.addColorStop(0.55, 'rgba(255,90,30,0.486)');
  gr.addColorStop(0.72, 'rgba(255,100,40,0.281)');
  gr.addColorStop(1, 'rgba(255,60,30,0)');
  hg.fillStyle = gr;
  hg.fillRect(0, 0, 4, 270);
  pitSpr = { dark, heat };
  return pitSpr;
}

/** duração das vozes/clipes gravados dos personagens (s) */
const CLIP_LEN: Record<ClipName, number> = { bossIntro: 15.7, karimboEncara: 3.7, karimboNomad: 1.5, balada: 140.2 };

const WEAPON_AMMO_FLOOR: Record<WeaponId, number> = { pistol: Infinity, rifle: 18, shotgun: 4, launcher: 2, energy: 8 };

/**
 * DIFÍCIL: parte das tropas comuns vira um tipo mais duro (mesmo id e posição, então saves e
 * inimigos já derrotados continuam valendo).
 */
function promoteSpawn(s: EnemySpawn, stage: number): EnemySpawn {
  if (s.type !== 'rifle' || s.id % 3 !== 1) return s;
  const type: EnemyType = stage === 2 ? (s.id % 2 ? 'grenadier' : 'hunter') : (s.id % 2 ? 'shotgun' : 'shield');
  return { ...s, type };
}
