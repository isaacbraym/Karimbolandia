/**
 * Geometria da cena do boxe (pura: sem canvas, testável em Node). Tudo em coordenadas lógicas W × H.
 *
 * Câmera "por cima do ombro, deslocada" (como nos jogos de boxe de celular): o Karimbo de costas no
 * terço inferior esquerdo, o jacaré no centro-direita e a torcida em U (laterais e cantos do fundo),
 * NUNCA entre os dois lutadores. `PROTECT` é a área da luta: nenhuma criança, placa ou efeito de
 * primeiro plano pode entrar nela (tests/boxingLayout.test.ts confere em vários formatos de tela).
 */
export interface Rect { x: number; y: number; w: number; h: number }
export type Band = 'far' | 'mid' | 'near' | 'judge';
export interface Spot {
  x: number;
  /** pés */
  y: number;
  /** escala da criança (a base de 1 é a altura do sprite assado a 1×) */
  s: number;
  band: Band;
  /** -1 esquerda, 1 direita */
  side: -1 | 1;
  /** classe de tamanho para o sprite assado: 0 longe, 1 meio, 2 perto */
  size: 0 | 1 | 2;
}

export interface BoxLayout {
  W: number; H: number;
  /** unidade: 1 = H/360 */
  u: number;
  /** a área da luta: nada de torcida aqui */
  protect: Rect;
  gator: { x: number; feetY: number; s: number };
  /** base do pescoço do Karimbo e escala do desenho de costas */
  karimbo: { x: number; y: number; s: number };
  /** descanso das luvas e alvo dos socos (centro do peito do jacaré) */
  target: { x: number; y: number };
  ring: { backY: number; horizonY: number; x0: number; x1: number; frontY: number; fx0: number; fx1: number; ropeH: [number, number, number] };
  spots: Spot[];
}

/** Alturas e larguras (em unidades, a 1×) do sprite da criança, com a plaquinha: usadas só para checar sobreposição. */
export const KID_HALF_W = 30;
export const KID_H = 78;

export function boxLayout(W: number, H: number): BoxLayout {
  const u = H / 360;
  const protect: Rect = { x: W * 0.2, y: H * 0.1, w: W * 0.6, h: H * 0.9 };
  const ring = {
    backY: H * 0.47, horizonY: H * 0.3, x0: W * 0.2, x1: W * 0.8, frontY: H * 1.02, fx0: -W * 0.12, fx1: W * 1.12,
    ropeH: [H * 0.058, H * 0.112, H * 0.165] as [number, number, number],
  };
  const spots: Spot[] = [];
  const add = (side: -1 | 1, band: Band, nx: number, ny: number, s: number) => {
    const size: 0 | 1 | 2 = s < 0.55 ? 0 : s < 0.85 ? 1 : 2;
    const half = KID_HALF_W * u * s;
    // o limite interno da torcida é a borda da área da luta
    const xc = side < 0 ? Math.min(W * nx, protect.x - half - 2 * u) : Math.max(W * (1 - nx), protect.x + protect.w + half + 2 * u);
    spots.push({ x: xc, y: H * ny, s: s * u, band, side, size });
  };
  for (const side of [-1, 1] as const) {
    // fundo (longe, pequenas): duas fileiras nos cantos de trás
    add(side, 'far', 0.035, 0.405, 0.5);
    add(side, 'far', 0.105, 0.405, 0.5);
    add(side, 'far', 0.17, 0.4, 0.5);
    add(side, 'mid', 0.06, 0.475, 0.7);
    add(side, 'mid', 0.135, 0.47, 0.7);
    add(side, 'mid', 0.08, 0.545, 0.8);
    // encostadas nas cordas laterais (maiores quanto mais perto da câmera)
    add(side, 'near', 0.045, 0.6, 0.92);
    add(side, 'near', 0.1, 0.68, 1.05);
    add(side, 'near', 0.035, 0.77, 1.2);
  }
  // o juiz do sino: canto de trás à esquerda, ao lado das cordas
  spots.push({ x: protect.x - KID_HALF_W * 0.82 * u - 2 * u, y: H * 0.5, s: 0.82 * u, band: 'judge', side: -1, size: 1 });
  return {
    W, H, u, protect,
    gator: { x: W * 0.6, feetY: H * 0.7, s: u * 1.08 },
    karimbo: { x: W * 0.285, y: H * 0.78, s: u * 0.66 },
    target: { x: W * 0.6, y: H * 0.37 },
    ring,
    spots,
  };
}

/** Caixa de uma criança na tela (para testes de sobreposição). */
export function spotBox(sp: Spot): Rect {
  return { x: sp.x - KID_HALF_W * sp.s, y: sp.y - KID_H * sp.s, w: KID_HALF_W * 2 * sp.s, h: KID_H * sp.s };
}
export function intersects(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
