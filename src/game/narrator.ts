/**
 * Narrador: 28 falas curtas (public/assets/audio/narr/nN.mp3) disparadas por lugares e eventos da fase.
 *
 * Regras (para não poluir nem parecer atrasado/adiantado):
 *  • uma fala por vez, numa fila; cada fala toca no máximo uma vez por partida;
 *  • cada pedido tem prazo e condição: se esperar demais ou perder o sentido (o jogador já passou do
 *    lugar, o inimigo já morreu...), é descartado em silêncio;
 *  • NUNCA toca junto com as vozes dos personagens: não começa durante a apresentação do Nômad, a
 *    entrada do Felipão ou a HQ, nem quando uma dessas cenas está prestes a acontecer (antes de
 *    alcançar o gatilho), e as próprias cenas esperam a fala terminar (ver Director);
 *  • um respiro curto entre falas.
 * Tudo aqui é simulação (relógio próprio, durações conhecidas): roda nos testes sem áudio. O jogo
 * toca o áudio de verdade pelos hooks (onNarrate / onNarrStop) e diz se o áudio já está pronto.
 */
import type { World } from './world';
import { TILE } from './level';
import { SUPPORT_AT } from './director';

/** duração (s) de cada fala, já sem os silêncios das pontas (índice = número do áudio) */
export const NARR_LEN: readonly number[] = [
  0, 14.4, 8.66, 9.2, 2.45, 9.99, 8.26, 7.4, 6.08, 6.51, 8.34, 5.91, 9.14, 6.39, 8.8, 7.43, 6.88, 6.13, 6.79, 6.19, 5.0, 10.53,
  7.2, 5.33, 8.15, 5.85, 4.52, 3.99, 11.61,
];
export const NARR_COUNT = 28;
/** abertura: momentos da fala 1 ("O homem." / "A lenda." / "As orelhas." / "Karimbo!") */
export const OPEN_BEATS = { hero: 7.75, man: 9.6, legend: 10.52, ears: 11.42, name: 13.8 };

/** respiro entre duas falas (s) */
const GAP = 1.1;
/** velocidade máxima de aproximação usada para prever gatilhos de cena (px/s) */
const APPROACH = 270;

interface Req {
  id: number;
  at: number;
  expire: number;
  valid?: () => boolean;
  prio: number;
  /** se perder a vez, pode ser pedida de novo na próxima ocorrência (eventos momentâneos) */
  retry: boolean;
}

export class Narrator {
  w: World;
  enabled = true;
  /** relógio próprio (só anda com o mundo; o jogo também o avança na tela CONTINUAR?) */
  t = 0;
  played = new Set<number>();
  private asked = new Set<number>();
  queue: Req[] = [];
  /** fala tocando agora (−1 = nenhuma) e quando termina */
  cur = -1;
  curEnd = 0;
  private gapUntil = 0;
  /** voz de personagem tocando até este instante */
  private voiceUntil = 0;
  /** ids na ordem em que tocaram (testes/depuração) */
  log: { id: number; t: number }[] = [];

  // pontos da fase (derivados dos dados, não de tiles fixos)
  private xShoot = 0;
  private xJump = 0;
  private xDash = 0;
  private xCrouch = 0;
  private xClimb = 0;
  private cpRoof = -1;
  private firstSoldier = -1;
  private abyssX1 = 0;
  // bordas dos eventos (só reage quando o número sobe)
  private lastDmg = 0;
  private lastRooms = 0;
  private lastSecrets = 0;
  private lastDashes = 0;

  constructor(w: World) {
    this.w = w;
    const d = w.data;
    const trig = (id: string) => d.triggers.find((t) => t.id === id);
    this.xShoot = trig('hint:shoot')?.rect.x ?? 0;
    this.xJump = trig('hint:jump')?.rect.x ?? 0;
    this.xDash = trig('hint:dash')?.rect.x ?? 0;
    this.xCrouch = trig('hint:crouch')?.rect.x ?? 0;
    this.xClimb = d.sections.find((s) => s.name === 'Subida final')?.x ?? 0;
    this.cpRoof = d.checkpoints.findIndex((c) => c.name === 'Telhado');
    // primeiro soldado parado depois da dica de tiro
    let best = 1e9;
    for (const e of d.enemies) {
      if (e.arena || e.type !== 'rifle' || e.x < this.xShoot) continue;
      if (e.x < best) {
        best = e.x;
        this.firstSoldier = e.id;
      }
    }
  }

