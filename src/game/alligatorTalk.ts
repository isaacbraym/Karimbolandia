/**
 * Conversa com o jacaré da roda (simulação sem arte): três AGIR escalonados — educado, aviso, tapa na
 * orelha — e o convite ao boxe (`hooks.onMinigame('boxing')`). Depois da luta o jacaré fica nocauteado
 * (crianças preocupadas, uma cutucando com graveto) e, quando o Karimbo se afasta, volta a dançar com
 * curativo no focinho. Antes da primeira dança nada disso existe: a roda continua como sempre foi.
 * O jacaré NÃO usa chapéu (o chapéu de caça é só da skin Jacaré).
 *
 * Revanche: depois da primeira vitória o jacaré (de curativo) oferece a luta do Campeão. O AGIR de sempre
 * só cumprimenta; um SEGUNDO AGIR em até CHALLENGE_S segundos aceita (nunca por acidente). A luta do Campeão
 * não dá skin nem mexe no save do mundo: só marca o cartão do boxe (enfeites) e mostra uma faixa.
 */
import type { World } from './world';
import type { MinigameResult } from './minigames/types';
import type { LevelData } from './level';
import { grantSkin } from '../core/skins';
import { championUnlocked } from '../core/boxingStats';
import { DANCE_ID } from './level/community';

export const GATOR_ID = 'jungle:alligator-boxing';
/** distância (px) para falar com ele */
export const TALK_RANGE = 150;
/** se o Karimbo se afasta mais que isto a conversa recomeça do zero */
export const TALK_RESET = 1500;
/** nocauteado até o Karimbo se afastar tanto (px) */
export const KO_FAR = 2500;
export const BALLOON_S = 3.2;
/**
 * Quanto um balão fica na tela: o tempo de ler o texto (cerca de 14 caracteres por segundo, mais um fôlego de
 * 1,3 s para ver quem fala), nunca menos que 2,4 s. Antes todo balão durava 1,8–3,6 s e as falas longas sumiam
 * pela metade.
 */
export const readTime = (text: string) => Math.max(2.4, 1.3 + text.length / 14);
/** janela mínima (s) para aceitar o desafio do Campeão com um segundo AGIR (vale ao menos o tempo de ler a oferta) */
export const CHALLENGE_S = 9;

export type GatorPose = 'dance' | 'stand' | 'angry' | 'slap';
export type GatorMode = 'dance' | 'ko' | 'bandaged';
export interface Balloon { who: 'karimbo' | 'gator' | 'kids'; text: string; t: number; dur: number }

/** As falas centrais (texto exato do plano). */
export const TALK = {
  stage1: { k: 'Ô seu jacaré, que palhaçada é essa de ficar dançando aí no meio?', g: 'Boa tarde, meu jovem! Isso aqui é a roda das crianças, eu trabalho com isso. Com todo o respeito... você tá atrapalhando o meu esquema.' },
  stage2: { k: 'Esquema? Que esquema, rapaz?', g: 'Ó, orelhudo... vou pedir uma vez só: para de encher o meu saco. Senão o bagulho vai ficar louco.' },
  stage3: { k: 'Louco como?', g: 'Assim, ó! Agora é na mão, Parabólica! BORA PRO PAU!' },
  uuuh: 'UUUUUH!',
  chant: 'BRIGA! BRIGA! BRIGA! BRIGA!',
  lost: 'Quer mais, é? Tá bom... a orelha é sua.',
  bandaged: 'Seu Karimbo! Tudo certo, patrão? Pode passar, pode passar...',
  shh: 'Shhh! Ele tá dormindo!',
  laugh: 'HAHAHA, ORELHUDO!',
  rematch: 'Seu Karimbo... eu treinei. Quer a revanche do CAMPEÃO DA RODA? Fala comigo de novo!',
  champ: 'Então vem! Agora é o Campeão!',
} as const;
export const KO_LINES = ['Será que ele morreu?', 'Cutuca de novo!', 'Ele tá respirando!', 'Chama a Dona Benedita!'] as const;

interface Step { at: number; run: (w: World) => void }

