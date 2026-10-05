/**
 * HUD do boxe: barras de vida (retrato do Karimbo e cabeça do jacaré), energia do Karimbo, medidor de
 * combo, marcas das três fases do jacaré, "FÚRIA!" e o letreiro da vez do golpe final. Barras são
 * retângulos de cor sólida; textos vêm do cache de `fx.txt` (nada criado por quadro).
 */
import { drawSprShrunk } from '../../kit';
import { getArt } from '../../index';
import { gatorParts } from '../../dancingAlligator';
import type { BoxingMatch } from '../../../game/minigames/boxing/sim/match';
import { PHASE2_AT, PHASE3_AT } from '../../../game/minigames/boxing/sim/rules';
import { txt } from './fx';

function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, fill: string, back = 'rgba(23,15,46,.85)') {
  g.fillStyle = back; g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = '#170f2e'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, y, w, h);
  g.fillStyle = fill; g.fillRect(x, y, Math.max(0, w * Math.max(0, Math.min(1, f))), h);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, Math.max(0, w * Math.max(0, Math.min(1, f))), Math.max(1, h * 0.28));
}

let kShown = 1, gShown = 1;
export function resetHud() { kShown = gShown = 1; }

/** `k` = pixels de tela por unidade lógica (para os ícones pequenos). */
export function drawBoxHud(g: CanvasRenderingContext2D, m: BoxingMatch, W: number, H: number, time: number, k: number) {
  const art = getArt();
  const u = H / 360;
  const pad = 14 * u;
  const bw = Math.min(W * 0.36, 250 * u), bh = 11 * u;
  kShown += (m.k.hp / m.k.maxHp - kShown) * 0.18;
  gShown += (m.g.hp / m.g.maxHp - gShown) * 0.18;
  // Karimbo (esquerda): retrato + vida + energia
  g.save();
  drawSprShrunk(g, art.karimbo.heads.portrait, pad + 26 * u, pad + 28 * u, 0.9 * u, k);
  const bx = pad + 58 * u;
  bar(g, bx, pad + 6 * u, bw, bh, kShown, m.k.hp / m.k.maxHp < 0.25 && Math.floor(time * 6) % 2 === 0 ? '#ff5a5a' : '#ff3f7a');
  bar(g, bx, pad + 6 * u + bh + 6 * u, bw * 0.82, 7 * u, m.k.energy / m.k.maxHp, m.k.energy < 18 ? '#ffb347' : '#3fd6ff');
  txt(g, 'KARIMBO', bx, pad + 6 * u + bh + 30 * u, 10 * u, '#ffffff', 'left');
  // jacaré (direita): cabeça + vida com as marcas das fases
  const gx = W - pad - bw;
  const head = gatorParts().head;
  drawSprShrunk(g, head, W - pad - 20 * u, pad + 32 * u, 0.55 * u, k);
  const gxb = gx - 48 * u;
  bar(g, gxb, pad + 6 * u, bw, bh, gShown, m.g.phase === 3 ? '#ff5a3a' : '#8bd05a');
  g.fillStyle = '#ffffff';
  for (const f of [PHASE2_AT, PHASE3_AT]) g.fillRect(gxb + bw * f - 1, pad + 4 * u, 2, bh + 4 * u);
  txt(g, 'JACARÉ', gxb + bw, pad + 6 * u + bh + 16 * u, 10 * u, '#ffffff', 'right');
  if (m.g.phase === 3 && m.cine === 'none') txt(g, 'FÚRIA!', gxb + bw / 2, pad + 6 * u + bh + 32 * u, 12 * u, Math.floor(time * 8) % 2 ? '#ff5a3a' : '#ffd23a', 'center');
  // combo
  if (m.combo > 0) txt(g, `COMBO x${m.combo}`, W / 2, pad + 22 * u, 14 * u, '#ffe27a', 'center');
  g.restore();
}
