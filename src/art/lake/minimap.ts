/**
 * Desenho do minimapa do lago. Três imagens assadas no tamanho em pixels do destino (D02): o relevo
 * (`terrain`), a moldura e a imagem composta (`composed` = cinza onde não se explorou, relevo onde
 * sim). Ao revelar, só os retângulos das células novas são copiados (O(células novas)); por quadro
 * há a moldura, a imagem composta, os pinos (≤ 12) e o ponto do Karimbo.
 */
import { makeCanvas } from '../kit';
import type { World } from '../../game/world';
import { LAKE_CELL_TILES, type LakeMap } from '../../game/lake/lakeMap';
import { ATLANTIS_LANDMARKS } from '../../game/level/atlantis';
import { TILE } from '../../game/level';

const FOG = '#737982';

interface MiniArt {
  pw: number;
  ph: number;
  terrain: HTMLCanvasElement;
  composed: HTMLCanvasElement;
  frame: HTMLCanvasElement;
  pin: HTMLCanvasElement;
  relic: HTMLCanvasElement;
  epoch: number;
  /** relíquias (posições) — filtradas uma vez, não por quadro */
  relics: { id: number; x: number; y: number }[];
}
const cache = new WeakMap<LakeMap, MiniArt>();
const scratch: number[] = [];

function bakeTerrain(m: LakeMap, pw: number, ph: number) {
  const c = makeCanvas(pw, ph), g = c.getContext('2d')!;
  g.fillStyle = '#1a252b';
  g.fillRect(0, 0, pw, ph);
  for (let cy = 0; cy < m.rows; cy++) {
    const y0 = Math.floor((cy * ph) / m.rows), y1 = Math.floor(((cy + 1) * ph) / m.rows);
    const f = cy / m.rows;
    // água: do verde-azulado da superfície ao breu do fundo (sem gradiente por quadro: células assadas)
    const r = Math.round(60 - 52 * f), gr = Math.round(186 - 150 * f), b = Math.round(176 - 110 * f);
    for (let cx = 0; cx < m.cols; cx++) {
      const x0 = Math.floor((cx * pw) / m.cols), x1 = Math.floor(((cx + 1) * pw) / m.cols);
      if (m.water[cy * m.cols + cx]) {
        g.fillStyle = `rgb(${r},${gr},${b})`;
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
      } else {
        // rocha: tom escuro com a borda de cima mais clara quando há água por cima
        g.fillStyle = '#26343a';
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        if (cy > 0 && m.water[(cy - 1) * m.cols + cx]) { g.fillStyle = '#3d5058'; g.fillRect(x0, y0, x1 - x0, Math.max(1, (y1 - y0) * 0.35)); }
      }
    }
  }
  return c;
}

function bake(m: LakeMap, mw: number, mh: number, k: number): MiniArt {
  const pw = Math.max(8, Math.round(mw * k)), ph = Math.max(8, Math.round(mh * k));
  const terrain = bakeTerrain(m, pw, ph);
  const composed = makeCanvas(pw, ph);
  const frame = makeCanvas(Math.ceil((mw + 10) * k), Math.ceil((mh + 10) * k));
  {
    const g = frame.getContext('2d')!;
    g.scale(k, k);
    g.fillStyle = 'rgba(14,10,32,.78)';
    g.strokeStyle = 'rgba(255,255,255,.28)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.roundRect(0.7, 0.7, mw + 8.6, mh + 8.6, 6);
    g.fill();
    g.stroke();
  }
  const pin = makeCanvas(Math.ceil(11 * k), Math.ceil(11 * k));
  {
    const g = pin.getContext('2d')!;
    g.scale(k, k);
    g.fillStyle = '#170f2e';
    g.beginPath(); g.arc(5.5, 5.5, 4.6, 0, 6.283); g.fill();
    g.fillStyle = '#ffd23a';
    g.beginPath(); g.arc(5.5, 5.5, 3.2, 0, 6.283); g.fill();
    g.fillStyle = '#fff6c4';
    g.beginPath(); g.arc(4.6, 4.5, 1, 0, 6.283); g.fill();
  }
  const relic = makeCanvas(Math.ceil(11 * k), Math.ceil(11 * k));
  {
    const g = relic.getContext('2d')!;
    g.scale(k, k);
    g.fillStyle = '#170f2e';
    g.beginPath(); g.moveTo(5.5, 0.4); g.lineTo(10.6, 5.5); g.lineTo(5.5, 10.6); g.lineTo(0.4, 5.5); g.closePath(); g.fill();
    g.fillStyle = '#7ff9ff';
    g.beginPath(); g.moveTo(5.5, 2); g.lineTo(9, 5.5); g.lineTo(5.5, 9); g.lineTo(2, 5.5); g.closePath(); g.fill();
  }
  return { pw, ph, terrain, composed, frame, pin, relic, epoch: -1, relics: [] };
}