export class AlligatorTalk {
  readonly dance: { x: number; y: number } | null;
  /** quantas vezes o Karimbo falou nesta sessão (0..3) */
  stage = 0;
  /** perdeu o boxe: a próxima conversa vai direto à luta */
  lost = false;
  mode: GatorMode = 'dance';
  pose: GatorPose = 'dance';
  /** tempo (s) desde o tapa (-1 = não houve) */
  slapT = -1;
  /** direção do Karimbo em relação ao jacaré (-1 esquerda, +1 direita), para o tapa */
  slapDir: -1 | 1 = -1;
  /** progresso (0..1) da cutucada do graveto no nocaute; -1 = parado */
  poke = -1;
  readonly balloons: Balloon[] = [];
  private clock = 0;
  private steps: Step[] = [];
  private poseUntil = 0;
  private time = 0;
  private ownsLock = false;
  private lockT = 0;
  private koT = 4;
  private koLine = 0;
  private pokeT = 0;
  private requested = false;
  private regrant = false;
  /** tempo restante (s) em que um novo AGIR aceita o desafio do Campeão */
  private challengeT = 0;

  constructor(data: Pick<LevelData, 'decos'>) {
    this.dance = data.decos.find((d) => d.kind === 'villageDance') ?? null;
  }

  /** Em conversa/cena (não aceita novo AGIR). */
  get busy() { return this.steps.length > 0 || this.requested; }

  /** Voltar ao começo (reinício/respawn/mudança de conta): nunca deixa o controle preso. */
  reset(w?: World) {
    if (w && this.ownsLock) { w.player.lockInput = false; w.camera.focus = null; }
    this.ownsLock = false;
    this.steps.length = 0;
    this.balloons.length = 0;
    this.stage = 0;
    this.pose = 'dance';
    this.slapT = -1;
    this.poke = -1;
    this.requested = false;
    this.lockT = 0;
    this.challengeT = 0;
    // partida nova (a roda ainda não foi feita): esquece a derrota anterior
    if (!w?.encounters.completed.has(DANCE_ID)) this.lost = false;
    // quem já venceu volta a vê-lo dançando de curativo (o nocaute só dura enquanto o Karimbo está por perto)
    this.mode = w?.encounters.completed.has(GATOR_ID) ? 'bandaged' : 'dance';
  }

  /** Pode falar agora? (a roda não está em andamento, perto o bastante e em condições de conversar) */
  canTalk(w: World, canJoin: boolean): boolean {
    const d = this.dance;
    if (!d || !canJoin || this.busy || this.ownsLock || !w.encounters.completed.has(DANCE_ID)) return false;
    return Math.abs(w.player.x - d.x) <= TALK_RANGE;
  }

  /** A conversa vence a exploração (porta/objeto) só quando o jacaré está mais perto que o ponto. */
  preferred(w: World, spotX: number | undefined): boolean {
    const d = this.dance;
    if (!d) return false;
    return spotX === undefined || Math.abs(d.x - w.player.x) < Math.abs(spotX - w.player.x);
  }

  /** O texto do botão de toque / dica na tela quando dá para falar. */
  prompt(): string { return this.mode === 'ko' ? 'AGIR: FALAR' : 'AGIR: FALAR • ↑: PALMAS'; }

  /** O Karimbo apertou AGIR perto do jacaré. */
  press(w: World) {
    const d = this.dance!;
    this.slapDir = w.player.x <= d.x ? -1 : 1;
    if (this.mode === 'ko') { this.say('kids', TALK.shh); return; }
    if (this.mode === 'bandaged' && !this.lost) {
      if (this.challengeT > 0) { this.challengeT = 0; this.startChampion(w); return; }
      // quem já ganhou ouve o convite (que já começa com o cumprimento); os dois balões juntos ficariam um sobre o outro
      if (championUnlocked()) { this.say('gator', TALK.rematch); this.challengeT = Math.max(CHALLENGE_S, readTime(TALK.rematch) + 2); }
      else this.say('gator', TALK.bandaged);
      return;
    }
    if (this.lost) { this.startLost(w); return; }
    this.stage = Math.min(3, this.stage + 1);
    if (this.stage === 1) this.startDialog(w, TALK.stage1, 'stand');
    else if (this.stage === 2) this.startDialog(w, TALK.stage2, 'angry');
    else this.startFight(w);
  }

  private say(who: Balloon['who'], text: string, dur = readTime(text)) {
    if (this.balloons.length >= 3) this.balloons.shift();
    this.balloons.push({ who, text, t: 0, dur });
  }

