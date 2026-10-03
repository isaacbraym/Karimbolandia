/**
 * Mercenários da selva (fase 2): mesmo esqueleto/animação dos soldados, mas roupa de mercenário de
 * verdade — calça camuflada, camiseta/camisa com manga dobrada, colete tático com porta-carregadores,
 * lenço tático no rosto, chapéu de selva, boné e capacete velho; armas com madeira (fuzil, espingarda
 * de dois canos, rifle de caça). Nada de armadura futurista.
 */
import { bake, shadedRR, shadedEllipse, poly, OUT, type Sprite } from './kit';
import { shade } from '../core/math';
import { GUN_LEN, type SoldierArt, type SoldierStyle } from './soldiers';
import { clothFinish } from './volume';

const S = 2;

interface Look {
  camo: string[];
  skin: string;
  shirt: string;
  vest: string | null;
  pants: string;
  boot: string;
  cloth: string; // bandana/faixa
  hair: string;
}

const WOODLAND = ['#2f3a22', '#5a4a2e', '#1c2216'];
const DESERT = ['#a8946a', '#7a6a48', '#5a4a34'];
const LOOKS: Record<SoldierStyle, Look> = {
  rifle: { camo: WOODLAND, skin: '#c98a5e', shirt: '#4f5a36', vest: '#3a4228', pants: '#5d6a42', boot: '#2a2016', cloth: '#b8a27a', hair: '#1a1410' },
  shotgun: { camo: DESERT, skin: '#a8714a', shirt: '#8a7a56', vest: '#6e5a3a', pants: '#b8a47a', boot: '#3a2a1c', cloth: '#a8946a', hair: '#1a120c' },
  shield: { camo: WOODLAND, skin: '#8a5a3a', shirt: '#3a3a30', vest: '#2e3226', pants: '#4f5a3a', boot: '#1e1810', cloth: '#4a5236', hair: '#120c08' },
  jetpack: { camo: WOODLAND, skin: '#c98a5e', shirt: '#4f5a36', vest: '#3a4228', pants: '#5d6a42', boot: '#2a2016', cloth: '#b8a27a', hair: '#1a1410' },
  sniper: { camo: WOODLAND, skin: '#b97c52', shirt: '#4f5f34', vest: '#5d6a3a', pants: '#4a5a32', boot: '#2a2216', cloth: '#6f7f44', hair: '#2a1c14' },
};

