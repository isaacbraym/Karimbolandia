/**
 * Moradores da cidade: comemoram, pedem ajuda, fogem do tiroteio ou se encolhem de medo quando o
 * Karimbo chega. Não são alvos nem sólidos. A simulação não usa arte (roda nos testes headless);
 * só o desenho consulta os sprites. Fora da câmera ficam congelados e não são desenhados.
 */
import type { World } from './world';
import { T, TILE, type CivilianSpawn } from './level';
import { PK } from './fx';
import { rand } from '../core/math';
import { buildDims } from './civLook';
import { civArtFor, drawCivilian, speechSprite, type CivArt } from '../art/civilians';
import { drawSpr } from '../art/kit';

/** Falas (balões de HQ). O texto é pré-desenhado uma vez (um canvas por frase). */
export const PHRASES = [
  'O Karimbo chegou! Estamos salvos!', // 0
  'Karimbo, nos ajude!', // 1
  'Precisamos de você, Karimbo!', // 2
  'Karimbo, resgate nossa princesa Júlia!', // 3
  'Karimbo, a Júlia precisa de você!', // 4
  'Corre, ele está vindo!', // 5
  'Vai, Karimbo! Acaba com eles!', // 6
  'Eles levaram a Júlia pro telhado!', // 7
  'Que orelhas incríveis!', // 8
  'Cuidado com o Felipão!', // 9
  'Os robôs tomaram a avenida!', // 10
  'Tem munição nas caixas, pega!', // 11
  'Eu sabia que você viria!', // 12
  'Socorro! Eles estão por toda parte!', // 13
  'Abaixa! Tão atirando!', // 14
  'Mostra pra eles, orelhudo!', // 15
  'O Tomé vende armas lá na oficina!', // 16
  'Minha loja virou ferro-velho...', // 17
] as const;
/** frases em grito (balão serrilhado) */
export const SHOUTS: readonly number[] = [5, 6, 9, 13, 14];

const VICTORY: readonly number[] = [0, 6, 8, 12, 15];
const HELP: readonly number[] = [1, 2, 3, 4, 7, 9, 10, 11, 16, 17];
const FEAR: readonly number[] = [5, 9, 13, 14];

/** distância (px) em que o civil mais próximo fala */
export const TALK_DIST = 260;
const TALK_TIME = 2.7;
/** silêncio mínimo entre dois balões quaisquer */
const TALK_GAP = 3.5;
/** distância que o Karimbo precisa se afastar para o morador poder falar de novo */
const FORGET_DIST = 900;

export type CivAct = 'idle' | 'cheer' | 'help' | 'run' | 'cower';

export class Civilian {
  spawn: CivilianSpawn;
  x: number;
  y: number;
  facing: -1 | 1;
  act: CivAct = 'idle';
  t: number;
  /** altura do pulinho (px, ≥ 0) */
  hop = 0;
  hopV = 0;
  hopRest = 0;
  /** 0..1 agachado (suave) */
  crouch = 0;
  runDir: -1 | 1 = -1;
  runLeft = 0;
  runPhase = 0;
  fled = false;
  calmT = 0;
  lookT = 1;
  dustT = 0;
  scanT = 0;
  threatX = NaN;
  speakCd = 0;
  lastPhrase = -1;
  /** já falou neste encontro: só volta a falar depois que o Karimbo se afasta bastante */
  spoke = false;
  /** quantas vezes falou na partida (cada vez mais raro) */
  talks = 0;
  /** relógio do mundo a partir do qual pode voltar a falar */
  quietUntil = 0;
  /** fase própria (ninguém se mexe em sincronia com os vizinhos) */
  phase: number;
  /** arte assada (resolvida uma vez, no primeiro desenho) */
  art: CivArt | null | undefined = undefined;

  constructor(s: CivilianSpawn) {
    this.spawn = s;
    this.x = s.x;
    this.y = s.y;
    this.facing = s.facing;
    this.phase = (s.seed % 997) / 997;
    this.t = this.phase * 10;
    this.speakCd = 0;
  }

  get mood() {
    return this.spawn.mood;
  }

  /** Dá para ficar em pé neste x (chão sólido sem parede)? Usado ao fugir. */
  private standable(w: World, x: number) {
    const L = w.level;
    const tx = Math.floor(x / TILE);
    const ty = Math.round(this.y / TILE);
    return L.get(tx, ty) === T.SOLID && L.get(tx, ty - 1) !== T.SOLID && L.get(tx, ty - 2) !== T.SOLID && L.get(tx, ty - 1) !== T.HAZARD;
  }