  private startDialog(w: World, lines: { k: string; g: string }, pose: GatorPose) {
    this.clock = 0;
    const rk = readTime(lines.k), rg = readTime(lines.g);
    // o jacaré responde quando a pergunta do Karimbo já foi lida; o próximo AGIR só vale depois de ler a resposta
    const gAt = Math.max(1.7, rk - 0.3);
    this.steps = [
      { at: 0, run: () => this.say('karimbo', lines.k, rk) },
      { at: gAt, run: () => { this.say('gator', lines.g, rg); this.pose = pose; this.poseUntil = this.time + rg + 1.8; } },
      { at: gAt + rg * 0.85, run: () => { /* fim: o próximo AGIR vale */ } },
    ];
    void w;
  }

  /** Terceiro AGIR: tapa na orelha, "UUUUUH!", "BRIGA!" e o boxe. O Karimbo fica parado até a luta. */
  private startFight(w: World) {
    const p = w.player;
    this.ownsLock = true;
    p.lockInput = true;
    p.body.vx = p.body.vy = 0;
    p.facing = this.slapDir === -1 ? 1 : -1;
    this.clock = 0;
    // tempos pela leitura: a pergunta, o tapa, o "UUUUUH!", a fala do jacaré e o coro de "BRIGA!"
    const rg = readTime(TALK.stage3.g), rc = readTime(TALK.chant);
    const gAt = 3.0, cAt = gAt + rg - 0.4;
    this.steps = [
      { at: 0, run: () => this.say('karimbo', TALK.stage3.k) },
      { at: 1.8, run: () => {
        this.pose = 'slap'; this.slapT = 0; this.poseUntil = this.time + 9 + rg;
        w.audio('thump', 1, p.x);
        w.fx.addShake(4, 0.4);
        p.earPop(3.2);
        w.fx.addFlash(0.18, '#ffffff');
      } },
      { at: 2.2, run: () => this.say('kids', TALK.uuuh, 2.2) },
      { at: gAt, run: () => this.say('gator', TALK.stage3.g, rg) },
      { at: cAt, run: () => this.say('kids', TALK.chant, rc) },
      { at: cAt + rc * 0.8, run: () => this.requestBoxing(w) },
    ];
  }

  /** Aceitou a revanche: provocação curta e o boxe com o Campeão. */
  private startChampion(w: World) {
    const p = w.player;
    this.ownsLock = true;
    p.lockInput = true;
    p.body.vx = p.body.vy = 0;
    p.facing = this.slapDir === -1 ? 1 : -1;
    this.clock = 0;
    this.balloons.length = 0;
    this.steps = [
      { at: 0, run: () => { this.say('gator', TALK.champ); this.pose = 'angry'; this.poseUntil = this.time + 8; } },
      { at: readTime(TALK.champ) - 0.3, run: () => this.say('kids', TALK.chant) },
      { at: readTime(TALK.champ) + readTime(TALK.chant) * 0.7, run: () => this.requestBoxing(w, true) },
    ];
  }

  /** Perdeu antes: ele só provoca e a luta recomeça. */
  private startLost(w: World) {
    const p = w.player;
    this.ownsLock = true;
    p.lockInput = true;
    p.body.vx = p.body.vy = 0;
    p.facing = this.slapDir === -1 ? 1 : -1;
    this.clock = 0;
    this.steps = [
      { at: 0, run: () => { this.say('gator', TALK.lost); this.pose = 'angry'; this.poseUntil = this.time + 8; } },
      { at: readTime(TALK.lost) - 0.3, run: () => this.say('kids', TALK.chant) },
      { at: readTime(TALK.lost) + readTime(TALK.chant) * 0.7, run: () => this.requestBoxing(w) },
    ];
  }

  private requestBoxing(w: World, champion = false) {
    this.requested = true;
    const hook = w.hooks.onMinigame;
    if (!hook) { this.onResult(w, { id: 'boxing', outcome: 'abort', time: 0, mistakes: 0, champion }); return; }
    hook('boxing', (r) => this.onResult(w, r), champion ? { champion: true } : undefined);
  }

