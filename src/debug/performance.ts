/** Diagnóstico opt-in (?perf=1): coleta sem alocar por quadro; UI atualizada uma vez/segundo. */
export class FrameMetrics {
  private frames = new Float64Array(1800);
  private updates = new Float64Array(1800);
  private renders = new Float64Array(1800);
  private count = 0;
  private index = 0;
  private lastDisplay = 0;
  private el: HTMLElement;
  constructor(root: HTMLElement) {
    this.el = document.createElement('output');
    this.el.id = 'performance-report';
    this.el.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:70;background:#080818e8;color:#baf6d5;font:12px monospace;padding:8px;white-space:pre;pointer-events:none;border-radius:6px';
    this.el.textContent = 'PERF • aguardando partida';
    root.append(this.el);
  }
  inactive() { this.el.textContent = 'PERF • janela sem foco; medição suspensa'; }
  sample(ms: number, update: number, render: number, now: number, scene: string) {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.frames[this.index] = ms;
    this.updates[this.index] = update;
    this.renders[this.index] = render;
    this.index = (this.index + 1) % this.frames.length;
    this.count = Math.min(this.count + 1, this.frames.length);
    if (now - this.lastDisplay < 1000) return;
    this.lastDisplay = now;
    const sorted = Array.from(this.frames.subarray(0, this.count)).sort((a, b) => a - b);
    let total = 0, up = 0, draw = 0, slow = 0;
    for (let i = 0; i < this.count; i++) { total += this.frames[i]; up += this.updates[i]; draw += this.renders[i]; if (this.frames[i] > 33.34) ++slow; }
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
    this.el.textContent = `${scene} • ${this.count} quadros\nFPS ${(1000 * this.count / total).toFixed(1)} • p95 ${p95.toFixed(1)} ms • p99 ${p99.toFixed(1)} ms\nupdate ${(up / this.count).toFixed(2)} ms • render ${(draw / this.count).toFixed(2)} ms\nquadros >33 ms: ${slow} (${(slow * 100 / this.count).toFixed(1)}%)`;
  }
}
