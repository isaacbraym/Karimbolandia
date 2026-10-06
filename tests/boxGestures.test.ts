import { describe, expect, it } from 'vitest';
import { BoxGestures, SWIPE_MIN, TAP_MAX_MS, GUARD_HOLD_MS, classifySwipe } from '../src/ui/boxGestures';

const L = -1, R = 1;

describe('gestos do boxe no celular: metade da tela = uma mão', () => {
  it('toque curto = reto (jab na esquerda, direto na direita), disparado ao soltar', () => {
    const g = new BoxGestures();
    g.down(1, L, 100, 200, 0);
    expect(g.move(1, 103, 202, 30)).toBeNull();
    expect(g.up(1, 80)).toBe('jab');
    g.down(2, R, 500, 200, 100);
    expect(g.up(2, 150)).toBe('direto');
  });

  it('deslizar para o centro ou para fora = cruzado; para cima = gancho; para baixo = abaixar', () => {
    const swipe = (side: -1 | 1, dx: number, dy: number) => {
      const g = new BoxGestures();
      g.down(1, side, 300, 200, 0);
      return g.move(1, 300 + dx, 200 + dy, 60);
    };
    expect(swipe(L, SWIPE_MIN + 6, 0)).toBe('cruzE');
    expect(swipe(R, -(SWIPE_MIN + 6), 0)).toBe('cruzD');
    expect(swipe(L, -(SWIPE_MIN + 6), 0)).toBe('cruzE'); // para fora também (tolerante)
    expect(swipe(L, 4, -(SWIPE_MIN + 8))).toBe('ganchoE');
    expect(swipe(R, -6, -(SWIPE_MIN + 8))).toBe('ganchoD');
    expect(swipe(R, 0, SWIPE_MIN + 8)).toBe('abaixar');
    expect(swipe(L, 0, SWIPE_MIN + 8)).toBe('abaixar');
  });

  it('o gancho aceita diagonal (≥ 35° para cima) e o cruzado aceita um pouco de subida', () => {
    expect(classifySwipe(L, 30, -30)).toBe('ganchoE');
    expect(classifySwipe(R, -30, -30)).toBe('ganchoD');
    expect(classifySwipe(L, 40, -10)).toBe('cruzE');
    expect(classifySwipe(R, -40, 8)).toBe('cruzD');
  });

  it('cada dedo dispara UMA vez: o deslize não vira também um toque ao soltar', () => {
    const g = new BoxGestures();
    g.down(1, L, 300, 200, 0);
    expect(g.move(1, 300, 200 - SWIPE_MIN - 5, 50)).toBe('ganchoE');
    expect(g.move(1, 300, 120, 80)).toBeNull();
    expect(g.up(1, 100)).toBeNull();
  });

  it('toque demorado ou arrastado devagar demais, sem se mexer, não vira soco (é segurar)', () => {
    const g = new BoxGestures();
    g.down(1, L, 100, 100, 0);
    expect(g.up(1, TAP_MAX_MS + 40)).toBeNull();
  });

  it('dois dedos parados, um em cada metade, por 150 ms = guarda; soltar um desfaz; nada dispara soco', () => {
    const g = new BoxGestures();
    g.down(1, L, 100, 200, 0);
    g.down(2, R, 500, 200, 10);
    expect(g.updateGuard(GUARD_HOLD_MS - 20)).toBe(false);
    expect(g.updateGuard(10 + GUARD_HOLD_MS + 5)).toBe(true);
    expect(g.up(1, 400)).toBeNull(); // soltar na guarda não é um toque
    expect(g.updateGuard(410)).toBe(false);
    expect(g.up(2, 420)).toBeNull();
  });

  it('dois dedos na MESMA metade não fazem guarda; dedo que se mexe não conta para a guarda', () => {
    const g = new BoxGestures();
    g.down(1, L, 100, 200, 0);
    g.down(2, L, 140, 200, 0);
    expect(g.updateGuard(400)).toBe(false);
    const h = new BoxGestures();
    h.down(1, L, 100, 200, 0);
    h.down(2, R, 500, 200, 0);
    h.move(2, 500, 200 - SWIPE_MIN + 8, 40); // quase um deslize: já se mexeu
    expect(h.updateGuard(400)).toBe(false);
  });

  it('cancelar (pointercancel) descarta o dedo sem disparar nada e libera a guarda', () => {
    const g = new BoxGestures();
    g.down(1, L, 100, 200, 0);
    g.down(2, R, 500, 200, 0);
    expect(g.updateGuard(300)).toBe(true);
    g.cancel(1);
    expect(g.updateGuard(320)).toBe(false);
    g.cancel(2);
    expect(g.up(2, 400)).toBeNull();
  });

  it('um deslize e um toque quase simultâneos (dois polegares) disparam cada um o seu golpe', () => {
    const g = new BoxGestures();
    g.down(1, L, 100, 300, 0);
    g.down(2, R, 600, 300, 20);
    expect(g.move(1, 100, 300 - SWIPE_MIN - 4, 40)).toBe('ganchoE');
    expect(g.up(2, 70)).toBe('direto');
  });

  it('reset solta tudo (pausa, saída do minijogo, girar a tela)', () => {
    const g = new BoxGestures();
    g.down(1, L, 100, 200, 0);
    g.down(2, R, 500, 200, 0);
    g.reset();
    expect(g.updateGuard(500)).toBe(false);
    expect(g.up(1, 520)).toBeNull();
  });
});
