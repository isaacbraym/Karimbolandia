import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/art', () => ({ getArt: () => ({ pickups: { health: {}, healthBig: {}, secret: {}, emblem: {} } }) }));
vi.mock('../src/art/kit', async importOriginal => ({ ...await importOriginal<typeof import('../src/art/kit')>(), drawSpr: vi.fn(), glowSprite: () => ({ c: {} }) }));
import { Pickup } from '../src/game/pickups';
import { T } from '../src/game/level';
import { makeWorld } from './helpers/bot';
afterEach(() => vi.restoreAllMocks());

function scene() {
  const w = makeWorld();w.level.tiles.fill(0);w.level.relief.fill(0);w.solidRects = [];
  w.player.reset(100, 500);w.player.lockInput = false;w.director.cine = null;
  w.camera.snapTo(w.player.x, w.player.y);
  return { w, x: w.player.x, y: w.player.y - w.player.body.h * .1 };
}
describe('coleta e efeitos de itens', () => {
  it('item expirado ou já coletado não concede moedas mesmo atualizado novamente', () => {
    const { w, x, y } = scene(), expired = new Pickup('token', x, y);
    expired.life = .01;expired.update(w, .02);
    expect(expired.alive).toBe(false);expect(w.tokens).toBe(0);
    const token = new Pickup('token', x, y);token.update(w, .02);token.update(w, .02);
    expect(w.tokens).toBe(1);
  });
  it('o ímã não ultrapassa o jogador num passo longo e coleta ao chegar', () => {
    const { w, x, y } = scene(), token = new Pickup('token', x + 60, y);
    token.update(w, .25);
    expect(token.x).toBeGreaterThanOrEqual(x);expect(token.x).toBeLessThanOrEqual(x + 60);
    expect(token.alive).toBe(false);expect(w.tokens).toBe(1);
  });
  it.each(['token', 'health', 'rifle'] as const)('%s não pode ser coletado através de um objeto sólido de apenas 1px', kind => {
    const { w, x, y } = scene(), item = new Pickup(kind, x + 20, y, 901);
    w.player.hp = 50;w.solidRects = [{ x: x + 10, y: y - 50, w: 1, h: 100 }];
    const collect = vi.spyOn(w, 'collect');item.update(w, 1 / 60);
    expect(item.alive).toBe(true);expect(item.x).toBe(x + 20);expect(collect).not.toHaveBeenCalled();
    expect(w.collectedPickups.has(901)).toBe(false);
    w.solidRects = [];item.update(w, 1 / 60);
    expect(item.alive).toBe(false);expect(collect).toHaveBeenCalledTimes(1);
  });
  it('tiles e relevo bloqueiam atração; plataformas atravessáveis permitem a coleta', () => {
    const { w, x, y } = scene(), token = new Pickup('token', x + 60, y);
    const tx = Math.floor((x + 30) / 32), ty = Math.floor(y / 32);
    w.level.set(tx, ty, T.SOLID);token.update(w, .1);expect(token.x).toBe(x + 60);
    w.level.set(tx, ty, T.ONEWAY);token.update(w, .1);expect(token.x).toBeLessThan(x + 60);
    const hill = new Pickup('token', x + 60, y);
    w.level.set(tx, ty, T.EMPTY);vi.spyOn(w.level, 'reliefSurface').mockReturnValue(y - 1);
    w.level.reliefRow = ty + 1;hill.update(w, .1);expect(hill.x).toBe(x + 60);
  });
  it('respeita atraso de drop, jogador morto e cura desnecessária', () => {
    const { w, x, y } = scene(), token = new Pickup('token', x, y);
    token.collectDelay = .35;token.update(w, .1);expect(token.alive).toBe(true);
    w.player.mode = 'dead';token.update(w, .3);expect(w.tokens).toBe(0);
    w.player.mode = 'foot';token.update(w, .01);expect(w.tokens).toBe(1);
    const health = new Pickup('health', x, y);w.player.hp = w.player.maxHp;
    health.update(w, .01);expect(health.alive).toBe(true);
    w.player.hp -= 10;health.update(w, .01);expect(health.alive).toBe(false);expect(w.player.hp).toBe(w.player.maxHp);
  });
  it.each(['secret', 'health'] as const)('desenhar %s repetidamente na pausa não cria partículas', kind => {
    const { w, x, y } = scene(), item = new Pickup(kind, x + 100, y);
    const add = vi.spyOn(w.fx, 'add');vi.spyOn(Math, 'random').mockReturnValue(0);
    const g = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    for (let i = 0; i < 120; i++) item.draw(g, w);
    expect(add.mock.calls.length).toBe(0);
  });
  it('brilhos dependem do tempo de simulação, respeitam câmera e não geram rajada depois de um salto de tempo', () => {
    const counts: number[] = [];
    for (const hz of [30, 60, 120]) {
      const { w, x, y } = scene(), item = new Pickup('secret', x + 100, y);
      const add = vi.spyOn(w.fx, 'add');
      for (let i = 0; i < hz * 2; i++) item.update(w, 1 / hz);
      counts.push(add.mock.calls.length);
      const before = add.mock.calls.length;item.update(w, 0);expect(add).toHaveBeenCalledTimes(before);
      w.camera.x = -10000;item.update(w, 10);expect(add).toHaveBeenCalledTimes(before);
      w.camera.snapTo(x, y);item.update(w, 10);expect(add.mock.calls.length - before).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(5);
  });
});