  /** Resultado do boxe (também chamado com `abort` se o jogador abandonar). Prêmio só na vitória, uma vez. */
  onResult(w: World, r: MinigameResult) {
    this.requested = false;
    this.steps.length = 0;
    if (this.ownsLock) { w.player.lockInput = false; this.ownsLock = false; }
    w.camera.focus = null;
    this.slapT = -1;
    this.pose = 'dance';
    if (r.champion) { this.onChampionResult(w, r); return; }
    if (r.outcome === 'win') {
      const first = !w.encounters.completed.has(GATOR_ID);
      w.encounters.completed.add(GATOR_ID);
      const gained = grantSkin('jacare', 'boxing');
      this.mode = 'ko';
      this.lost = false;
      this.stage = 0;
      this.koT = 3;
      if (first || gained) w.hooks.onBanner?.('SKIN DE JACARÉ DESBLOQUEADA!', 'Fôlego +30% • Nado +40% • Vida +10% — vista na Loja de Skins', 4);
      w.hooks.onProgress?.();
      w.hooks.onControlReturned?.();
    } else if (r.outcome === 'lose') {
      this.lost = true;
      this.stage = 0;
      // Karimbo tonto ao lado da roda por 1,5 s; as crianças riem
      this.ownsLock = true;
      w.player.lockInput = true;
      this.lockT = 1.5;
      this.say('kids', TALK.laugh);
      w.hooks.onControlReturned?.();
    } else {
      // abandonou: o próximo AGIR recomeça o tapa
      this.stage = 2;
      w.hooks.onControlReturned?.();
    }
  }

  /** Fim da revanche: sem skin nem estágios novos; vencer deixa o Campeão nocauteado de novo, perder só dá risada. */
  private onChampionResult(w: World, r: MinigameResult) {
    this.stage = 0;
    this.challengeT = 0;
    if (r.outcome === 'win') {
      this.mode = 'ko';
      this.koT = 3;
      w.hooks.onBanner?.('CAMPEÃO DA RODA DERROTADO!', 'Sino de ouro no ringue — e a marca fica no seu cartão do boxe', 4);
    } else if (r.outcome === 'lose') {
      this.ownsLock = true;
      w.player.lockInput = true;
      this.lockT = 1.5;
      this.say('kids', TALK.laugh);
    }
    w.hooks.onControlReturned?.();
  }

  update(w: World, dt: number) {
    const d = this.dance;
    if (!d) return;
    const step = Math.min(dt, 0.1);
    this.time += step;
    this.clock += step;
    if (this.challengeT > 0) this.challengeT = Math.max(0, this.challengeT - step);
    const p = w.player;
    // restaurar um save com a vitória: sempre começa de curativo
    if (this.mode === 'dance' && w.encounters.completed.has(GATOR_ID)) this.mode = 'bandaged';
    // a vitória está no save mas a skin não (perfil de recompensas perdido ou gravação que falhou): entrega de novo, uma vez
    if (!this.regrant && w.encounters.completed.has(GATOR_ID)) { this.regrant = true; if (grantSkin('jacare', 'boxing')) w.hooks.onProgress?.(); }
    const far = Math.abs(p.x - d.x);
    if (far > TALK_RESET && !this.busy && !this.ownsLock) this.stage = 0;
    if (this.mode === 'ko' && far > KO_FAR) { this.mode = 'bandaged'; this.poke = -1; }
    // roteiro da conversa
    while (this.steps.length && this.steps[0].at <= this.clock) this.steps.shift()!.run(w);
    if (this.pose !== 'dance' && this.pose !== 'slap' && this.time >= this.poseUntil && !this.steps.length) this.pose = 'dance';
    if (this.slapT >= 0) { this.slapT += step; if (this.slapT > 1.2 && this.pose === 'slap' && !this.requested) this.pose = 'angry'; }
    // Karimbo tonto depois de perder
    if (this.lockT > 0) {
      this.lockT -= step;
      p.body.vx = 0;
      if (this.lockT <= 0 && this.ownsLock) { p.lockInput = false; this.ownsLock = false; w.hooks.onControlReturned?.(); }
    }
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      this.balloons[i].t += step;
      if (this.balloons[i].t >= this.balloons[i].dur) this.balloons.splice(i, 1);
    }
    // nocaute: falas ocasionais (uma de cada vez) e a cutucada do graveto
    if (this.mode === 'ko') {
      this.pokeT += step;
      const cyc = this.pokeT % 2;
      this.poke = cyc < 0.6 ? cyc / 0.6 : -1;
      if (this.poke >= 0 && this.poke < step / 0.6 + 1e-6 && Math.abs(p.x - d.x) < 800) w.audio('snore', 0.35, d.x);
      this.koT -= step;
      if (this.koT <= 0 && !this.balloons.length && far < 700) {
        this.say('kids', KO_LINES[this.koLine++ % KO_LINES.length]);
        this.koT = 8 + ((this.koLine * 37) % 5); // 8–12 s, determinístico
      }
    }
  }
}
