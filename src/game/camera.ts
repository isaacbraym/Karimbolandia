import { clamp, damp, lerp, type Rect } from '../core/math';
import { VIEW_H } from './level';

/** Zoom base do jogo (aproxima levemente a ação). */
export const BASE_ZOOM = 1.14;
/** Zoom na exploração (sem inimigos por perto): mais perto do personagem. */
export const EXPLORE_ZOOM = 1.27;
/** Zoom mínimo ao abrir para mostrar atiradores fora da tela. */
export const MIN_THREAT_ZOOM = 0.74;

/** Câmera com suavização, look-ahead, zoom, travas de arena e shake. */
export class Camera {
  x = 0;
  y = 0;
  zoom = BASE_ZOOM;
  zoomTarget = BASE_ZOOM;
  viewW = 640; // largura lógica visível (com zoom 1)
  viewH = VIEW_H;
  bounds: Rect | null = null; // limites do mundo (px)
  lock: Rect | null = null; // trava de arena (px)
  private lookX = 0;
  /** direção de avanço (pelo movimento, não pela mira): a câmera mostra ~75% à frente */
  private leadDir = 1;
  private vy = 0;
  sx = 0; // offset de shake atual
  sy = 0;
  /** Enquadramento manual (cinemáticas): se definido, ignora seguimento */
  focus: { x: number; y: number; rate: number } | null = null;
  /** centro (mundo) dos atiradores fora da tela: a câmera desloca-se para incluí-los */
  threat: { x: number; y: number } | null = null;
  private shakePhase = 0;

  get w() {
    return this.viewW / this.zoom;
  }
  get h() {
    return this.viewH / this.zoom;
  }

  snapTo(cx: number, cy: number, facing = 1) {
    this.leadDir = facing >= 0 ? 1 : -1;
    this.lookX = this.leadDir * this.w * 0.25;
    this.x = cx + this.lookX - this.w / 2;
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
    // proteção: um valor inválido (NaN) nunca pode "grudar" na câmera
    if (!Number.isFinite(this.lookX)) this.lookX = 0;
    if (!Number.isFinite(this.zoom) || this.zoom <= 0) this.zoom = this.zoomTarget > 0 ? this.zoomTarget : BASE_ZOOM;
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      this.x = tx - this.w / 2;
      this.y = ty - this.h * 0.6;
    }
    if (!Number.isFinite(dt) || !Number.isFinite(tx) || !Number.isFinite(ty)) return;
    // abre rápido (ameaça), fecha devagar (volta suave à exploração)
    this.zoom = damp(this.zoom, this.zoomTarget, this.zoomTarget < this.zoom ? 3.6 : 1.4, dt);
    let cx: number;
    let cy: number;
    let rate = 5.5;
    if (this.focus) {
      cx = this.focus.x;
      cy = this.focus.y;
      rate = this.focus.rate;
    } else {
      // enquadramento 25|75: o personagem fica a ~25% da borda de trás e a visão fica à frente.
      // Segue a direção do MOVIMENTO (atirar para trás não balança a câmera) com transição suave.
      if (Math.abs(vx) > 70) this.leadDir = vx > 0 ? 1 : -1;
      else if (this.lookX === 0) this.leadDir = facing;
      const targetLook = this.leadDir * this.w * 0.25 + clamp(vx, -420, 420) * 0.05;
      const want = this.threat ? clamp(this.threat.x - tx, -this.w * 0.28, this.w * 0.28) : targetLook;
      this.lookX = damp(this.lookX, want, this.threat ? 2.6 : 1.7, dt);
      cx = tx + this.lookX;
      cy = this.threat ? ty + clamp((this.threat.y - ty) * 0.5, -this.h * 0.22, this.h * 0.22) : ty;
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
