import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../src/core/input';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/** Input com `window`/`document`/alvo falsos (o mesmo molde de inputTap.test.ts) e o minijogo de boxe ligado */
function setup() {
  const win = new Map<string, (e: any) => void>(), root = new Map<string, (e: any) => void>();
  vi.stubGlobal('window', { addEventListener: (name: string, fn: (e: any) => void) => win.set(name, fn) });
  vi.stubGlobal('document', { addEventListener: vi.fn() });
  vi.stubGlobal('Element', class {});
  const input = new Input();
  input.attach({ addEventListener: (name: string, fn: (e: any) => void) => root.set(name, fn), getBoundingClientRect: () => ({ left: 0, width: 800, top: 0, height: 450 }) } as unknown as HTMLElement);
  input.setMiniMode('boxing');
  const down = (button: number, x: number, y: number) => root.get('pointerdown')!({ pointerType: 'mouse', button, clientX: x, clientY: y });
  const move = (x: number, y: number, buttons = 1) => root.get('pointermove')!({ pointerType: 'mouse', clientX: x, clientY: y, buttons });
  const up = (button: number) => win.get('pointerup')!({ pointerType: 'mouse', button });
  const click = (x: number, y = 300) => { down(0, x, y); up(0); };
  return { input, down, move, up, click };
}
/** o aperto que chegou a este quadro */
const pressed = (input: Input) => { input.poll(); const m = input.state.mini!; return Object.entries(m).filter(([, b]) => b.pressed).map(([k]) => k); };

describe('boxe com o mouse (PC): clicar soca, arrastar muda o golpe, botão direito bloqueia', () => {
  it('clique na metade esquerda = jab; na direita = direto', () => {
    const { input, click } = setup();
    click(200);
    expect(pressed(input)).toEqual(['jab']);
    input.clearEdges();
    click(600);
    expect(pressed(input)).toEqual(['direto']);
  });

  it('arrastar para cima = gancho do lado clicado; para o lado = cruzado; para baixo = abaixar; sem golpe extra ao soltar', () => {
    const { input, down, move, up } = setup();
    down(0, 600, 400); move(600, 340); up(0);
    expect(pressed(input)).toEqual(['ganchoD']);
    input.clearEdges();
    down(0, 200, 300); move(250, 300); up(0);
    expect(pressed(input)).toEqual(['cruzE']);
    input.clearEdges();
    down(0, 200, 300); move(200, 360); up(0);
    expect(pressed(input)).toEqual(['abaixar']);
  });

  it('um clique longo e parado (segurar sem mexer) não é soco', () => {
    const { input, down, up } = setup();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    down(0, 200, 300);
    now += 600;
    up(0);
    expect(pressed(input)).toEqual([]);
  });

  it('botão direito SEGURADO = guarda (e solta ao soltar)', () => {
    const { input, down, up } = setup();
    down(2, 300, 300);
    input.poll();
    expect(input.state.mini!.guarda.held).toBe(true);
    up(2);
    input.poll();
    expect(input.state.mini!.guarda.held).toBe(false);
  });

  it('fora do boxe o mouse não gera golpes (o tiro do jogo normal segue como sempre)', () => {
    const { input, click } = setup();
    input.setMiniMode(null);
    click(200);
    input.poll();
    expect(input.state.mini).toBeUndefined();
  });

  it('sair do boxe com o botão direito apertado não deixa a guarda presa na próxima luta', () => {
    const { input, down } = setup();
    down(2, 300, 300);
    input.setMiniMode(null);
    input.setMiniMode('boxing');
    input.poll();
    expect(input.state.mini!.guarda.held).toBe(false);
  });
});

describe('boxe no celular: analógico esquiva (lados) e abaixa (para baixo)', () => {
  const stick = (input: Input, x: number, y: number) => { input.touch.active = true; input.touch.stickX = x; input.touch.stickY = y; };

  it('empurrar para a esquerda/direita = esquiva (uma vez por empurrão)', () => {
    const { input } = setup();
    stick(input, -0.8, 0);
    expect(pressed(input)).toEqual(['esqE']);
    input.clearEdges();
    stick(input, -0.8, 0);
    expect(pressed(input)).toEqual([]); // segurado: sem repetir
    stick(input, 0, 0);
    input.poll();
    input.clearEdges();
    stick(input, 0.8, 0);
    expect(pressed(input)).toEqual(['esqD']);
  });

  it('puxar para baixo = abaixar (segura enquanto estiver puxado)', () => {
    const { input } = setup();
    stick(input, 0, 0.8);
    expect(pressed(input)).toEqual(['abaixar']);
    expect(input.state.mini!.abaixar.held).toBe(true);
    stick(input, 0, 0);
    input.poll();
    expect(input.state.mini!.abaixar.held).toBe(false);
  });

  it('o eixo dominante decide na diagonal e a zona morta ignora o tremor do dedo', () => {
    const { input } = setup();
    stick(input, -0.7, 0.6);
    expect(pressed(input)).toEqual(['esqE']);
    stick(input, 0, 0);
    input.poll();
    input.clearEdges();
    stick(input, -0.3, 0.3);
    expect(pressed(input)).toEqual([]);
  });
});
