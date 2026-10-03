import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/art/wildlife', () => ({ drawHabitat: vi.fn(), drawCrocodile: vi.fn() }));
import { drawHabitat, drawCrocodile } from '../src/art/wildlife';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';
import { buildLevel } from '../src/game/level/index';
import { CROCODILE_DAMAGE } from '../src/game/wildlife';

function scene() {
  const w = new World(buildJungle());
  const c = w.wildlife.crocodile!;
  w.player.invuln = 0;
  return { w, c, p: w.player };
}

describe('Fauna da selva', () => {
  it('fica restrita à selva: um crocodilo dentro de um pântano e seis habitantes únicos em árvores diferentes', () => {
    const { w, c } = scene();
    expect(w.data.water.some(z => z.kind === 'swamp' && c.x > z.x && c.x < z.x + z.w && Math.abs(c.y - z.y) < 12)).toBe(true);
    expect(w.wildlife.habitats).toHaveLength(6);
    expect(new Set(w.wildlife.habitats.map(h => h.kind)).size).toBe(6);
    expect(new Set(w.wildlife.habitats.map(h => h.x)).size).toBe(6);
    for (const h of w.wildlife.habitats) expect(w.data.decos.some(d => d.kind === 'jTree' && d.x === h.x && d.y > h.y)).toBe(true);
    const city = new World(buildLevel());
    expect(city.wildlife.crocodile).toBeNull();
    expect(city.wildlife.habitats).toEqual([]);
  });
  it('abre a boca mesmo a 4000 px acima, sem dano à distância', () => {
    const { w, c, p } = scene();
    p.reset(c.x + 10, c.y - 4000);
    p.invuln = 0;
    const hp = p.hp;
    for (let i = 0; i < 60; i++) c.update(w, 1 / 60);
    expect(c.open).toBe(1);
    expect(p.hp).toBe(hp);
  });
  it('morde por contato, supera a rajada inteira da shotgun e dá tempo para escapar', () => {
    const { w, c, p } = scene();
    p.reset(c.x + 20, c.y + 14);
    p.invuln = 0;
    const hp = p.hp;
    c.update(w, 1 / 60);
    expect(CROCODILE_DAMAGE).toBeGreaterThan(5 * 6);
    expect(p.hp).toBe(hp - CROCODILE_DAMAGE);
    expect(p.hp).toBeGreaterThan(0);
    expect(p.body.vy).toBeLessThan(0);
    p.invuln = 0; // Verify the crocodile cooldown separately from player i-frames.
    for (let i = 0; i < 60; i++) c.update(w, 1 / 60);
    expect(p.hp).toBe(hp - CROCODILE_DAMAGE);
    c.update(w, 2.2);
    expect(p.hp).toBe(hp - CROCODILE_DAMAGE * 2);
  });
  it('a área vazia acima da cauda não causa mordida com a boca aberta', () => {
    const { w, c, p } = scene();
    c.open = 1; c.bite = 0.26; // Keep the current facing during the snap.
    p.reset(c.x - 80, c.y - 60);
    p.invuln = 0;
    const hp = p.hp;
    c.update(w, 1 / 60);
    expect(p.hp).toBe(hp);
  });
  it('respeita invulnerabilidade e reinicia os estados ao recomeçar a partida', () => {
    const { w, c, p } = scene();
    p.reset(c.x, c.y + 14); p.invuln = 1;
    const hp = p.hp;
    c.update(w, 1 / 60);
    expect(p.hp).toBe(hp);
    c.bite = 0.2; c.cooldown = 1; c.open = 1;
    w.startRun();
    expect(c.bite).toBe(0); expect(c.cooldown).toBe(0); expect(c.open).toBe(0);
  });
  it('não desenha nem anima a fauna fora da câmera', () => {
    const { w } = scene();
    vi.mocked(drawHabitat).mockClear(); vi.mocked(drawCrocodile).mockClear();
    const g = {} as CanvasRenderingContext2D;
    w.camera.x = w.camera.y = -10000;
    w.wildlife.drawTrees(g, w); w.wildlife.drawCroc(g, w);
    expect(drawHabitat).not.toHaveBeenCalled(); expect(drawCrocodile).not.toHaveBeenCalled();
    const h = w.wildlife.habitats[0];
    w.camera.x = h.x - 30; w.camera.y = h.y - 30;
    w.wildlife.drawTrees(g, w);
    expect(drawHabitat).toHaveBeenCalledWith(g, h, w.time);
  });
});
