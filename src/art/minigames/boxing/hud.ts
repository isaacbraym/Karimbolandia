/**
 * HUD do boxe 2.0 (tudo em formas simples e texto em cache: nada criado por quadro): vida com a barra
 * "fantasma" do dano recente, energia, estrelas de orelha, medidor de Fúria, relógio e round, as quedas
 * de cada lutador, o SINAL colorido de defesa sobre o jacaré (amarelo guarda, laranja abaixa, vermelho
 * esquiva, com um anel que se fecha até o impacto: o tempo exato da esquiva perfeita), as dicas da luta
 * guiada, as faixas de round/intervalo/contagem do juiz e o cartão de resultado com a nota S–C.
 * Nada cobre o rosto do jacaré: tudo fica nas bordas ou nos espaços livres.
 */
import { drawSprShrunk, rrPath } from '../../kit';
import { getArt } from '../../index';
import { gatorParts } from '../../dancingAlligator';
import type { BoxingMatch, HintId } from '../../../game/minigames/boxing/sim/match';
import { ATTACKS, FURY_MAX, KD_G_TIME, KD_K_COUNT, MAX_KD_K, MAX_STARS, ROUNDS, type DefenseColor } from '../../../game/minigames/boxing/sim/rules';
import type { MatchResult } from '../../../game/minigames/boxing/sim/match';
import type { BoxLayout } from './layout';
import { txt } from './fx';

const COLOR: Record<DefenseColor, string> = { amarelo: '#ffd23a', laranja: '#ff8a2a', vermelho: '#ff3a3a' };
const OUT = '#170f2e';
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** dicas em duas linhas curtas (celular, teclado): ficam no espaço livre à esquerda, nunca sobre o rosto do jacaré */
const HINT: Record<HintId, [[string, string], [string, string]]> = {
  soco: [['TOQUE NA TELA = SOCO', 'ARRASTE PRA CIMA = GANCHO'], ['CLIQUE NA TELA = SOCO', 'ARRASTE PRA CIMA = GANCHO']],
  gancho: [['SAI DA GUARDA COM', 'O GANCHO! (arraste pra cima)'], ['SAI DA GUARDA COM', 'O GANCHO! (arraste pra cima)']],
  esquiva: [['VERMELHO: ESQUIVE!', 'analógico ◀ ou ▶'], ['VERMELHO: ESQUIVE!', '(A / D)']],
  abaixar: [['LARANJA: ABAIXE!', 'analógico ▼'], ['LARANJA: ABAIXE!', '(S ou ↓)']],
  descansa: [['RESPIRA!', 'defender dá fôlego'], ['RESPIRA!', 'defender dá fôlego']],
  lido: [['ELE LEU O SEU SOCO!', 'VARIE OS GOLPES'], ['ELE LEU O SEU SOCO!', 'VARIE OS GOLPES']],
};

let kShown = 1, gShown = 1, kGhost = 1, gGhost = 1;
export function resetHud() { kShown = gShown = kGhost = gGhost = 1; }

function bar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, fill: string, ghost = -1) {
  g.fillStyle = OUT; g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, y, w, h);
  if (ghost > f) { g.fillStyle = '#fff1b8'; g.fillRect(x, y, w * Math.max(0, Math.min(1, ghost)), h); }
  g.fillStyle = fill; g.fillRect(x, y, Math.max(0, w * Math.max(0, Math.min(1, f))), h);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, Math.max(0, w * Math.max(0, Math.min(1, f))), Math.max(1, h * 0.28));
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.46 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath();
  g.fillStyle = fill; g.fill();
  g.lineWidth = Math.max(1, r * 0.2); g.strokeStyle = OUT; g.stroke();
}

const mmss = (s: number) => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

