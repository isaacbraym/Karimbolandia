/**
 * Nômad: camadas do recorte da imagem canônica (torre, chassi, esfera).
 * A arte original "olha" para a ESQUERDA; espelhamos quando o robô olha para a direita.
 * A esfera gira (textura rotacionada) sob o chassi; a torre inclina/recua ao mirar/atirar.
 */
import { drawSpr, glowSprite, softDot, type Sprite } from './kit';
import { imageToSprite, type Photos, type KarimboHeads } from './photo';
import { PAL } from './palette';

/** logical px por px do recorte original (altura total do robô ≈ 100px) */
export const NOMAD_LS = 100 / 766;

export interface NomadArt {
  upper: Sprite;
  frame: Sprite;
  sphere: Sprite;
  ls: number;
  W: number;
  H: number;
  sphereCX: number;
  sphereCY: number;
  pivot: [number, number]; // pivô da torre (orig px)
  cockpit: [number, number];
}

export function bakeNomad(p: Photos): NomadArt {
  const m = p.nomadMeta;
  const ls = NOMAD_LS;
  const W = m.size[0] * ls;
  const H = m.size[1] * ls;
  const cx = m.sphere.cx * ls;
  const px = (img: HTMLImageElement) => img.width / W;
  const upper = imageToSprite(p.nomadUpper, W, H, cx, H, px(p.nomadUpper));
  const frame = imageToSprite(p.nomadFrame, W, H, cx, H, px(p.nomadFrame));
  const sw = m.sphere.tex * ls;
  const sphere = imageToSprite(p.nomadSphere, sw, sw, sw / 2, sw / 2, p.nomadSphere.width / sw);
  return { upper, frame, sphere, ls, W, H, sphereCX: cx, sphereCY: m.sphere.cy * ls, pivot: m.turretPivot, cockpit: m.cockpit };
}

export interface NomadPose {
  facing: 1 | -1;
  roll: number;
  tilt: number; // + = mirando para cima (rad)
  aim: number;
  recoil: number; // 0..1
  flash: boolean;
  t: number;
  vx: number;
  vy: number;
  onGround: boolean;
  dashing: 0 | 1 | 2;
  alpha: number;
  hp01: number;
  pilot: boolean;
  earFlap: number;
  ready: boolean;
}

