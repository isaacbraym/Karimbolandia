import { clamp, damp, lerp, type Rect } from '../core/math';
import { VIEW_H } from './level';

/** Câmera com suavização, look-ahead, zoom, travas de arena e shake. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  zoomTarget = 1;
  viewW = 640; // largura lógica visível (com zoom 1)
  viewH = VIEW_H;
  bounds: Rect | null = null; // limites do mundo (px)
  lock: Rect | null = null; // trava de arena (px)
  private lookX = 0;
  private vy = 0;
  sx = 0; // offset de shake atual
  sy = 0;
  /** Enquadramento manual (cinemáticas): se definido, ignora seguimento */
  focus: { x: number; y: number; rate: number } | null = null;
  private shakePhase = 0;

  get w() {
    return this.viewW / this.zoom;
  }
  get h() {
    return this.viewH / this.zoom;
  }

  snapTo(cx: number, cy: number) {
    this.x = cx - this.w / 2;
    this.y = cy - this.h * 0.58;
    this.clampToBounds();
  }

  private clampToBounds() {
    const b = this.lock ?? this.bounds;
    if (!b) return;
    const maxX = b.x + b.w - this.w;
    const maxY = b.y + b.h - this.h;
    this.x = maxX < b.x ? b.x + (maxX - b.x) / 2 : clamp(this.x, b.x, maxX);
    this.y = maxY < b.y ? b.y + (maxY - b.y) / 2 : clamp(this.y, b.y, maxY);
  }

  update(dt: number, tx: number, ty: number, facing: number, vx: number, onGround: boolean, shakeAmount: number, shakeOn: boolean) {
    this.zoom = damp(this.zoom, this.zoomTarget, 3.2, dt);
    let cx: number;
    let cy: number;
    let rate = 5.5;
    if (this.focus) {
      cx = this.focus.x;
      cy = this.focus.y;
      rate = this.focus.rate;
    } else {
      // look-ahead depende da direção e velocidade
      const targetLook = facing * 46 + clamp(vx, -420, 420) * 0.12;
      this.lookX = damp(this.lookX, targetLook, 2.6, dt);
      cx = tx + this.lookX;
      cy = ty;
    }
    const wantX = cx - this.w / 2;
    // vertical: zona morta + enquadramento ligeiramente abaixo do centro
    let wantY = cy - this.h * 0.6;
    let rateY = rate;
    if (!this.focus) {
      if (onGround) {
        rateY = 3.2; // no chão: recentra devagar
      } else {
        const dead = 34; // no ar: zona morta vertical (câmera não balança nos pulos)
        const cur = this.y;
        if (wantY > cur + dead) wantY -= dead;
        else if (wantY < cur - dead) wantY += dead;
        else wantY = cur;
        rateY = 5;
      }
    }
    this.x = damp(this.x, wantX, rate, dt);
    this.y = damp(this.y, wantY, rateY, dt);
    this.clampToBounds();

    // shake (ruído suave)
    if (shakeOn && shakeAmount > 0.01) {
      this.shakePhase += dt * 60;
      this.sx = (Math.sin(this.shakePhase * 1.7) + Math.sin(this.shakePhase * 2.9 + 1.3)) * 0.5 * shakeAmount;
      this.sy = (Math.cos(this.shakePhase * 2.1) + Math.sin(this.shakePhase * 3.3 + 0.4)) * 0.5 * shakeAmount;
    } else {
      this.sx = this.sy = 0;
    }
  }

  /** Converte coordenadas de mundo em tela lógica. */
  wx(x: number) {
    return (x - this.x + this.sx) * this.zoom;
  }
  wy(y: number) {
    return (y - this.y + this.sy) * this.zoom;
  }
  /** Tela lógica → mundo. */
  toWorldX(sx: number) {
    return sx / this.zoom + this.x - this.sx;
  }
  toWorldY(sy: number) {
    return sy / this.zoom + this.y - this.sy;
  }
  visible(x: number, y: number, m = 40) {
    return x > this.x - m && x < this.x + this.w + m && y > this.y - m && y < this.y + this.h + m;
  }
}