/** `k` = pixels de tela por unidade lógica (para os ícones pequenos). */
export function drawBoxHud(g: CanvasRenderingContext2D, m: BoxingMatch, W: number, H: number, time: number, k: number, L?: BoxLayout) {
  const art = getArt();
  const u = H / 360;
  const pad = 12 * u;
  const rpad = pad + 40 * u; // o botão de pausa fica no canto de cima, à direita
  const bw = Math.min(W * 0.33, 226 * u), bh = 11 * u;
  const kf = m.k.hp / m.k.maxHp, gf = m.g.hp / m.g.maxHp;
  kShown += (kf - kShown) * 0.3; gShown += (gf - gShown) * 0.3;
  kGhost = kf > kGhost ? kf : kGhost + (kf - kGhost) * 0.035;
  gGhost = gf > gGhost ? gf : gGhost + (gf - gGhost) * 0.035;
  g.save();
  // ── Karimbo (esquerda): retrato, vida, energia, estrelas e Fúria
  drawSprShrunk(g, art.karimbo.heads.portrait, pad + 25 * u, pad + 27 * u, 0.9 * u, k);
  const bx = pad + 56 * u;
  bar(g, bx, pad + 5 * u, bw, bh, kShown, kf < 0.25 && Math.floor(time * 6) % 2 === 0 ? '#ff5a5a' : '#ff3f7a', kGhost);
  bar(g, bx, pad + 5 * u + bh + 5 * u, bw * 0.78, 6 * u, m.k.energy / 100, m.k.energy < 18 ? '#ffb347' : '#3fd6ff');
  for (let i = 0; i < MAX_STARS; i++) star(g, bx + 8 * u + i * 17 * u, pad + 5 * u + bh + 22 * u, 7 * u, i < m.stars ? '#ffd23a' : 'rgba(255,255,255,.2)');
  // medidor de Fúria (laranja; cheio e brilhando enquanto dura)
  const fx = bx + 62 * u, fw = bw * 0.5;
  bar(g, fx, pad + 5 * u + bh + 18 * u, fw, 5 * u, m.fury / FURY_MAX, m.furyOn ? (Math.floor(time * 10) % 2 ? '#ffd23a' : '#ff7a2a') : '#ff9a3a');
  if (m.furyOn) txt(g, 'FÚRIA!', fx + fw + 8 * u, pad + 5 * u + bh + 24 * u, 9 * u, '#ffb25a', 'left');
  txt(g, 'KARIMBO', bx, pad + 5 * u + bh + 44 * u, 9 * u, '#ffffff', 'left');
  for (let i = 0; i < MAX_KD_K - 1; i++) { g.beginPath(); g.arc(bx + 58 * u + i * 9 * u, pad + 5 * u + bh + 40.5 * u, 3.2 * u, 0, Math.PI * 2); g.fillStyle = i < m.kdK ? '#ff5a5a' : 'rgba(255,255,255,.18)'; g.fill(); }
  // ── jacaré (direita): cabeça, vida (as quedas aparecem como marcas) e fúria do round 3
  const gx0 = W - rpad - bw;
  drawSprShrunk(g, gatorParts().head, W - pad - 20 * u - 38 * u, pad + 30 * u, 0.55 * u, k);
  bar(g, gx0, pad + 5 * u, bw, bh, gShown, m.round === 3 ? '#ff5a3a' : '#8bd05a', gGhost);
  txt(g, 'JACARÉ', gx0 + bw, pad + 5 * u + bh + 17 * u, 9 * u, '#ffffff', 'right');
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(gx0 + bw - 4 * u - i * 9 * u, pad + 5 * u + bh + 26 * u, 3.2 * u, 0, Math.PI * 2); g.fillStyle = i < m.kdG ? '#ffd23a' : 'rgba(255,255,255,.18)'; g.fill(); }
  if (m.round === 3 && m.cine === 'none') txt(g, 'JACARÉ FURIOSO', gx0, pad + 5 * u + bh + 17 * u, 9 * u, Math.floor(time * 8) % 2 ? '#ff5a3a' : '#ffd23a', 'left');
  // ── centro: round e relógio
  const cw = 96 * u;
  g.fillStyle = 'rgba(23,15,46,.82)'; rrPath(g, W / 2 - cw / 2, pad * 0.6, cw, 40 * u, 10 * u); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.4 * u; g.stroke();
  txt(g, `ROUND ${m.round}/${ROUNDS}`, W / 2, pad * 0.6 + 14 * u, 10 * u, '#ffe27a', 'center');
  txt(g, m.flow === 'intro' ? '0:60' : mmss(m.roundT), W / 2, pad * 0.6 + 34 * u, 19 * u, m.roundT < 10 && m.flow === 'fight' && Math.floor(time * 4) % 2 ? '#ff8a8a' : '#ffffff', 'center');
  if (m.combo > 0) txt(g, `COMBO x${m.combo}`, W / 2, pad * 0.6 + 56 * u, 11 * u, '#ffe27a', 'center');
  g.restore();
  if (L) drawTeleCue(g, L, m, time);
  drawHint(g, m, W, H);
  drawFlow(g, m, W, H, time);
}