export function drawNomad(g: CanvasRenderingContext2D, art: NomadArt, heads: KarimboHeads | null, x: number, feetY: number, p: NomadPose) {
  if (p.alpha <= 0.01) return;
  const prevA = g.globalAlpha;
  g.globalAlpha = prevA * p.alpha;

  // sombra no chão
  const sh = softDot('#000000', 16);
  g.globalAlpha = prevA * p.alpha * 0.45;
  g.drawImage(sh.c, x - 30, feetY - 7, 60, 14);
  g.globalAlpha = prevA * p.alpha;

  g.save();
  g.translate(x, feetY);
  // arte original olha p/ esquerda → espelha quando olhando p/ direita
  if (p.facing === 1) g.scale(-1, 1);

  const ls = art.ls;
  const w = p.flash;
  const bob = p.onGround ? Math.sin(p.t * 9) * Math.min(1, Math.abs(p.vx) / 200) * 0.8 : 0;
  const lean = -p.facing * Math.max(-0.12, Math.min(0.12, (p.vx / 260) * 0.09)); // inclina no sentido do movimento (espaço da arte)
  const sphereY = -(art.H - art.sphereCY);

  // rastro do avanço (silhuetas): no espaço da arte o "atrás" é sempre +x
  if (p.dashing) {
    g.globalCompositeOperation = 'lighter';
    const n = p.dashing === 2 ? 6 : 4;
    for (let i = n; i >= 1; i--) {
      const off = i * (p.dashing === 2 ? 20 : 15);
      const a = 0.32 - i * (p.dashing === 2 ? 0.04 : 0.06);
      if (a <= 0) continue;
      drawSpr(g, art.frame, off, 0, { white: true, alpha: a });
      drawSpr(g, art.upper, off, 0, { white: true, alpha: a });
    }
    g.globalCompositeOperation = 'source-over';
  }

  // esfera (gira sob o chassi)
  g.save();
  g.translate(0, sphereY);
  g.rotate(-p.facing * p.roll);
  drawSpr(g, art.sphere, 0, 0, { white: w });
  g.restore();
  // sombreamento fixo sobre a esfera (esconde o sombreado "embutido" que gira)
  {
    const r = (art.sphere.w / 2) * 0.96;
    const gr = g.createRadialGradient(-r * 0.25, sphereY - r * 0.35, r * 0.1, 0, sphereY, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(6,4,20,0.42)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, sphereY, r, 0, Math.PI * 2);
    g.fill();
  }

  // chassi
  g.save();
  g.rotate(lean);
  g.translate(0, bob * 0.3);
  drawSpr(g, art.frame, 0, 0, { white: w });
  g.restore();

  // piloto (Karimbo) — atrás da torre, com o rosto aparecendo acima da escotilha
  const [pvx, pvy] = art.pivot;
  const pivX = (pvx - art.sphereCX / ls) * ls;
  const pivY = -(art.H - pvy * ls);
  const recoilBack = p.recoil * 3.4;
  const tilt = p.tilt;
  g.save();
  g.translate(pivX, pivY + bob);
  g.rotate(tilt - lean * 0.6);
  g.translate(recoilBack, 0); // recuo: torre vai para trás (direita na arte espelhada = trás)
  g.translate(-pivX, -pivY);

  if (p.pilot && heads) {
    const hx = art.cockpit[0] * ls - art.sphereCX - 0.5;
    const hy = -(art.H - (art.cockpit[1] + 46) * ls);
    const s = 0.7;
    g.save();
    g.translate(hx, hy);
    g.scale(-s, s); // cabeça olhando p/ a frente do robô (esquerda no espaço da arte)
    drawSpr(g, heads.right, 0, 0, { white: w });
    if (p.earFlap > 0.05) {
      const fl = Math.sin(p.t * 50) * 0.12 * p.earFlap;
      const open = 0.45 + p.earFlap * 0.6;
      const k = 1.7 + p.earFlap * 0.5;
      drawSpr(g, heads.earL, heads.earRootNear[0], heads.earRootNear[1], { rot: -open + fl, sx: k * 0.92, sy: k, white: w });
      drawSpr(g, heads.earR, heads.earRootFar[0], heads.earRootFar[1], { rot: open - fl, sx: k * 0.92, sy: k, white: w });
    }
    g.restore();
  }
  drawSpr(g, art.upper, 0, 0, { white: w });
  g.restore();

  // luzes de estado: brilho da esfera quando o avanço secundário está disponível (sutil)
  if (p.dashing) {
    const spr = glowSprite(p.dashing === 1 ? '#39f0ff' : '#ffb060', 32);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = prevA * 0.55;
    g.drawImage(spr.c, -30, sphereY - 30, 60, 60);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  g.globalAlpha = prevA;
  void PAL;
}

/** Pose "estacionado" (antes de embarcar): esfera parada, luzes piscando. */
export function drawNomadIdle(g: CanvasRenderingContext2D, art: NomadArt, x: number, feetY: number, t: number, facing: 1 | -1, power: number) {
  drawNomad(g, art, null, x, feetY, {
    facing, roll: 0, tilt: 0, aim: 0, recoil: 0, flash: false, t, vx: 0, vy: 0, onGround: true, dashing: 0, alpha: 1,
    hp01: 1, pilot: false, earFlap: 0, ready: false,
  });
  // luzes de "energia" pulsando
  const spr = glowSprite('#ffd23a', 24);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.08 + 0.2 * power * (0.5 + 0.5 * Math.sin(t * 6));
  g.drawImage(spr.c, x - 12 - facing * 4, feetY - 82, 24, 24);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}
