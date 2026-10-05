/**
 * Efeito de fita VHS do rebobinar: pauta de linhas de varredura, faixa de chuvisco que desliza e
 * vinheta, tudo assado uma vez por tamanho; por quadro só se copiam imagens (nada é criado).
 */
import { makeCanvas } from '../../kit';
import { txt } from '../boxing/fx';

export class RewindFx {
  private scan: HTMLCanvasElement;
  private noise: HTMLCanvasElement;
  private vignette: HTMLCanvasElement;
  private bandH: number;

  constructor(private W: number, private H: number) {
    this.scan = makeCanvas(W, H);
    const g = this.scan.getContext('2d')!;
    g.fillStyle = 'rgba(0,0,0,.2)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    this.bandH = Math.max(14, Math.round(H * 0.07));
    this.noise = makeCanvas(W, this.bandH);
    const n = this.noise.getContext('2d')!;
    let a = 12345;
    const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    for (let i = 0; i < W * this.bandH * 0.08; i++) { n.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.5})`; n.fillRect(r() * W, r() * this.bandH, 1 + r() * 18, 1); }
    n.fillStyle = 'rgba(255,255,255,.08)'; n.fillRect(0, 0, W, this.bandH);
    this.vignette = makeCanvas(W, H);
    const v = this.vignette.getContext('2d')!;
    const gr = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    gr.addColorStop(0, 'rgba(0,0,40,0)'); gr.addColorStop(1, 'rgba(0,0,40,.55)');
    v.fillStyle = gr; v.fillRect(0, 0, W, H);
  }

  /** `t` em s; `clock` = cronômetro (s) mostrado voltando a zero. */
  draw(g: CanvasRenderingContext2D, t: number, clock: number) {
    const { W, H } = this, u = H / 360;
    g.drawImage(this.vignette, 0, 0);
    g.drawImage(this.scan, 0, 0);
    const y = ((t * 0.9) % 1) * (H + this.bandH) - this.bandH;
    g.globalAlpha = 0.55;
    g.drawImage(this.noise, 0, y);
    g.drawImage(this.noise, 0, ((t * 0.37 + 0.5) % 1) * (H + this.bandH) - this.bandH);
    g.globalAlpha = 1;
    // "◀◀ REBOBINANDO" pisca; o cronômetro corre para trás (dígito a dígito: poucos textos em cache)
    if (Math.floor(t * 3) % 2 === 0) txt(g, '◀◀ REBOBINANDO', 16 * u + 70 * u, 24 * u, 13 * u, '#ffffff', 'center');
    const sec = Math.max(0, Math.floor(clock)), label = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const adv = 8 * u, x0 = W - 34 * u - (label.length * adv) / 2 + adv / 2;
    for (let i = 0; i < label.length; i++) txt(g, label[i], x0 + i * adv, 24 * u, 13 * u, '#ffe27a', 'center');
    g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(W - 70 * u, 18 * u, 3.2 * u, 0, Math.PI * 2); g.fill();
  }
}
