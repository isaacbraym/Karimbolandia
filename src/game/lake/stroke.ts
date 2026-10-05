/**
 * Embalo de braçadas: braçadas encadeadas no ritmo (a nova entre 0,25 s e 0,65 s depois da
 * anterior) sobem o embalo até 3; cada nível acima de 1 dá +12% de velocidade horizontal (máx. +24%).
 * Sem braçada por 1,0 s o embalo cai para 1. Só rastro e velocidade: não mexe em oxigênio,
 * pressão nem colisão. Simulação pura.
 */
export const STROKE_MIN = 0.25;
export const STROKE_MAX = 0.65;
export const STROKE_DECAY = 1.0;
export const STROKE_LEVEL_MAX = 3;
export const STROKE_BONUS = 0.12;

export class StrokeRhythm {
  /** 1 = sem embalo, 3 = máximo */
  level = 1;
  /** segundos desde a última braçada válida */
  since = Infinity;

  /** Registra uma braçada. */
  stroke() {
    if (this.since < STROKE_MIN) return; // rápido demais: nem ajuda nem atrapalha
    if (this.since <= STROKE_MAX) this.level = Math.min(STROKE_LEVEL_MAX, this.level + 1);
    else this.level = 1;
    this.since = 0;
  }

  update(dt: number) {
    if (this.since === Infinity) return;
    this.since += dt;
    if (this.since > STROKE_DECAY) { this.level = 1; this.since = Infinity; }
  }

  /** multiplicador da velocidade horizontal (1 .. 1,24) */
  get speedMul() { return 1 + STROKE_BONUS * (this.level - 1); }

  reset() { this.level = 1; this.since = Infinity; }
}