  /** O abismo do avanço (primeiro buraco depois da dica). Calculado quando os buracos existem. */
  private abyss() {
    if (this.abyssX1 === 0) {
      for (const p of this.w.pits) {
        if (p.x0 > this.xDash) {
          this.abyssX1 = p.x1;
          break;
        }
      }
      if (this.abyssX1 === 0) this.abyssX1 = this.xDash + 40 * TILE;
    }
    return this.abyssX1;
  }

  // ------------------------------------------------------------------ ciclo
  /** Nova partida: tudo pode tocar de novo. */
  reset() {
    this.stop();
    this.played.clear();
    this.asked.clear();
    this.queue.length = 0;
    this.log.length = 0;
    this.t = 0;
    this.gapUntil = 0;
    this.voiceUntil = 0;
    this.lastDmg = this.lastRooms = this.lastSecrets = this.lastDashes = 0;
  }
  /** Voltou ao checkpoint: corta a fala atual e esquece os pedidos pendentes (o contexto mudou). */
  onRespawn() {
    this.stop();
    this.queue.length = 0;
  }
  /** A fala de CONTINUAR? pertence a cada morte, não ao limite de uma vez por partida. */
  onContinue() {
    this.stop();
    this.queue.length = 0;
    this.played.delete(27);
    this.asked.delete(27);
    this.gapUntil = this.t;
    this.request(27, 10, undefined, 2);
  }
  /** Corta a fala atual (pular a abertura, reinício...). */
  stop() {
    if (this.cur >= 0) {
      this.cur = -1;
      this.w.hooks.onNarrStop?.();
    }
  }

  busy() {
    return this.cur >= 0;
  }
  /** Ainda vai falar isto (tocando ou na fila)? */
  pending(id: number) {
    if (this.cur === id) return true;
    for (const r of this.queue) if (r.id === id) return true;
    return false;
  }
  /** Uma voz de personagem começou agora (o narrador espera ela acabar). */
  voiceStarted(len: number) {
    this.voiceUntil = Math.max(this.voiceUntil, this.t + len + 0.3);
  }

  /** Pede uma fala (uma vez por partida). expire: quanto tempo pode esperar para começar. */
  request(id: number, expire: number, valid?: () => boolean, prio = 0, retry = false) {
    if (!this.enabled || this.played.has(id) || this.asked.has(id)) return;
    this.asked.add(id);
    this.queue.push({ id, at: this.t, expire, valid, prio, retry });
    this.w.hooks.onNarrPrepare?.(id);
  }

  update(dt: number) {
    this.t += dt;
    if (!this.enabled) {
      if (this.cur >= 0) this.stop();
      this.queue.length = 0;
      return;
    }
    this.watch();
    if (this.cur >= 0 && (this.w.hooks.narrPlaying ? !this.w.hooks.narrPlaying(this.cur) : this.t >= this.curEnd)) {
      this.cur = -1;
      this.gapUntil = this.t + GAP;
      this.w.hooks.onNarrEnd?.();
    }
    if (this.cur < 0 && this.queue.length) this.tryStart();
  }

