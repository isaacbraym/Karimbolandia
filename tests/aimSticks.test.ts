import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../src/core/input';
import { settings } from '../src/core/storage';
import { makeWorld } from './helpers/bot';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  vi.stubGlobal('document', { addEventListener: vi.fn() });
  vi.stubGlobal('Element', class {});
  const input = new Input();
  input.attach({ addEventListener: vi.fn() } as unknown as HTMLElement);
  return input;
}
/** Mira resultante para o estado de controle atual, com o Karimbo no ar (onde mirar para baixo é permitido). */
function aimInAir(input: Input) {
  const w = makeWorld(), p = w.player as unknown as { body: { onGround: boolean }; facing: number; computeAim: (...a: unknown[]) => number };
  p.body.onGround = false;
  return p.computeAim(w, input.state, w.player.x, w.player.y);
}

describe('Analógico esquerdo só move; mira é do analógico direito ou mouse', () => {
  it('celular: dedo escorregando para baixo enquanto anda não aponta a arma para o chão', () => {
    const assist = settings.aimAssist; settings.aimAssist = false;
    try {
      const input = setup();
      input.touch.active = true; input.touch.stickX = 0.8; input.touch.stickY = 0.9;
      input.poll();
      expect(input.state.moveX).toBe(1);
      expect(input.state.moveY).toBeCloseTo(0.9); // agachar/descer continuam no joystick
      expect(input.state.aimVecY).toBe(0);
      expect(aimInAir(input)).toBeCloseTo(0);
      input.touch.stickX = -0.8; input.touch.stickY = -0.9; input.poll();
      expect(aimInAir(input)).toBeCloseTo(Math.PI); // vira o corpo, sem mirar para cima
    } finally { settings.aimAssist = assist; }
  });
  it('celular: arrastar o FOGO continua mirando em qualquer direção', () => {
    const input = setup();
    input.touch.active = true; input.touch.stickX = 0.8; input.touch.stickY = 0;
    input.touch.held.fire = true; input.touch.aimX = 0; input.touch.aimY = 1;
    input.poll();
    expect(input.state.padAim).toEqual({ x: 0, y: 1 });
    expect(aimInAir(input)).toBeCloseTo(Math.PI / 2);
  });
  it('controle: analógico esquerdo não mira; o direito mira', () => {
    const assist = settings.aimAssist; settings.aimAssist = false;
    try {
      const axes = [0.8, 0.9, 0, 0];
      const pad = { connected: true, axes, buttons: Array.from({ length: 17 }, () => ({ pressed: false })) };
      vi.stubGlobal('navigator', { getGamepads: () => [pad] });
      const input = setup();
      (input as unknown as { padSeen: boolean }).padSeen = true;
      input.poll();
      expect(input.state.device).toBe('pad');
      expect(input.state.moveY).toBeCloseTo(0.9);
      expect(input.state.aimVecY).toBe(0);
      expect(aimInAir(input)).toBeCloseTo(0);
      axes[2] = 0; axes[3] = -1; input.poll();
      expect(aimInAir(input)).toBeCloseTo(-Math.PI / 2);
    } finally { settings.aimAssist = assist; }
  });
});
