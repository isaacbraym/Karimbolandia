/**
 * Rig de braço 2.5D do boxe (Karimbo e jacaré): ombro → cotovelo → punho resolvidos em 3D, com o cotovelo
 * empurrado por um vetor-guia ("pole") e a projeção para a tela por uma câmera oblíqua.
 *
 * Por que 3D: com os braços só em 2D o cotovelo vira uma escolha de "para cima ou para baixo" e os
 * braços viram cabos retos ou "asas de galinha". Em 3D o antebraço pode apontar para a câmera ou para o
 * adversário (encurtando na tela) e o cotovelo fica onde um boxeador o deixa: baixo e colado na guarda,
 * alto e aberto no cruzado, embaixo no gancho.
 *
 * Eixos (unidades do corpo): x para a direita, y para baixo, z para a FRENTE do lutador (no Karimbo, para
 * longe da câmera; no jacaré, para a câmera, então z < 0). Tela = (x + kx·z, y + ky·z). As luvas continuam
 * sendo autoradas em coordenadas de TELA (o golpe tem de chegar ao alvo); `unproject` recupera o ponto 3D a
 * partir da posição na tela e da profundidade, e o solucionador garante que os ossos tenham sempre o mesmo
 * comprimento (ou o alongamento permitido, que cresce só quando o alvo está além do alcance).
 *
 * Módulo puro (sem canvas): testado em tests/boxingArmRig.test.ts.
 */

export interface Cam { kx: number; ky: number; F: number }

export interface Arm {
  /** cotovelo e punho (3D) já com o alongamento aplicado */
  ex: number; ey: number; ez: number;
  wx: number; wy: number; wz: number;
  /** fator aplicado aos dois ossos (1 = comprimento normal) */
  stretch: number;
}
export const newArm = (): Arm => ({ ex: 0, ey: 0, ez: 0, wx: 0, wy: 0, wz: 0, stretch: 1 });

/** Escala de tamanho pela profundidade (perto da câmera = maior). */
export const depthScale = (z: number, F: number) => 1 / Math.max(0.3, 1 + z / F);

/** (gx, gy) na tela com profundidade z → ponto 3D que se projeta exatamente ali. */
export function unproject(out: { x: number; y: number; z: number }, gx: number, gy: number, z: number, cam: Cam) {
  out.x = gx - cam.kx * z; out.y = gy - cam.ky * z; out.z = z;
}

/**
 * Cinemática inversa de dois ossos (comprimentos A e B) do ombro S ao alvo T.
 * `p` é o vetor-guia do cotovelo (não precisa ser unitário nem perpendicular ao braço).
 * Se o alvo está além do alcance, os ossos se alongam até `maxStretch`; passando disso o punho é puxado
 * para a linha do ombro (o braço nunca se desprende do ombro).
 */
export function solveArm(o: Arm, sx: number, sy: number, sz: number, tx: number, ty: number, tz: number,
  A: number, B: number, px: number, py: number, pz: number, maxStretch = 2): Arm {
  let dx = tx - sx, dy = ty - sy, dz = tz - sz;
  let d = Math.hypot(dx, dy, dz);
  if (d < 1e-4) { dx = 0; dy = 1; dz = 0; d = 1e-4; }
  const base = (A + B) * 0.995;
  const r = d > base ? Math.min(maxStretch, d / base) : 1;
  const a = A * r, b = B * r;
  const reach = (a + b) * 0.995;
  // fora do alcance mesmo esticado: puxa o punho; muito perto: afasta o mínimo para o triângulo existir
  const lo = Math.abs(a - b) + 1e-3;
  const dd = Math.max(lo, Math.min(reach, d));
  const f = dd / d;
  dx *= f; dy *= f; dz *= f;
  const ux = dx / dd, uy = dy / dd, uz = dz / dd;
  const m = (a * a - b * b + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, a * a - m * m));
  // componente do guia perpendicular ao eixo ombro→punho
  const dot = px * ux + py * uy + pz * uz;
  let nx = px - ux * dot, ny = py - uy * dot, nz = pz - uz * dot;
  let nl = Math.hypot(nx, ny, nz);
  if (nl < 1e-3) {
    // guia paralelo ao braço: usa "para baixo" e, se ainda degenerar, "para a direita"
    nx = -uy * uy; ny = 1 - uy * uy; nz = -uz * uy;
    nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-3) { nx = 1 - ux * ux; ny = -ux * uy; nz = -ux * uz; nl = Math.hypot(nx, ny, nz) || 1; }
  }
  o.ex = sx + ux * m + (nx / nl) * h; o.ey = sy + uy * m + (ny / nl) * h; o.ez = sz + uz * m + (nz / nl) * h;
  o.wx = sx + dx; o.wy = sy + dy; o.wz = sz + dz;
  o.stretch = r;
  return o;
}