  /** Inimigo acordado mais próximo (combate perto) → x dele; NaN se está calmo. */
  private scanThreat(w: World) {
    let best = NaN;
    let bd = 520;
    const list = w.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || !e.awake || e.isBoss) continue;
      const d = Math.abs(e.x - this.x);
      if (d < bd && Math.abs(e.y - this.y) < 220) {
        bd = d;
        best = e.x;
      }
    }
    this.threatX = best;
  }

  update(w: World, dt: number) {
    this.t += dt;
    if (this.speakCd > 0) this.speakCd -= dt;
    const p = w.player;
    const dx = p.x - this.x;
    const adx = Math.abs(dx);
    const playerHere = p.mode !== 'dead' && Math.abs(p.y - this.y) < 200;
    const near = playerHere && adx < 300;
    const seen = playerHere && adx < 520;
    // ameaça: só quem foge procura (5×/s, sem alocar)
    if (this.mood === 'flee') {
      this.scanT -= dt;
      if (this.scanT <= 0) {
        this.scanT = 0.2;
        this.scanThreat(w);
      }
    }
    const mood = this.mood;
    let crouchT = 0;
    if (mood === 'cheer') {
      this.act = near ? 'cheer' : 'idle';
    } else if (mood === 'help') {
      this.act = seen ? 'help' : 'idle';
      if (this.spawn.kneel) crouchT = 0.6;
    } else if (mood === 'scared') {
      this.act = 'cower';
      crouchT = 1;
    } else {
      // foge num trecho curto quando o tiroteio chega perto; depois se encolhe e espera acalmar
      const threat = !Number.isNaN(this.threatX);
      if (this.act === 'run') {
        const step = 150 * dt * this.runDir;
        if (this.runLeft <= 0 || !this.standable(w, this.x + step + this.runDir * 12)) {
          this.act = 'cower';
          this.fled = true;
          this.calmT = 0;
        } else {
          this.x += step;
          this.runLeft -= Math.abs(step);
          this.runPhase += dt * 15;
          this.dustT -= dt;
          if (this.dustT <= 0 && w.fx.opt()) {
            this.dustT = 0.14;
            w.fx.add(PK.Dust, this.x - this.runDir * 6, this.y - 2, -this.runDir * 30, -rand.range(8, 26), 0.45, 6, '#b9b0c8', { size1: 3, a0: 0.5 });
          }
        }
      } else if (threat && !this.fled) {
        this.act = 'run';
        this.runDir = this.x >= this.threatX ? 1 : -1;
        this.facing = this.runDir;
        this.runLeft = 150 + this.phase * 70;
      } else if (this.fled) {
        // escondido: só volta a ficar em pé depois de uns segundos sem tiroteio
        this.calmT = threat ? 0 : this.calmT + dt;
        if (this.calmT > 5) {
          this.fled = false;
          this.act = 'idle';
        } else this.act = 'cower';
      } else this.act = seen ? 'help' : 'idle';
      if (this.act === 'cower') crouchT = 1;
    }
    // olhar: vira para o Karimbo; com medo e sozinho, olha para os lados
    if (this.act !== 'run') {
      if (playerHere && adx < 420 && adx > 6) this.facing = dx > 0 ? 1 : -1;
      else if (this.act === 'cower') {
        this.lookT -= dt;
        if (this.lookT <= 0) {
          this.lookT = 0.8 + rand.next() * 1.1;
          this.facing = this.facing === 1 ? -1 : 1;
        }
      }
    }
    // pulinhos de comemoração
    if (this.act === 'cheer' || this.hop > 0) {
      if (this.hop <= 0 && this.hopV >= 0) {
        this.hopRest -= dt;
        if (this.hopRest <= 0 && this.act === 'cheer') {
          this.hopV = -(170 + rand.next() * 70);
          this.hopRest = 0.08 + rand.next() * 0.35;
        }
      }
      if (this.hopV !== 0 || this.hop > 0) {
        this.hopV += 900 * dt;
        this.hop -= this.hopV * dt;
        if (this.hop <= 0) {
          this.hop = 0;
          this.hopV = 0;
        }
      }
    }
    this.crouch += (crouchT - this.crouch) * Math.min(1, dt * 10);
  }
}

