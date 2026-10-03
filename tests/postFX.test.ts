import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostFX } from '../src/game/post';
import type { Quality } from '../src/art';
import type { World } from '../src/game/world';

type Surface = { width: number; height: number; scene: string; getContext: () => Context };
type Context = {
  globalAlpha: number; globalCompositeOperation: string; imageSmoothingEnabled: boolean;
  drawImage: (source: Surface, ...args: number[]) => void;
  clearRect: () => void; save: () => void; restore: () => void; setTransform: () => void;
};
let captures: number, displayed: string[];
function surface(width = 800, height = 450, scene = ''): Surface {
  const s = { width, height, scene } as Surface;
  const ctx: Context = {
    globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: false,
    drawImage(source) { if (source === input) captures++; s.scene = source.scene; },
    clearRect() {}, save() {}, restore() {}, setTransform() {},
  };
  s.getContext = () => ctx;
  return s;
}
let input: Surface;
let screen: CanvasRenderingContext2D;
beforeEach(() => {
  captures = 0; displayed = []; input = surface(800, 450, 'cidade');
  vi.stubGlobal('document', { createElement: () => surface() });
  screen = {
    save() {}, restore() {}, setTransform() {},
    drawImage(source: Surface) { displayed.push(source.scene); },
  } as unknown as CanvasRenderingContext2D;
});
afterEach(() => vi.unstubAllGlobals());
const draw = (fx: PostFX, q: Quality = 'medium') => fx.bloom(screen, input as unknown as HTMLCanvasElement, q);

describe('Halo e orçamento de capturas da tela', () => {
  it('chuva percorre a mesma distância por segundo em 30 ou 60 desenhos',()=>{
    const g={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}} as unknown as CanvasRenderingContext2D;
    const w={camera:{x:0,y:0,zoom:1}} as unknown as World;
    const positions=[];
    for(const hz of [30,60]){
      const fx=new PostFX();fx.rain=1;
      const drop={x:10,y:10,z:.4};
      (fx as unknown as {drops:typeof drop[]}).drops=[drop];
      for(let i=0;i<hz;i++)fx.drawRain(g,w,1000,1000,1/hz);
      positions.push({...drop});
    }
    expect(positions[0].x).toBeCloseTo(positions[1].x);
    expect(positions[0].y).toBeCloseTo(314);expect(positions[1].y).toBeCloseTo(314);
  });
  it('compõe o brilho em todos os quadros e reduz capturas nas qualidades menores', () => {
    for (const [q, budget] of [['high', 31], ['medium', 22], ['low', 17]] as const) {
      captures = 0; displayed = []; const fx = new PostFX();
      for (let i = 0; i < 60; i++) draw(fx, q);
      expect(displayed).toHaveLength(60);
      expect(captures).toBeGreaterThan(0);
      expect(captures).toBeLessThanOrEqual(budget);
      expect(displayed.every(scene => scene === 'cidade')).toBe(true);
    }
  });
  it('a primeira composição de outra fase nunca reutiliza o brilho da fase anterior', () => {
    const fx = new PostFX(); draw(fx);
    fx.stage = 2; input.scene = 'selva'; draw(fx);
    expect(displayed.at(-1)).toBe('selva');
    expect(captures).toBe(2);
  });
  it('reiniciar, redimensionar ou mudar qualidade captura imediatamente o cenário atual', () => {
    const fx = new PostFX(); draw(fx);
    input.scene = 'reinicio'; fx.reset(); draw(fx);
    expect(displayed.at(-1)).toBe('reinicio');
    input.scene = 'tela-maior'; input.width = 1200; draw(fx);
    expect(displayed.at(-1)).toBe('tela-maior');
    input.scene = 'alta'; draw(fx, 'high');
    expect(displayed.at(-1)).toBe('alta');
    expect(captures).toBe(4);
  });
});
