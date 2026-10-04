import { afterEach, describe, expect, it, vi } from 'vitest';
import { Grenade } from '../src/game/bullets';
import { Prop } from '../src/game/props';
import { T } from '../src/game/level';
import { makeWorld } from './helpers/bot';

afterEach(() => vi.restoreAllMocks());
function scene() {
  const w = makeWorld();
  w.level.tiles.fill(0); w.level.relief.fill(0); w.props = []; w.enemies = [];
  vi.spyOn(w, 'audio').mockImplementation(() => {});
  vi.spyOn(w.fx, 'opt').mockReturnValue(false);
  return w;
}
function covers(w: ReturnType<typeof scene>, props: Prop[]) { w.props = props; w.rebuildSolids(); }
const box = (x = 200, solid = true) => new Prop({ id: -1, kind: 'crate', x, y: 250, w: 20, h: 80, solid, loot: 'none' });

describe('granadas e coberturas', () => {
  it.each([1, -1])('ricocheteia na face lateral sem atravessar, sentido %s', dir => {
    const w = scene(); covers(w, [box()]);
    const g = new Grenade(dir > 0 ? 100 : 300, 210, dir * 12000, -15);
    g.update(w, 1 / 60);
    expect(g.vx * dir).toBeLessThan(0);
    expect(dir > 0 ? g.x < 186 : g.x > 214).toBe(true);
    expect(g.bounces).toBe(1); expect(g.dead).toBe(false);
  });
  it.each([1, -1])('ricocheteia na face vertical sem atravessar, sentido %s', dir => {
    const w = scene(); covers(w, [box()]);
    const g = new Grenade(200, dir > 0 ? 100 : 300, 0, dir * 12000 - 15);
    g.update(w, 1 / 60);
    expect(g.vy * dir).toBeLessThan(0);
    expect(dir > 0 ? g.y < 166 : g.y > 254).toBe(true);
    expect(g.bounces).toBe(1);
  });
  it('sai da caixa em vez de ficar presa ricocheteando a cada quadro', () => {
    const w = scene(); covers(w, [box()]);
    const g = new Grenade(183, 210, 600, -15);
    for (let i = 0; i < 6; i++) g.update(w, 1 / 60);
    expect(g.x).toBeLessThan(180); expect(g.vx).toBeLessThan(0); expect(g.bounces).toBe(1);
  });
  it('recupera uma granada que nasceu sobreposta ao objeto', () => {
    const w = scene(); covers(w, [box()]);
    const g = new Grenade(195, 210, 300, -15); g.update(w, 1 / 60);
    expect(g.x).toBeLessThan(186); expect(g.vx).toBeLessThan(0);
  });
  it('usa a cobertura mais próxima mesmo com lista invertida', () => {
    const w = scene(); covers(w, [box(260), box(180)]);
    const g = new Grenade(100, 210, 18000, -15); g.update(w, 1 / 60);
    expect(g.x).toBeLessThan(166); expect(g.bounces).toBe(1);
  });
  it('ignora objetos destruídos ou decorativos', () => {
    const w = scene(), gone = box(180); gone.alive = false; covers(w, [gone, box(220, false)]);
    const g = new Grenade(100, 210, 12000, -15); g.update(w, 1 / 60);
    expect(g.x).toBeCloseTo(300); expect(g.bounces).toBe(0);
  });
  it('não atravessa uma parede de terreno durante um passo rápido', () => {
    const w = scene(); for (let row = 0; row < w.level.h; row++) w.level.set(6, row, T.SOLID);
    const g = new Grenade(100, 210, 18000, -15); g.update(w, 1 / 60);
    expect(g.x).toBeLessThan(188); expect(g.vx).toBeLessThan(0); expect(g.bounces).toBe(1);
  });
  it('detona no primeiro inimigo atravessado e no ponto do contato', () => {
    const w = scene(), near = w.spawnEnemy({ id: -1, type: 'rifle', x: 180, y: 240 });
    w.spawnEnemy({ id: -2, type: 'rifle', x: 280, y: 240 }); w.enemies.reverse();
    const boom = vi.spyOn(w, 'explode').mockImplementation(() => {});
    const g = new Grenade(100, 210, 18000, -15); g.update(w, 1 / 60);
    expect(g.dead).toBe(true); expect(boom).toHaveBeenCalledTimes(1);
    expect(g.x).toBeCloseTo(near.hitbox.x - 4); expect(g.x).toBeLessThan(180);
  });
  it('a caixa impede contato com um inimigo atrás dela', () => {
    const w = scene(); covers(w, [box(180)]); w.spawnEnemy({ id: -1, type: 'rifle', x: 280, y: 240 });
    const boom = vi.spyOn(w, 'explode').mockImplementation(() => {});
    const g = new Grenade(100, 210, 18000, -15); g.update(w, 1 / 60);
    expect(g.dead).toBe(false); expect(boom).not.toHaveBeenCalled(); expect(g.x).toBeLessThan(166);
  });
  it('mantém colisão no passo máximo do jogo após um engasgo', () => {
    const w = scene(); for (let row = 0; row < w.level.h; row++) w.level.set(6, row, T.SOLID);
    const g = new Grenade(150, 210, 650, -90); g.update(w, 0.1);
    expect(g.x).toBeLessThan(188); expect(g.vx).toBeLessThan(0); expect(g.bounces).toBe(1);
  });
  it('não atravessa cobertura estreita com velocidade normal em um quadro de 100 ms', () => {
    const w = scene(); w.solidsDirty = false; w.solidRects = [{ x: 180, y: 160, w: 20, h: 90 }];
    const g = new Grenade(140, 210, 650, -90); g.update(w, 0.1);
    expect(g.x).toBeLessThan(176); expect(g.vx).toBeLessThan(0); expect(g.bounces).toBe(1);
  });
  it('desliza sobre a caixa sem colidir com uma lateral imaginária', () => {
    const w = scene(); covers(w, [box()]);
    const g = new Grenade(200, 165.99, 300, -15); g.update(w, 1 / 60);
    expect(g.x).toBeCloseTo(205); expect(g.vx).toBe(300); expect(g.bounces).toBe(0);
  });
  it('respeita uma cobertura fina registrada sem prop associado', () => {
    const w = scene(); w.solidsDirty = false; w.solidRects = [{ x: 195, y: 160, w: 2, h: 90 }];
    const g = new Grenade(100, 210, 18000, -15); g.update(w, 1 / 60);
    expect(g.x).toBeLessThan(191); expect(g.vx).toBeLessThan(0); expect(g.bounces).toBe(1);
  });
  it('mantém recuperação pela face mais próxima mesmo sem movimento', () => {
    const w = scene(); w.solidsDirty = false; w.solidRects = [{ x: 180, y: 170, w: 40, h: 80 }];
    const g = new Grenade(200, 172, 0, -15); g.update(w, 1 / 60);
    expect(g.y).toBeCloseTo(166); expect(g.x).toBe(200); expect(g.vx).toBe(0);
  });
  it('granadas inimigas não detonam ao tocar seus aliados', () => {
    const w = scene(); w.spawnEnemy({ id: -1, type: 'rifle', x: 180, y: 240 });
    const boom = vi.spyOn(w, 'explode').mockImplementation(() => {});
    const g = new Grenade(100, 210, 18000, -15, 1); g.update(w, 1 / 60);
    expect(boom).not.toHaveBeenCalled(); expect(g.dead).toBe(false);
  });
  it('a explosão é única mesmo com chamada reentrante', () => {
    const w = scene(), g = new Grenade(100, 210, 0, 0); let calls = 0;
    const boom = vi.spyOn(w, 'explode').mockImplementation(() => { if (++calls === 1) g.detonate(w); });
    const blast = vi.spyOn(w.fx, 'grenadeBlast').mockImplementation(() => {});
    g.detonate(w); g.detonate(w); g.update(w, 1 / 60);
    expect(boom).toHaveBeenCalledTimes(1); expect(blast).toHaveBeenCalledTimes(1);
    expect(boom).toHaveBeenCalledWith(100, 210, 118, 75, 0, expect.objectContaining({ kb: 380, big: true }));
  });
  it('granada já removida não se move, explode nem emite partículas', () => {
    const w = scene(), g = new Grenade(100, 210, 400, -100); g.dead = true; g.fuse = 0;
    const boom = vi.spyOn(w, 'explode'), fx = vi.spyOn(w.fx, 'add');
    g.update(w, 1 / 60);
    expect([g.x, g.y, g.vx, g.vy]).toEqual([100, 210, 400, -100]);
    expect(boom).not.toHaveBeenCalled(); expect(fx).not.toHaveBeenCalled();
  });
  it('não desenha granada já detonada', () => {
    const g = new Grenade(100, 210, 0, 0); g.dead = true;
    const save = vi.fn(); g.draw({ save } as unknown as CanvasRenderingContext2D); expect(save).not.toHaveBeenCalled();
  });
  it('mantém dano e raio das granadas do Nômad', () => {
    const w = scene(), g = new Grenade(100, 210, 0, 0, 1, true); g.fuse = 0;
    const boom = vi.spyOn(w, 'explode').mockImplementation(() => {}), blast = vi.spyOn(w.fx, 'grenadeBlast');
    g.update(w, 1 / 60); g.update(w, 1 / 60);
    expect(boom).toHaveBeenCalledTimes(1);
    expect(boom).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 138, 95, 1, expect.objectContaining({ fromNomad: true }));
    expect(blast).not.toHaveBeenCalled();
  });
});
