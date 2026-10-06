/** Rajadas compartilhadas, em tempo de simulação: pausar congela toda a paisagem. */
export function windAt(x: number, t: number) {
  return .4 + Math.sin(t * .72 - x * .0011) * .38
    + Math.sin(t * 1.63 - x * .0023) * .18;
}

/** Flexibilidade visual; pedra, construções e raízes não recebem deformação. */
const FLEX: Record<string, number> = {
  jTree: 5, jPalm: 9, jBanana: 7, jMangrove: 5, streetTree: 5,
  jFern: 3, jBush: 2.5, jFlowers: 3, jReeds: 5, jSedge: 4, jCattails: 5,
  jFlag: 5,
  pLeaves: 6, pReeds: 5,
};
export function windFlex(kind: string) { return FLEX[kind] ?? 0; }

/** Deslocamento da ponta; a pequena ondulação local acompanha a rajada dominante. */
export function windTip(kind: string, x: number, t: number) {
  return windFlex(kind) * (windAt(x, t) + Math.sin(t * 2.4 + x * .019) * .13);
}

/** Faixas com transformação linear contínua entre bordas, reutilizando a imagem assada. */
export function drawWindSprite(g: CanvasRenderingContext2D, image: HTMLCanvasElement,
  x: number, top: number, w: number, h: number, anchor: number, tip: number, strips = 6) {
  const span = Math.max(1, anchor - top);
  for (let i = 0; i < strips; i++) {
    const y0 = top + h * i / strips, y1 = top + h * (i + 1) / strips;
    const a = tip * Math.max(0, (anchor - y0) / span) ** 2;
    const b = tip * Math.max(0, (anchor - y1) / span) ** 2, shear = (b - a) / (y1 - y0);
    // Pequeno recobrimento evita frestas de amostragem entre as faixas.
    const overlap = i < strips - 1 ? Math.min(.35, top + h - y1) : 0;
    g.save(); g.transform(1, 0, shear, 1, a - shear * y0, 0);
    g.drawImage(image, 0, image.height * i / strips, image.width,
      image.height * (1 / strips + overlap / h), x, y0, w, y1 - y0 + overlap);
    g.restore();
  }
}

/** Mastro rígido; só o tecido, à direita do ponto de fixação, ondula. */
export function drawWindFlag(g: CanvasRenderingContext2D, image: HTMLCanvasElement, tip: number) {
  const sx = image.width / 66, sy = image.height / 152;
  g.drawImage(image, 0, 0, 8 * sx, image.height, -6, -150, 8, 152);
  for (let i = 0; i < 6; i++) {
    const x0 = 2 + i * 58 / 6, x1 = 2 + (i + 1) * 58 / 6;
    const a = tip * (i / 6) ** 2, b = tip * ((i + 1) / 6) ** 2, slope = (b - a) / (x1 - x0);
    const extra = i < 5 ? .25 : 0;
    g.save(); g.transform(1, slope, 0, 1, 0, a - slope * x0);
    g.drawImage(image, (x0 + 6) * sx, 0, (x1 - x0 + extra) * sx, 42 * sy, x0, -150, x1 - x0 + extra, 42);
    g.restore();
  }
}