/** Sinal de defesa sobre o jacaré: cor = como se defender; o anel se fecha até o impacto (esquiva perfeita no fim). */
function drawTeleCue(g: CanvasRenderingContext2D, L: BoxLayout, m: BoxingMatch, time: number) {
  if (m.g.mode !== 'tele' || !m.g.attack || m.cine !== 'none') return;
  const def = ATTACKS[m.g.attack];
  const u = L.u, col = COLOR[def.color];
  const t01 = 1 - m.g.tele / Math.max(1e-6, m.g.teleMax);
  const x = L.head.x + 82 * u, y = L.head.y - 34 * u, r = 17 * u;
  g.save();
  g.translate(x, y);
  // anel externo que se fecha sobre o círculo
  const ro = r + (1 - t01) * 26 * u;
  g.lineWidth = 3.2 * u; g.strokeStyle = col; g.globalAlpha = 0.35 + 0.65 * t01;
  g.beginPath(); g.arc(0, 0, ro, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, r + 2.2 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(-r * 0.3, -r * 0.35, r * 0.4, 0, Math.PI * 2); g.fill();
  // símbolo: guarda (escudo), abaixar (setas para baixo) ou esquiva (setas para os lados)
  g.strokeStyle = OUT; g.fillStyle = OUT; g.lineWidth = 2.6 * u; g.lineCap = 'round'; g.lineJoin = 'round';
  if (def.color === 'amarelo') { g.beginPath(); g.moveTo(0, -8 * u); g.lineTo(7 * u, -5 * u); g.lineTo(7 * u, 2 * u); g.quadraticCurveTo(7 * u, 8 * u, 0, 10 * u); g.quadraticCurveTo(-7 * u, 8 * u, -7 * u, 2 * u); g.lineTo(-7 * u, -5 * u); g.closePath(); g.fill(); }
  else if (def.color === 'laranja') { g.beginPath(); g.moveTo(-7 * u, -6 * u); g.lineTo(0, 1 * u); g.lineTo(7 * u, -6 * u); g.moveTo(-7 * u, 2 * u); g.lineTo(0, 9 * u); g.lineTo(7 * u, 2 * u); g.stroke(); }
  else { g.beginPath(); g.moveTo(-3 * u, -7 * u); g.lineTo(-9 * u, 0); g.lineTo(-3 * u, 7 * u); g.moveTo(3 * u, -7 * u); g.lineTo(9 * u, 0); g.lineTo(3 * u, 7 * u); g.stroke(); }
  g.restore();
  void time;
}

function drawHint(g: CanvasRenderingContext2D, m: BoxingMatch, W: number, H: number) {
  if (!m.hint || m.cine !== 'none' || m.flow !== 'fight') return;
  const u = H / 360, lines = HINT[m.hint][coarse ? 0 : 1];
  const cx = W * 0.31, w = Math.max(...lines.map((l) => l.length)) * 6.6 * u + 26 * u, h = 40 * u, x = cx - w / 2, y = H * 0.19;
  const a = Math.min(1, m.hintT * 3);
  g.fillStyle = 'rgba(23,15,46,.84)'; rrPath(g, x, y, w, h, 9 * u); g.fill();
  g.strokeStyle = 'rgba(255,226,122,.6)'; g.lineWidth = 1.4 * u; g.stroke();
  txt(g, lines[0], cx, y + 16 * u, 11 * u, '#ffe27a', 'center', a);
  txt(g, lines[1], cx, y + 31 * u, 11 * u, '#ffffff', 'center', a);
}

/** Faixas de cada momento: abertura do round, intervalo, contagem do juiz (nos dois sentidos) e o aviso do golpe especial. */
function drawFlow(g: CanvasRenderingContext2D, m: BoxingMatch, W: number, H: number, time: number) {
  const u = H / 360;
  if (m.cine === 'none' && m.flow === 'intro') {
    const k = 1 - m.flowT / 2.4;
    const s = 0.55 + 0.5 * Math.min(1, k * 4) + (k > 0.7 ? 0 : 0);
    if (k < 0.7) txt(g, `ROUND ${m.round}`, W / 2, H * 0.4, 46 * u, '#ffe27a', 'center', Math.min(1, k * 5), s);
    else txt(g, m.round === 3 ? 'FURIOSO!' : 'LUTEM!', W / 2, H * 0.4, 46 * u, '#ff7a5a', 'center', 1, 1 + (k - 0.7) * 0.5);
  } else if (m.cine === 'none' && m.flow === 'break') {
    g.fillStyle = 'rgba(8,4,24,.38)'; g.fillRect(0, 0, W, H);
    txt(g, 'INTERVALO', W / 2, H * 0.34, 34 * u, '#ffe27a', 'center');
    txt(g, `a criançada abana o Karimbo • vida +15%`, W / 2, H * 0.34 + 22 * u, 12 * u, '#ffffff', 'center');
    txt(g, `PRÓXIMO ROUND EM ${Math.ceil(m.flowT)}`, W / 2, H * 0.34 + 46 * u, 15 * u, '#9fe07a', 'center');
    if (m.flowT < 5.5) txt(g, coarse ? 'toque para pular' : 'um soco para pular', W / 2, H * 0.34 + 66 * u, 11 * u, '#bfe8ff', 'center', 0.7 + 0.3 * Math.sin(time * 6));
  } else if (m.flow === 'kdG') {
    const n = Math.min(8, Math.floor((KD_G_TIME - m.flowT) / (KD_G_TIME / 8)) + 1);
    txt(g, String(n), W * 0.5, H * 0.3, 56 * u, '#ffffff', 'center', 1, 1 + (1 - (((KD_G_TIME - m.flowT) / (KD_G_TIME / 8)) % 1)) * 0.3);
    txt(g, 'O JUIZ CONTA...', W * 0.5, H * 0.3 + 22 * u, 12 * u, '#ffd23a', 'center');
  } else if (m.flow === 'kdK') {
    const k = m.k;
    g.fillStyle = 'rgba(60,0,10,.28)'; g.fillRect(0, 0, W, H);
    const n = Math.min(KD_K_COUNT, k.downCount);
    txt(g, String(n), W * 0.5, H * 0.3, 56 * u, n >= 8 ? '#ff6a6a' : '#ffffff', 'center');
    txt(g, 'VOCÊ CAIU! LEVANTE!', W * 0.5, H * 0.3 + 22 * u, 14 * u, '#ffd23a', 'center');
    // barra de levantar: martele qualquer botão
    const bw = Math.min(W * 0.4, 220 * u), bx = W / 2 - bw / 2, by = H * 0.3 + 38 * u;
    bar(g, bx, by, bw, 11 * u, k.getup, '#9fe07a');
    txt(g, coarse ? 'MARTELE A TELA!' : 'MARTELE OS BOTÕES!', W / 2, by + 28 * u, 13 * u, '#ffffff', 'center', 0.7 + 0.3 * Math.sin(time * 14));
  }
  // o golpe especial pronto: aviso no teclado (no celular, o botão grande já aparece)
  const sp = m.specialKind;
  if (sp && !coarse && m.cine === 'none' && m.flow === 'fight') {
    const label = sp === 'finale' ? '[ESPAÇO]  ORELHADA!' : `[ESPAÇO]  ORELHADA ${'★'.repeat(m.stars)}`;
    txt(g, label, W / 2, H * 0.93, 15 * u, sp === 'finale' ? '#ffe27a' : '#ffd23a', 'center', 0.75 + 0.25 * Math.sin(time * 10), 1 + 0.04 * Math.sin(time * 10));
  }
}

// ───────────────────────── cartão de resultado ─────────────────────────
export interface ResultView { r: MatchResult; newBest: boolean; canRematch: boolean; t: number; champion: boolean }
const GRADE_COLOR = { S: '#ffd23a', A: '#7fe07a', B: '#6fb8ff', C: '#b4b0c4' } as const;
const BY_TEXT = { orelhada: 'NOCAUTE COM A ORELHADA!', ko: 'NOCAUTE!', decision: 'VITÓRIA NA DECISÃO', tko: 'DERROTA POR TKO' } as const;

export function drawResultCard(g: CanvasRenderingContext2D, W: number, H: number, v: ResultView, time: number) {
  const u = H / 360, r = v.r, win = r.outcome === 'win';
  const a = Math.min(1, v.t * 3);
  g.save();
  g.globalAlpha = a * 0.7; g.fillStyle = '#08041a'; g.fillRect(0, 0, W, H);
  g.globalAlpha = a;
  const pw = Math.min(W * 0.62, 420 * u), ph = 218 * u, px = W / 2 - pw / 2, py = H / 2 - ph / 2 + 4 * u;
  g.fillStyle = OUT; rrPath(g, px - 3 * u, py - 3 * u, pw + 6 * u, ph + 6 * u, 18 * u); g.fill();
  const gr = g.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, '#3b2a78'); gr.addColorStop(1, '#1c1244');
  g.fillStyle = gr; rrPath(g, px, py, pw, ph, 16 * u); g.fill();
  txt(g, win ? (r.by === 'decision' ? BY_TEXT.decision : BY_TEXT[r.by]) : r.by === 'tko' ? BY_TEXT.tko : 'DERROTA NA DECISÃO', W / 2, py + 26 * u, 18 * u, win ? '#ffe27a' : '#ff9a8a', 'center');
  // nota
  const gx = px + 60 * u, gy = py + 98 * u, gc = GRADE_COLOR[r.grade];
  const pop = 1 + Math.max(0, 0.6 - v.t) * 1.2;
  g.save(); g.translate(gx, gy); g.scale(pop, pop);
  g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, 40 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = gc; g.beginPath(); g.arc(0, 0, 36 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-8 * u, -14 * u, 18 * u, 8 * u, -0.5, 0, Math.PI * 2); g.fill();
  g.restore();
  txt(g, r.grade, gx, gy + 20 * u, 56 * u, '#ffffff', 'center', 1, 1 + Math.max(0, 0.6 - v.t) * 0.8);
  if (v.newBest && win) txt(g, 'NOVA MELHOR NOTA!', gx, gy + 56 * u, 10 * u, '#ffd23a', 'center', 0.6 + 0.4 * Math.sin(time * 8));
  // números
  const st = r.stats, rx = px + 130 * u;
  const rows: [string, string][] = [
    ['TEMPO', mmss(r.time)], ['DANO SOFRIDO', `${Math.round(Math.min(100, (st.damageTaken / (st.maxHp * 2)) * 100))}%`],
    ['PERFEITAS', String(st.perfects)], ['ESTRELAS USADAS', String(st.starsUsed)], ['QUEDAS', String(st.knockdownsTaken)],
  ];
  rows.forEach(([l, val], i) => { const y = py + 62 * u + i * 21 * u; txt(g, l, rx, y, 11 * u, '#bfb2ff', 'left'); txt(g, val, px + pw - 22 * u, y, 13 * u, '#ffffff', 'right'); });
  if (v.champion && win) txt(g, 'VOCÊ DERROTOU O CAMPEÃO!', W / 2, py + ph - 38 * u, 12 * u, '#ffd23a', 'center', 0.7 + 0.3 * Math.sin(time * 7));
  const wait = v.t > 1.1;
  if (wait) {
    if (win) txt(g, coarse ? 'TOQUE PARA CONTINUAR' : 'APERTE UM GOLPE PARA CONTINUAR', W / 2, py + ph - 14 * u, 12 * u, '#9fe07a', 'center', 0.7 + 0.3 * Math.sin(time * 6));
    else if (v.canRematch) txt(g, coarse ? 'TOQUE = REVANCHE  •  « » OU DESLIZE PRA BAIXO = SAIR' : 'GOLPE = REVANCHE  •  A/D/S = SAIR', W / 2, py + ph - 14 * u, 11 * u, '#ffd0a0', 'center', 0.75 + 0.25 * Math.sin(time * 6));
    else txt(g, coarse ? 'TOQUE PARA SAIR' : 'APERTE UM GOLPE PARA SAIR', W / 2, py + ph - 14 * u, 12 * u, '#ffd0a0', 'center');
  }
  g.restore();
}