  private tryStart() {
    // descarta o que perdeu o prazo ou o sentido
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const r = this.queue[i];
      if (this.t - r.at > r.expire || (r.valid && !r.valid())) {
        this.queue.splice(i, 1);
        if (r.retry) this.asked.delete(r.id); // evento momentâneo: pode voltar na próxima vez
      }
    }
    if (this.t < this.gapUntil || this.t < this.voiceUntil) return;
    let pick = -1;
    for (let i = 0; i < this.queue.length; i++) {
      const r = this.queue[i];
      if (pick >= 0 && this.queue[pick].prio >= r.prio) continue;
      if (!this.canStart(r.id)) continue;
      if (this.w.hooks.narrReady && !this.w.hooks.narrReady(r.id)) continue; // áudio ainda decodificando
      pick = i;
    }
    if (pick < 0) return;
    const r = this.queue[pick];
    this.queue.splice(pick, 1);
    this.played.add(r.id);
    this.cur = r.id;
    this.curEnd = this.t + NARR_LEN[r.id];
    this.log.push({ id: r.id, t: this.t });
    this.w.hooks.onNarrate?.(r.id);
  }

  /** Pode começar a fala `id` agora sem cruzar com vozes de personagens/cenas? */
  canStart(id: number) {
    const w = this.w;
    const d = w.director;
    const p = w.player;
    const len = NARR_LEN[id];
    const c = d.cine;
    if (c) {
      if (c.kind === 'opening') return id === 1;
      if (c.kind === 'soldier') return id === 2;
      if (c.kind === 'bossDeath') return id === 28;
      return false; // apresentação do Nômad (voz do Karimbo) e entrada do Felipão
    }
    if (id === 1) return false; // a abertura só toca dentro da cena de abertura
    if (d.bossActive && !d.bossIntroDone) return false;
    if (p.mode === 'dead' && id !== 27) return false;
    if (p.mode === 'mounting') return false;
    if (id === 27) return true; // a morte tem prioridade sobre avisos de cenas próximas
    // cenas com voz logo à frente: não começa uma fala que ainda estaria tocando quando elas chegarem
    const reach = (len + 0.8) * APPROACH;
    if (!w.nomadUsed && !w.nomadLost && !d.triggered.has('nomadMeet')) {
      const tr = w.data.triggers.find((t) => t.id === 'nomadMeet');
      if (tr) {
        const dx = tr.rect.x - p.x;
        if (dx > -TILE && dx < reach) return false;
      }
    }
    if (!d.supportUsed && d.supportWillArrive) {
      if (d.support && !d.support.ready) return false;
      if (!d.support && (w.nomadUsed || w.nomadLost) && d.supportClock > SUPPORT_AT - len - 2) return false;
    }
    if (id !== 24 && !d.bossActive) {
      const boss = w.data.arenas.find((a) => a.id === 'boss');
      if (boss && boss.triggerX - p.x < reach && boss.triggerX - p.x > -TILE * 4) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ gatilhos (só leituras baratas)
  private watch() {
    const w = this.w;
    const d = w.director;
    const p = w.player;
    const x = p.x;
    const civ = w.data.civilians;
    const has = (id: number) => this.played.has(id) || this.asked.has(id);
    const prep = (id: number, at: number) => {
      // começa a decodificar o áudio um pouco antes de chegar no lugar
      if (!has(id) && x > at - 1600 && x < at) w.hooks.onNarrPrepare?.(id);
    };
    // 2 — primeiro soldado parado
    if (!has(2)) {
      prep(2, this.xShoot);
      if (x >= this.xShoot - 2 * TILE && !d.soldierIntroActive()) {
        const id = this.firstSoldier;
        this.request(2, 7, () => !w.killedEnemies.has(id) && w.player.x < this.xShoot + 22 * TILE);
      }
    }
    // 3 — primeiro buraco com degraus
    if (!has(3)) {
      prep(3, this.xJump);
      if (x >= this.xJump - 2 * TILE) this.request(3, 7, () => w.player.x < this.xJump + 26 * TILE);
    }
    // 4 — primeira vez que leva dano
    if (w.stats.damageTaken > this.lastDmg) {
      if (!has(4) && p.mode === 'foot') this.request(4, 1.6, undefined, 1, true);
      this.lastDmg = w.stats.damageTaken;
    }
    // 5 — primeiro voo com as orelhas (depois de 10 s de jogo)
    if (!has(5) && p.glide && p.mode === 'foot' && w.time > 10) this.request(5, 2.2, () => !w.player.body.onGround, 1, true);
    // 6 — moradores pedindo ajuda (rua principal)
    if (!has(6) && civ.length > 6) {
      const cx = (civ[5].x + civ[6].x) / 2;
      prep(6, cx - 300);
      if (Math.abs(x - cx) < 330) this.request(6, 7, () => Math.abs(w.player.x - cx) < 760);
    }
    // 7 — primeira ORELHADA
    if (!has(7) && p.slam) this.request(7, 2.5, undefined, 1, true);
    // 8 — primeira área secreta / 9 — primeira Orelha Dourada
    if (w.secretRooms.size > this.lastRooms) {
      if (!has(8)) this.request(8, 4, undefined, 0, true);
      this.lastRooms = w.secretRooms.size;
    }
    if (w.secrets.size > this.lastSecrets) {
      if (!has(9)) this.request(9, 5, undefined, 1, true);
      this.lastSecrets = w.secrets.size;
    }
    // 10 — emboscada vencida / 11 — moradores comemorando logo depois
    const a1 = d.arenas.find((a) => a.def.id === 'a1');
    if (!has(10) && a1 && a1.status === 'cleared') this.request(10, 5, undefined, 1);
    if (!has(11) && civ.length > 9) {
      const cx = civ[8].x;
      prep(11, cx - 300);
      if (x > civ[7].x - 9 * TILE) this.request(11, 14, () => Math.abs(w.player.x - cx) < 900);
    }
    // 12 — fim da apresentação do Nômad ("pule em cima") / 13 — embarcou
    if (!has(12) && d.nomadMountable && !w.nomadUsed) this.request(12, 6);
    if (!has(13) && w.nomadUsed && p.mounted && !d.supportUsed) this.request(13, 7, () => w.player.mounted);
    // 14 — primeira leva das hordas / 15 — primeiro avanço
    if (!has(14) && d.hordeSeq > 0) this.request(14, 6, () => w.player.mounted);
    if (w.stats.dashes > this.lastDashes) {
      if (!has(15)) this.request(15, 3, undefined, 1, true);
      this.lastDashes = w.stats.dashes;
    }
    // 16 — o abismo que só passa com o avanço
    if (!has(16)) {
      prep(16, this.xDash);
      if (x >= this.xDash - TILE) this.request(16, 9, () => w.player.x < this.abyss() - TILE, 1);
    }
    // 17 — área de guerra
    const a2 = d.arenas.find((a) => a.def.id === 'a2');
    if (!has(17) && a2 && a2.status === 'active') this.request(17, 4, undefined, 1);
    // 18 — Nômad estacionado / 19 — túnel de engatinhar
    if (!has(18) && d.triggered.has('dismount') && !p.mounted && w.nomadUsed) this.request(18, 5);
    if (!has(19)) {
      prep(19, this.xCrouch);
      if (x >= this.xCrouch - TILE) this.request(19, 14, () => w.player.x < this.xCrouch + 22 * TILE);
    }
    // 20 — embarcou no Nômad de apoio
    if (!has(20) && d.supportUsed && p.mounted && p.nomad && p.nomad.timeLeft !== Infinity) this.request(20, 5, () => w.player.mounted);
    // 21 — moradores na base da torre
    if (!has(21) && civ.length > 12) {
      const cx = civ[11].x;
      prep(21, cx - 300);
      if (Math.abs(x - cx) < 330) this.request(21, 9, () => Math.abs(w.player.x - cx) < 900);
    }
    // 22 — subida final / 23 — telhado
    if (!has(22)) {
      prep(22, this.xClimb);
      if (x >= this.xClimb) this.request(22, 7);
    }
    if (!has(23) && this.cpRoof >= 0 && w.checkpointIdx >= this.cpRoof) this.request(23, 6);
    // 24 — ALERTA! presença pesada (a entrada do Felipão espera esta fala terminar)
    if (!has(24) && d.triggered.has('bossWarn')) this.request(24, 3, () => !d.bossActive, 2);
    // 25/26 — fases do Felipão
    if (!has(25) && d.bossActive && d.bossIntroDone && d.bossPhase >= 2) this.request(25, 4, undefined, 1);
    if (!has(26) && d.bossActive && d.bossIntroDone && d.bossPhase >= 3) this.request(26, 4, undefined, 1);
    // 28 — vitória
    if (!has(28) && d.cine?.kind === 'bossDeath' && d.cine.stage >= 1) this.request(28, 4, undefined, 2);
  }
}