/** Todos os civis da fase + o balão de fala (um por vez na tela). */
export class Crowd {
  list: Civilian[] = [];
  talker: Civilian | null = null;
  phrase = -1;
  talkT = 0;
  gap = 0;
  lastPhrase = -1;
  /** frases ditas recentemente (ninguém repete o que o vizinho acabou de dizer) */
  private recent: number[] = [];

  reset(spawns: CivilianSpawn[]) {
    this.list.length = 0;
    for (const s of spawns) this.list.push(new Civilian(s));
    this.talker = null;
    this.phrase = -1;
    this.talkT = 0;
    this.gap = 0;
    this.recent.length = 0;
  }

  private now = 0;

  update(w: World, dt: number) {
    this.now = w.time;
    const cam = w.camera;
    const p = w.player;
    let best: Civilian | null = null;
    let bd = TALK_DIST;
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      // o Karimbo foi embora: na próxima visita o morador pode dizer outra coisa (se já passou a recarga)
      if (c.spoke && Math.abs(c.x - p.x) > FORGET_DIST && w.time >= c.quietUntil) c.spoke = false;
      // longe da câmera congela (não atualiza nem desenha)
      if (!cam.visible(c.x, c.y - 40, 220)) continue;
      c.update(w, dt);
      const d = Math.abs(c.x - p.x);
      if (!c.spoke && d < bd && Math.abs(c.y - p.y) < 160 && cam.visible(c.x, c.y - 40, 0)) {
        bd = d;
        best = c;
      }
    }
    // balão: uma fala por vez, recarga por civil, sem repetir a mesma frase seguida
    if (this.talker) {
      this.talkT += dt;
      if (this.talkT > TALK_TIME) {
        this.talker = null;
        this.gap = TALK_GAP;
      }
      return;
    }
    if (this.gap > 0) {
      this.gap -= dt;
      return;
    }
    if (!best || p.mode === 'dead' || w.director.cine) return;
    this.say(best);
  }

  private say(c: Civilian) {
    const pool = c.mood === 'cheer' ? VICTORY : c.mood === 'help' ? HELP : c.act === 'run' || c.act === 'cower' || c.mood === 'scared' ? FEAR : HELP;
    let k = Math.floor(rand.next() * pool.length);
    let ph = pool[k];
    for (let n = 0; n < pool.length && (ph === c.lastPhrase || this.recent.includes(ph)); n++) {
      k = (k + 1) % pool.length;
      ph = pool[k];
    }
    c.lastPhrase = ph;
    c.spoke = true;
    c.talks++;
    // cada nova fala do mesmo morador demora mais (nada de papagaio)
    c.quietUntil = this.now + 25 + c.talks * 20;
    this.recent.push(ph);
    if (this.recent.length > Math.min(5, pool.length - 1)) this.recent.shift();
    this.lastPhrase = ph;
    this.phrase = ph;
    this.talker = c;
    this.talkT = 0;
  }

  // ------------------------------------------------------------------ desenho (só aqui há arte)
  draw(g: CanvasRenderingContext2D, w: World) {
    const cam = w.camera;
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (!cam.visible(c.x, c.y - 40, 80)) continue;
      if (c.art === undefined) c.art = civArtFor(c.spawn.look);
      if (!c.art) continue; // arte ainda não assada: nunca assa no meio do quadro
      const talking = this.talker === c;
      drawCivilian(g, c.art, c.x, c.y, c, talking);
    }
  }

  /** Balão de HQ por cima de tudo (pré-desenhado; só escala no "pop"). */
  drawBalloon(g: CanvasRenderingContext2D, w: World) {
    const c = this.talker;
    if (!c || this.phrase < 0) return;
    if (!w.camera.visible(c.x, c.y - 60, 60)) return;
    const spr = speechSprite(this.phrase);
    if (!spr) return;
    const t = this.talkT;
    const k = t < 0.18 ? 0.4 + 0.75 * (t / 0.18) - 0.15 * Math.sin((t / 0.18) * Math.PI) : 1;
    const out = TALK_TIME - t < 0.2 ? Math.max(0, (TALK_TIME - t) / 0.2) : 1;
    const head = 84 * buildDims(c.spawn.look?.build ?? 'avg').k * (c.crouch > 0.5 ? 0.82 : 1);
    drawSpr(g, spr, c.x + 6, c.y - c.hop - head, { sx: k, sy: k, alpha: out });
  }
}