/** Copia o relevo de uma célula para a imagem composta (substitui o cinza). */
function reveal(a: MiniArt, m: LakeMap, idx: number) {
  const cx = idx % m.cols, cy = (idx / m.cols) | 0;
  const x0 = Math.floor((cx * a.pw) / m.cols), x1 = Math.floor(((cx + 1) * a.pw) / m.cols);
  const y0 = Math.floor((cy * a.ph) / m.rows), y1 = Math.floor(((cy + 1) * a.ph) / m.rows);
  const g = a.composed.getContext('2d')!;
  g.clearRect(x0, y0, x1 - x0, y1 - y0);
  g.drawImage(a.terrain, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
}

function recompose(a: MiniArt, m: LakeMap) {
  const g = a.composed.getContext('2d')!;
  g.clearRect(0, 0, a.pw, a.ph);
  g.fillStyle = FOG;
  g.fillRect(0, 0, a.pw, a.ph);
  for (let i = 0; i < m.seen.length; i++) if (m.seen[i]) reveal(a, m, i);
  m.newlySeen(scratch); // as novas já estão incluídas
}

/** Tamanho lógico do minimapa para a largura de tela (altura segue a proporção da grade). */
export function minimapSize(m: LakeMap, W: number) {
  const mw = Math.max(120, Math.min(190, W * 0.22));
  return { mw, mh: Math.round((mw * m.rows) / m.cols) };
}

/** `k` = pixels de tela por unidade lógica do HUD. */
export function drawLakeMinimap(g: CanvasRenderingContext2D, w: World, m: LakeMap, x: number, y: number, mw: number, mh: number, k: number, t: number) {
  let a = cache.get(m);
  const pw = Math.max(8, Math.round(mw * k)), ph = Math.max(8, Math.round(mh * k));
  if (!a || a.pw !== pw || a.ph !== ph) { a = bake(m, mw, mh, k); cache.set(m, a); }
  if (a.epoch !== m.epoch) { recompose(a, m); a.epoch = m.epoch; }
  else if (m.newlySeen(scratch)) for (let i = 0; i < scratch.length; i++) reveal(a, m, scratch[i]);
  g.drawImage(a.frame, 0, 0, a.frame.width, a.frame.height, x - 5, y - 5, mw + 10, mh + 10);
  g.drawImage(a.composed, 0, 0, a.pw, a.ph, x, y, mw, mh);
  const gx = (px: number) => x + ((px / (LAKE_CELL_TILES * TILE) - m.x0) / m.cols) * mw;
  const gy = (py: number) => y + ((py / (LAKE_CELL_TILES * TILE) - m.y0) / m.rows) * mh;
  // relíquias vistas e ainda não coletadas
  if (!a.relics.length) for (const p of w.data.pickups) if (p.kind === 'relic') a.relics.push({ id: p.id, x: p.x, y: p.y });
  for (const p of a.relics) {
    if (w.collectedPickups.has(p.id) || !m.isWater(p.x, p.y) || !m.isSeen(p.x, p.y)) continue;
    g.drawImage(a.relic, 0, 0, a.relic.width, a.relic.height, gx(p.x) - 4.5, gy(p.y) - 4.5, 9, 9);
  }
  // marcos descobertos
  for (let i = 0; i < ATLANTIS_LANDMARKS.length; i++) {
    const lm = ATLANTIS_LANDMARKS[i];
    if (!m.landmarkSeen(lm.id)) continue;
    g.drawImage(a.pin, 0, 0, a.pin.width, a.pin.height, gx(lm.tx * TILE + 16) - 4, gy(lm.ty * TILE) - 4, 8, 8);
  }
  // o Karimbo: ponto que pulsa
  const p = w.player;
  const r = 2.4 + Math.sin(t * 6) * 0.7;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(gx(p.x), gy(p.y), r + 1.2, 0, 6.283);
  g.fill();
  g.fillStyle = '#ff3f7a';
  g.beginPath();
  g.arc(gx(p.x), gy(p.y), r, 0, 6.283);
  g.fill();
}