/** Manchas de camuflagem dentro do retângulo (recortadas pelo próprio contorno da peça). */
function camo(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cols: string[], seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  for (let i = 0; i < 9; i++) {
    g.fillStyle = cols[i % cols.length];
    g.globalAlpha = 0.8;
    g.beginPath();
    g.ellipse(x + rnd() * w, y + rnd() * h, 1.2 + rnd() * 2.4, 0.8 + rnd() * 1.6, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

const WOOD = '#8a5a30';
const WOOD_D = '#5c3a1c';
const STEEL = '#4a4c58';
const STEEL_D = '#2c2d36';

export function bakeBandit(style: SoldierStyle, variant = 0): SoldierArt {
  const base = LOOKS[style];
  const L: Look = variant === 1 ? { ...base, skin: '#8e604c', shirt: '#687887', pants: '#756857', cloth: '#ba995e', camo: DESERT }
    : variant === 2 ? { ...base, skin: '#dfab83', shirt: '#765044', pants: '#3a4944', cloth: '#6f8178', camo: ['#29413a','#637761','#202d29'] } : base;
  const head = bake(
    22,
    22,
    (g) => {
      // cabeça (rosto voltado para +x)
      shadedEllipse(g, 11, 12, 8.4, 9, L.skin, { lw: 1.1 });
      // orelha
      g.fillStyle = shade(L.skin, -0.12);
      g.beginPath();
      g.ellipse(6.6, 12.6, 1.8, 2.4, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 0.7;
      g.stroke();
      // sobrancelha grossa e olho desconfiado
      g.fillStyle = L.hair;
      g.fillRect(13.4, 8.6, 5.2, 1.4);
      g.fillStyle = '#ffffff';
      g.fillRect(14.4, 10.2, 3.2, 1.9);
      g.fillStyle = '#1a120c';
      g.fillRect(16, 10.3, 1.5, 1.8);
      // nariz
      g.fillStyle = shade(L.skin, -0.18);
      g.beginPath();
      g.moveTo(18.8, 11);
      g.lineTo(20.4, 14.2);
      g.lineTo(18.4, 14.4);
      g.closePath();
      g.fill();
      if (style === 'rifle' || style === 'jetpack') {
        // lenço tático (shemagh) cobrindo boca e nariz + gorro preto
        poly(g, [[6.6, 13.2], [20.8, 12.6], [20.2, 17.6], [14, 20.8], [7.4, 18.6]], L.cloth, { lw: 0.9 });
        g.strokeStyle = 'rgba(90,70,40,0.6)';
        g.lineWidth = 0.5;
        for (let x = 8; x < 20; x += 2.2) {
          g.beginPath();
          g.moveTo(x, 13);
          g.lineTo(x - 1, 19);
          g.stroke();
        }
        poly(g, [[3, 9.4], [6, 3], [15, 2.2], [19.4, 6], [19.2, 8.4], [3.4, 10.6]], '#22222a', { lw: 0.9 });
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(6, 4, 9, 1.2);
        g.fillStyle = '#3a3a44';
        g.fillRect(3.6, 8.2, 15.4, 1.6);
      } else if (style === 'shotgun') {
        // bigodão, barba por fazer e chapéu de palha de aba larga
        g.fillStyle = 'rgba(40,24,16,0.35)';
        g.beginPath();
        g.ellipse(14, 17.2, 6, 3.2, 0, 0, Math.PI * 2);
        g.fill();
        poly(g, [[13.2, 14.6], [20.6, 14.2], [21.2, 16.6], [17, 15.6], [13.6, 16.8]], L.hair, { lw: 0.6 });
        g.fillStyle = '#7a3a2a';
        g.fillRect(16.6, 17, 3, 0.9);
        // óculos escuros de aviador
        poly(g, [[13.4, 9.8], [20.4, 9.6], [20, 12.6], [17.6, 12.8], [16.8, 11], [14, 12.4]], '#14161e', { lw: 0.6 });
        g.fillStyle = 'rgba(160,220,255,0.5)';
        g.fillRect(18, 10.2, 1.6, 0.8);
        // chapéu de selva (boonie) camuflado
        poly(g, [[-0.4, 8.8], [22.4, 7.8], [21.4, 9.8], [0.6, 10.6]], L.camo[1], { lw: 0.9 });
        poly(g, [[4.4, 8.6], [5.6, 2], [16.6, 1.6], [18.2, 8]], L.cloth, { lw: 0.9 });
        camo(g, 4.6, 1.6, 13.6, 7, L.camo, 7);
        g.fillStyle = L.camo[2];
        g.fillRect(4.8, 6.4, 13, 1.4);
      } else if (style === 'shield') {
        // careca com cicatriz, barba fechada e boné virado
        g.fillStyle = L.hair;
        g.beginPath();
        g.ellipse(13.4, 17, 6.4, 3.8, 0.1, 0, Math.PI);
        g.fill();
        g.fillStyle = '#7a2a22';
        g.fillRect(15.6, 16.4, 3.2, 1);
        // capacete de aço velho (redinha de camuflagem) com jugular solta
        g.beginPath();
        g.ellipse(11, 8.6, 9.6, 6.8, 0, Math.PI, Math.PI * 2);
        g.lineTo(20.6, 9.4);
        g.lineTo(1.4, 9.4);
        g.closePath();
        g.fillStyle = L.cloth;
        g.fill();
        g.strokeStyle = OUT;
        g.lineWidth = 0.9;
        g.stroke();
        g.strokeStyle = 'rgba(20,24,14,0.6)';
        g.lineWidth = 0.4;
        for (let x = 3; x < 20; x += 2) {
          g.beginPath();
          g.moveTo(x, 3);
          g.lineTo(x + 2, 9);
          g.moveTo(x + 2, 3);
          g.lineTo(x, 9);
          g.stroke();
        }
        g.strokeStyle = '#2a2016';
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(5, 9.4);
        g.quadraticCurveTo(4.4, 15, 7, 18);
        g.stroke();
        g.strokeStyle = '#e8b0a0';
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(12.4, 9.6);
        g.lineTo(14.6, 13.6);
        g.stroke();
      } else {
        // sniper: chapéu de selva com galhos de camuflagem e pintura no rosto
        g.fillStyle = 'rgba(50,70,30,0.55)';
        g.fillRect(12.6, 12.4, 8, 1.4);
        g.fillRect(13.6, 14.6, 6, 1.2);
        g.fillStyle = 'rgba(30,20,10,0.4)';
        g.beginPath();
        g.ellipse(14, 17.6, 5, 2.6, 0, 0, Math.PI * 2);
        g.fill();
        poly(g, [[0, 8.4], [22, 7.6], [21, 10], [1, 10.6]], L.cloth, { lw: 0.9 });
        poly(g, [[4.4, 8.4], [6.4, 2.6], [15.4, 2.2], [17.6, 8]], shade(L.cloth, 0.08), { lw: 0.9 });
        g.strokeStyle = '#3f6a22';
        g.lineWidth = 1.1;
        for (const [x, a] of [[7, -0.6], [11, -0.1], [15, 0.5]] as [number, number][]) {
          g.beginPath();
          g.moveTo(x, 3);
          g.lineTo(x + Math.sin(a) * 5, 3 - Math.cos(a) * 5);
          g.stroke();
        }
        g.fillStyle = '#5c8a32';
        for (const [x, y] of [[4.6, -1], [11, -2.2], [18.4, -0.4]]) {
          g.beginPath();
          g.ellipse(x, y, 2, 1.1, 0.4, 0, Math.PI * 2);
          g.fill();
        }
      }
    },
    { scale: S, ox: 11, oy: 17 }
  );

  const torso = bake(
    22,
    22,
    (g) => {
      const wide = style === 'shield' ? 1.4 : style === 'shotgun' ? 0.8 : 0;
      // camisa/regata (braços nus em quem usa regata)
      shadedRR(g, 3.6 - wide, 2, 15 + wide * 2, 18.6, 4.4, L.shirt, { lw: 1.1 });
      clothFinish(g, 3.6 - wide, 2, 15 + wide * 2, 18.6, L.shirt);
      // gola em V da camiseta
      g.fillStyle = L.skin;
      g.beginPath();
      g.moveTo(8.4, 2.2);
      g.lineTo(13.6, 2.2);
      g.lineTo(11, 5.4);
      g.closePath();
      g.fill();
      if (L.vest) {
        // colete tático (chest rig): alças, painel e porta-carregadores com tampa
        poly(g, [[4.6 - wide, 2.4], [7.6, 2.4], [8.4, 9], [4.4 - wide, 9.6]], L.vest, { lw: 0.8 });
        poly(g, [[14.4, 2.4], [17.4 + wide, 2.4], [17.6 + wide, 9.6], [13.6, 9]], L.vest, { lw: 0.8 });
        shadedRR(g, 3.6 - wide, 8.6, 14.8 + wide * 2, 8.4, 1.6, L.vest, { lw: 0.9 });
        for (let i = 0; i < 3; i++) {
          shadedRR(g, 5 - wide * 0.5 + i * 4.3, 9.6, 3.8, 5.8, 0.8, shade(L.vest, 0.08), { lw: 0.6, shine: false });
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(5 - wide * 0.5 + i * 4.3, 11.2, 3.8, 0.7);
        }
        // rádio no ombro
        shadedRR(g, 15.6 + wide * 0.5, 1.4, 2.6, 4.4, 0.6, '#1e2024', { lw: 0.6, shine: false });
        g.fillStyle = '#1e2024';
        g.fillRect(16.6 + wide * 0.5, -1.2, 0.6, 3);
      }
      if (style === 'sniper') {
        g.strokeStyle = '#2e2216';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(17, 3);
        g.lineTo(5, 17);
        g.stroke();
      }
      // cinto com fivela
      shadedRR(g, 3.2 - wide, 16.6, 15.6 + wide * 2, 3.6, 1.2, '#3a2416', { lw: 0.9, shine: false });
      g.fillStyle = '#d6b04a';
      g.fillRect(9.6, 17.2, 2.8, 2.4);
      shadedRR(g, 14.8, 16, 4.7, 5, .9, L.cloth, { lw: .6, shine: false });
      g.fillStyle = '#d7c38d'; g.fillRect(16.4, 17, 1.1, .8);
      // facão na cintura
      poly(g, [[3.6, 18], [2.2, 22], [3.6, 22.4], [5.2, 18.4]], '#9a9aa8', { lw: 0.6 });
    },
    { scale: S, ox: 11, oy: 22 }
  );

  const legF = bake(
    10,
    17,
    (g) => {
      shadedRR(g, 1.5, 0, 7, 12, 2.2, L.pants, { lw: 1 });
      camo(g, 2, 0.5, 6, 11, L.camo, 11);
      // bolso cargo
      shadedRR(g, 2.4, 4.4, 4.2, 3.6, 0.6, shade(L.pants, -0.08), { lw: 0.5, shine: false });
      // costura e joelho gasto
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(6.6, 0.6);
      g.lineTo(6.6, 11);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(2.6, 5.4, 4.2, 2.4);
      shadedRR(g, 0.6, 10.4, 9.4, 6.4, 2, L.boot, { lw: 1 });
      g.fillStyle = shade(L.boot, 0.25);
      g.fillRect(1.4, 10.8, 7.4, 1.2);
    },
    { scale: S, ox: 5, oy: 1 }
  );
  const legB = bake(
    10,
    17,
    (g) => {
      shadedRR(g, 1.5, 0, 7, 12, 2.2, shade(L.pants, -0.22), { lw: 1 });
      camo(g, 2, 0.5, 6, 11, L.camo.map((c) => shade(c, -0.2)), 23);
      shadedRR(g, 0.6, 10.4, 9.4, 6.4, 2, shade(L.boot, -0.15), { lw: 1 });
    },
    { scale: S, ox: 5, oy: 1 }
  );
  const bare = false;
  const mkArm = (dark: boolean) =>
    bake(
      17,
      8,
      (g) => {
        const skin = dark ? shade(L.skin, -0.22) : L.skin;
        const sleeve = dark ? shade(L.shirt, -0.22) : L.shirt;
        if (bare) shadedRR(g, 0.4, 0.8, 9, 6.4, 3, skin, { lw: 1 });
        else shadedRR(g, 0.4, 0.6, 8.4, 6.8, 3, sleeve, { lw: 1 });
        shadedRR(g, 7, 1.6, 6.4, 4.8, 2, skin, { lw: 0.9 });
        // pulseira de couro + mão
        g.fillStyle = '#3a2416';
        g.fillRect(10.6, 1.8, 1.4, 4.4);
        shadedRR(g, 11.6, 1.4, 5, 5.2, 2.2, skin, { lw: 0.9 });
        if (!dark && bare) {
          // tatuagem
          g.strokeStyle = 'rgba(30,40,80,0.6)';
          g.lineWidth = 0.6;
          g.beginPath();
          g.arc(4.6, 4, 1.6, 0, Math.PI * 2);
          g.stroke();
        }
      },
      { scale: S, ox: 3, oy: 4 }
    );

  const gunLen = GUN_LEN[style];
  const gun = bake(
    gunLen + 6,
    11,
    (g) => {
      if (style === 'sniper') {
        // rifle de caça: coronha de madeira longa, luneta
        poly(g, [[0.4, 3.6], [9, 3.2], [12, 5.4], [11, 7.2], [3, 7.6], [0.4, 6]], WOOD, { lw: 0.9 });
        shadedRR(g, 10, 3.4, 22, 2.6, 1, STEEL, { lw: 0.8 });
        shadedRR(g, 10, 5.4, 14, 2.4, 1, WOOD, { lw: 0.8 });
        shadedRR(g, 13, 0.6, 10, 2.8, 1.2, STEEL_D, { lw: 0.8 });
        g.fillStyle = '#9ad1ff';
        g.fillRect(22.4, 1.2, 1, 1.6);
        g.fillStyle = WOOD_D;
        g.fillRect(4, 4.4, 4, 0.8);
      } else if (style === 'shotgun') {
        // espingarda de dois canos (cano serrado)
        poly(g, [[0.4, 4], [8, 3.4], [10, 5.6], [9, 7.8], [2.4, 8], [0.4, 6.6]], WOOD, { lw: 0.9 });
        shadedRR(g, 8, 3, 6, 4.4, 1.2, STEEL_D, { lw: 0.8 });
        shadedRR(g, 13, 2.8, 15, 2.2, 0.8, '#6a6c78', { lw: 0.7 });
        shadedRR(g, 13, 4.8, 15, 2.2, 0.8, '#55576a', { lw: 0.7 });
        shadedRR(g, 14, 6.6, 7, 2, 0.8, WOOD, { lw: 0.6 });
      } else {
        // fuzil velho com coronha e guarda-mão de madeira, carregador curvo
        poly(g, [[0.4, 3.4], [7.4, 3.4], [8.6, 5.6], [7.4, 7.8], [1.6, 7.6], [0.4, 6.2]], WOOD, { lw: 0.9 });
        shadedRR(g, 7, 3, 9, 4.4, 1.2, STEEL, { lw: 0.8 });
        shadedRR(g, 15, 3.8, 6, 3, 1, WOOD, { lw: 0.8 });
        shadedRR(g, 20, 4.2, 7, 1.6, 0.6, STEEL_D, { lw: 0.6 });
        poly(g, [[10.6, 7.2], [13.2, 7.2], [13.8, 10.4], [11.6, 10.8]], STEEL_D, { lw: 0.7 });
        g.fillStyle = '#c8a050';
        g.fillRect(8, 2.4, 1.2, 1);
      }
    },
    { scale: S, ox: 6, oy: 5.4 }
  );

  let extra: Sprite | null = null;
  if (style === 'shield') {
    // escudo improvisado: tábuas pregadas com uma chapa de metal velha
    extra = bake(
      16,
      40,
      (g) => {
        for (let i = 0; i < 3; i++) shadedRR(g, 2.4 + i * 4.2, 1 + (i % 2), 4.4, 38 - (i % 2) * 2, 1, i % 2 ? '#9a6a3a' : WOOD, { lw: 0.8 });
        shadedRR(g, 2, 13, 13.6, 10, 1.4, '#7a7e88', { lw: 0.8 });
        g.fillStyle = 'rgba(160,80,40,0.55)';
        g.fillRect(4, 15, 4, 3);
        g.fillRect(10, 19, 3, 2);
        g.fillStyle = '#cfd2da';
        for (const [x, y] of [[3.4, 4], [13.4, 4], [3.4, 35], [13.4, 35], [3.6, 14.4], [14, 21.6]]) g.fillRect(x, y, 1.2, 1.2);
        shadedRR(g, 2.2, 6, 13.8, 2.4, 0.8, WOOD_D, { lw: 0.6, shine: false });
        shadedRR(g, 2.2, 30, 13.8, 2.4, 0.8, WOOD_D, { lw: 0.6, shine: false });
      },
      { scale: S, ox: 2, oy: 34 }
    );
  }
  return { head, torso, legF, legB, armF: mkArm(false), armB: mkArm(true), gun, extra, gunLen, gunGrip: 6 };
}
