/**
 * Pós-processamento e clima (upgrade gráfico):
 *  • bloom: brilho real dos neons/explosões (redução em cascata + curva de contraste)
 *  • chuva com profundidade (parallax), respingos no chão e relâmpagos com trovão
 *  • gradação de cor cinematográfica (magenta em cima, ciano embaixo) e granulação de filme
 *  • "tranco" de câmera ao levar dano (imagem fantasma deslocada)
 * Tudo em Canvas 2D puro, escalonado pela qualidade (LOW desliga o que é caro).
 */
import type { World } from './world';
import type { Quality } from '../art';
import { clamp } from '../core/math';
import { audio } from '../core/audio';

interface Drop {
  x: number;
  y: number;
  z: number; // profundidade 0.35..1
}
interface Splash {
  x: number;
  y: number;
  t: number;
}

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export class PostFX {
  private b1: HTMLCanvasElement | null = null;
  private b2: HTMLCanvasElement | null = null;
  private grain: HTMLCanvasElement | null = null;
  private drops: Drop[] = [];
  private splashes: Splash[] = [];
  private lastCamX = 0;
  private lastCamY = 0;
  /** 0..1: intensidade atual da chuva (some em ambientes cobertos) */
  rain = 0;
  private lightningT = 8;
  private flash = 0;
  private flashSeq: number[] = [];
  private time = 0;

  reset() {
    this.drops = [];
    this.splashes = [];
    this.flash = 0;
    this.flashSeq = [];
  }

  // ------------------------------------------------------------------ clima
  update(w: World, dt: number, q: Quality) {
    this.time += dt;
    const p = w.player;
    // ao ar livre? (nada sólido acima do jogador por ~11 tiles)
    const L = w.level;
    let covered = false;
    for (let k = 3; k < 14 && !covered; k++) if (L.solidAtPx(p.x, p.y - k * 32)) covered = true;
    const target = covered ? 0 : 1;
    this.rain += (target - this.rain) * Math.min(1, dt * 1.2);

    const n = q === 'high' ? 170 : q === 'medium' ? 110 : 60;
    while (this.drops.length < n) this.drops.push({ x: Math.random() * 900, y: Math.random() * 400, z: 0.35 + Math.random() * 0.65 });
    if (this.drops.length > n) this.drops.length = n;

    // relâmpagos (só quando chove)
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.lightningT = 11 + Math.random() * 16;
      if (this.rain > 0.5 && w.player.mode !== 'dead') {
        this.flashSeq = [0, 0.12, 0.26];
        const dist = 0.5 + Math.random() * 1.2;
        w.after(dist, () => audio.play('thunder', clamp(1.3 - dist * 0.4, 0.4, 1)));
      }
    }
    if (this.flashSeq.length) {
      this.flashSeq = this.flashSeq.map((t) => t - dt);
      while (this.flashSeq.length && this.flashSeq[0] <= 0) {
        this.flashSeq.shift();
        this.flash = 0.75 + Math.random() * 0.25;
      }
    }
    this.flash = Math.max(0, this.flash - dt * 4.5);

    // respingos no chão (mundo)
    if (this.rain > 0.05) {
      const cam = w.camera;
      const rate = (q === 'low' ? 18 : 42) * this.rain;
      let k = rate * dt;
      while (k > 0) {
        if (Math.random() < k) {
          const x = cam.x + Math.random() * cam.w;
          const gy = L.groundBelow(x, cam.y + 10, cam.h + 40);
          if (gy !== null && gy < cam.y + cam.h) this.splashes.push({ x, y: gy, t: 0 });
        }
        k -= 1;
      }
    }
    for (const s of this.splashes) s.t += dt;
    this.splashes = this.splashes.filter((s) => s.t < 0.3);
  }

  /** Relâmpago iluminando o céu (chamar DEPOIS do fundo e ANTES do mundo). */
  drawSkyFlash(g: CanvasRenderingContext2D, W: number, H: number) {
    if (this.flash <= 0.01) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgba(200,210,255,${0.55 * this.flash})`);
    gr.addColorStop(1, `rgba(140,120,255,${0.12 * this.flash})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  /** Chuva + respingos (espaço de tela lógico). */
  drawRain(g: CanvasRenderingContext2D, w: World, W: number, H: number) {
    const cam = w.camera;
    const dxCam = (cam.x - this.lastCamX) * cam.zoom;
    const dyCam = (cam.y - this.lastCamY) * cam.zoom;
    this.lastCamX = cam.x;
    this.lastCamY = cam.y;
    if (Math.abs(dxCam) > 200 || Math.abs(dyCam) > 200) return; // teleporte/respawn
    const a = this.rain;
    if (a < 0.02) return;
    const dt = 1 / 60;
    const wind = 0.22;
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = '#bcd4ff';
    // atualiza posições
    for (const d of this.drops) {
      const sp = 760 * d.z;
      d.x += wind * sp * dt - dxCam * d.z;
      d.y += sp * dt - dyCam * d.z;
      if (d.y > H + 20) {
        d.y = -20 - Math.random() * 40;
        d.x = Math.random() * (W + 80) - 40;
      } else if (d.y < -80) d.y = H + 10;
      if (d.x > W + 40) d.x -= W + 80;
      else if (d.x < -40) d.x += W + 80;
    }
    // desenha em 3 camadas (um traço por camada)
    for (let layer = 0; layer < 3; layer++) {
      const zMin = 0.35 + layer * 0.217;
      const zMax = zMin + 0.217 + (layer === 2 ? 0.01 : 0);
      const zc = (zMin + zMax) / 2;
      const len = 9 + 15 * zc;
      g.globalAlpha = a * (0.1 + 0.3 * zc);
      g.lineWidth = 0.6 + zc * 0.9;
      g.beginPath();
      for (const d of this.drops) {
        if (d.z < zMin || d.z >= zMax) continue;
        g.moveTo(d.x, d.y);
        g.lineTo(d.x - wind * len, d.y - len);
      }
      g.stroke();
    }
    // respingos (um caminho por faixa de idade)
    g.strokeStyle = '#dfe9ff';
    g.lineWidth = 1;
    for (let band = 0; band < 3; band++) {
      g.globalAlpha = a * (1 - (band + 0.5) / 3) * 0.7;
      g.beginPath();
      for (const s of this.splashes) {
        const k = s.t / 0.3;
        if (Math.min(2, Math.floor(k * 3)) !== band) continue;
        const sx = cam.wx(s.x);
        const sy = cam.wy(s.y);
        const rx = (2 + k * 7) * cam.zoom;
        g.moveTo(sx + rx, sy - 1);
        g.ellipse(sx, sy - 1, rx, (0.8 + k * 1.6) * cam.zoom, 0, 0, Math.PI * 2);
        g.moveTo(sx - 2, sy - 2 - k * 7);
        g.lineTo(sx - 3, sy - 4 - k * 9);
        g.moveTo(sx + 2, sy - 2 - k * 6);
        g.lineTo(sx + 3, sy - 4 - k * 8);
      }
      g.stroke();
    }
    g.restore();
  }

  // ------------------------------------------------------------------ pós
  private bloomFrame = 0;
  /**
   * Bloom: reduz o quadro em cascata, eleva ao cubo (só o que brilha sobra), soma as duas escalas
   * no buffer pequeno e devolve com UMA passada de tela cheia. Em aparelhos modestos o buffer é
   * recalculado a cada 2 quadros (a soma continua a cada quadro — visual idêntico).
   */
  bloom(g: CanvasRenderingContext2D, canvas: HTMLCanvasElement, q: Quality) {
    const W = canvas.width;
    const H = canvas.height;
    const w1 = Math.max(2, Math.round(W / 4));
    const h1 = Math.max(2, Math.round(H / 4));
    const w2 = Math.max(2, Math.round(W / 10));
    const h2 = Math.max(2, Math.round(H / 10));
    let fresh = false;
    if (!this.b1 || this.b1.width !== w1 || this.b1.height !== h1) {
      this.b1 = mk(w1, h1);
      fresh = true;
    }
    if (!this.b2 || this.b2.width !== w2 || this.b2.height !== h2) {
      this.b2 = mk(w2, h2);
      fresh = true;
    }
    this.bloomFrame++;
    if (fresh || q === 'high' || this.bloomFrame % 2 === 0) {
      const c1 = this.b1.getContext('2d')!;
      const c2 = this.b2.getContext('2d')!;
      c1.globalCompositeOperation = 'source-over';
      c1.globalAlpha = 1;
      c1.imageSmoothingEnabled = true;
      c1.drawImage(canvas, 0, 0, w1, h1);
      c1.globalCompositeOperation = 'multiply';
      c1.drawImage(this.b1, 0, 0);
      c1.drawImage(this.b1, 0, 0); // x³
      c2.imageSmoothingEnabled = true;
      c2.globalCompositeOperation = 'source-over';
      c2.clearRect(0, 0, w2, h2);
      c2.drawImage(this.b1, 0, 0, w2, h2);
      // halo largo somado ao estreito no buffer pequeno (economiza uma passada de tela cheia)
      c1.globalAlpha = 1;
      c1.globalCompositeOperation = 'lighter';
      c1.drawImage(this.b2, 0, 0, w1, h1);
      c1.drawImage(this.b2, 0, 0, w1, h1);
      c1.drawImage(this.b2, 0, 0, w1, h1);
      c1.globalAlpha = 1;
      c1.globalCompositeOperation = 'source-over';
    }
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = q === 'high' ? 0.17 : 0.15;
    g.drawImage(this.b1, 0, 0, W, H);
    g.restore();
  }

  private gradeCache: { H: number; gr: CanvasGradient | null } = { H: -1, gr: null };
  private grainPat: CanvasPattern | null = null;
  /** Gradação de cor + granulação (espaço de tela lógico). */
  grade(g: CanvasRenderingContext2D, W: number, H: number, q: Quality) {
    void q;
    if (this.gradeCache.H !== H || !this.gradeCache.gr) {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(255,60,190,0.32)');
      gr.addColorStop(0.55, 'rgba(120,80,255,0.08)');
      gr.addColorStop(1, 'rgba(40,230,255,0.28)');
      this.gradeCache = { H, gr };
    }
    g.save();
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = this.gradeCache.gr!;
    g.fillRect(0, 0, W, H);
    g.restore();
    if (!this.grain) {
      this.grain = mk(128, 128);
      const gg = this.grain.getContext('2d')!;
      const img = gg.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      gg.putImageData(img, 0, 0);
      this.grainPat = null;
    }
    if (!this.grainPat) this.grainPat = g.createPattern(this.grain, 'repeat');
    if (!this.grainPat) return;
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.06;
    g.translate(-Math.floor(Math.random() * 128), -Math.floor(Math.random() * 128));
    g.fillStyle = this.grainPat;
    g.fillRect(0, 0, W + 128, H + 128);
    g.restore();
  }

  /** Dano: imagem fantasma deslocada (aberração) por um instante. */
  hurt(g: CanvasRenderingContext2D, canvas: HTMLCanvasElement, amount: number) {
    if (amount <= 0.02) return;
    const W = canvas.width;
    const off = Math.round(W * 0.006 * amount) + 1;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.35 * amount;
    g.drawImage(canvas, off, 0);
    g.drawImage(canvas, -off, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.18 * amount;
    g.fillStyle = '#ff1e4a';
    g.fillRect(0, 0, W, canvas.height);
    g.restore();
  }
}
