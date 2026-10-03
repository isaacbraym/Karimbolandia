import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bullet, segHitsRect } from '../src/game/bullets';
import { segmentRectEntry } from '../src/core/segment';
import { pickupPathClear } from '../src/game/pickupReach';
import { Prop } from '../src/game/props';
import { makeWorld } from './helpers/bot';

afterEach(() => vi.restoreAllMocks());

describe('segmento e retângulo', () => {
  it('retorna o primeiro contato em ambos os sentidos, incluindo raio e ponto inicial interno', () => {
    expect(segmentRectEntry(0, 5, 20, 5, 8, 0, 4, 10)).toBe(.4);
    expect(segmentRectEntry(20, 5, 0, 5, 8, 0, 4, 10)).toBe(.4);
    expect(segmentRectEntry(0, 5, 20, 5, 8, 0, 4, 10, 2)).toBe(.3);
    expect(segmentRectEntry(10, 5, 20, 5, 8, 0, 4, 10)).toBe(0);
  });
  it('inclui contato no canto, aresta e final sem aceitar um quase acerto', () => {
    expect(segmentRectEntry(0, 0, 10, 10, 10, 0, 10, 10)).toBe(1);
    expect(segmentRectEntry(0, 10, 30, 10, 10, 0, 10, 10)).toBeCloseTo(1 / 3);
    expect(segmentRectEntry(0, 10.001, 30, 10.001, 10, 0, 10, 10)).toBeNull();
    expect(segmentRectEntry(0, 0, 5, 5, 10, 0, 10, 10)).toBeNull();
  });
  it('resolve segmentos verticais, imóveis e retângulos de espessura zero', () => {
    expect(segmentRectEntry(5, 0, 5, 20, 0, 8, 10, 4)).toBe(.4);
    expect(segmentRectEntry(15, 0, 15, 20, 0, 8, 10, 4)).toBeNull();
    expect(segmentRectEntry(5, 5, 5, 5, 0, 0, 10, 10)).toBe(0);
    expect(segmentRectEntry(15, 5, 15, 5, 0, 0, 10, 10)).toBeNull();
    expect(segmentRectEntry(0, 0, 20, 0, 10, 0, 0, 0)).toBe(.5);
  });
  it('detecta obstáculo subpixel mesmo em um caminho de um milhão de pixels', () => {
    expect(segmentRectEntry(0, 3, 1e6, 3, 500001.25, 2, .01, 2)).toBeCloseTo(.50000125, 10);
  });
  it('coleta conserva linha de visão para parede fina, canto, ponto parado e terreno', () => {
    const w = scene(), rect = { x: 151, y: 251, w: 1, h: 1 };
    expect(pickupPathClear(w.level, [rect], 100, 200, 300, 400)).toBe(false);
    expect(pickupPathClear(w.level, [rect], 100, 203, 300, 403)).toBe(true);
    expect(pickupPathClear(w.level, [rect], 151, 251, 151, 251)).toBe(false);
    expect(pickupPathClear(w.level, [rect], 100, 200, 100, 200)).toBe(true);
    vi.spyOn(w.level, 'rayHit').mockReturnValue(.5);
    expect(pickupPathClear(w.level, [], 100, 200, 300, 400)).toBe(false);
  });
});

function scene() {
  const w = makeWorld();
  w.invulnerable = false;w.level.tiles.fill(0);w.level.relief.fill(0);
  w.props = [];w.enemies = [];w.player.reset(500, 500);w.player.invuln = 0;
  return w;
}

describe('contato contínuo de projéteis', () => {
  it('detecta um alvo de 1px entre os pontos da antiga amostragem', () => {
    expect(segHitsRect(100, 200, 300, 400, .2, 151, 251, 1, 1)).toBe(true);
    expect(segHitsRect(300, 400, 100, 200, .2, 151, 251, 1, 1)).toBe(true);
  });
  it('um tiro rápido danifica o objeto fino em vez de atravessá-lo', () => {
    const w = scene(), prop = new Prop({ id: -1, kind: 'pipe', x: 151.5, y: 252, w: 1, h: 1 });
    w.props = [prop];const hp = prop.hp;
    const b = new Bullet(100, 200, 12000, 12000, { team: 0, dmg: 9, r: .2 });
    b.update(w, 1 / 60);
    expect(prop.hp).toBe(hp - 9);expect(b.dead).toBe(true);
  });
  it('detecta um tiro que raspa o canto de um inimigo entre amostras', () => {
    const w = scene(), e = w.spawnEnemy({ id: -1, type: 'rifle', x: 200, y: 300 });
    const hb = e.hitbox, hp = e.hp;
    const b = new Bullet(hb.x - 30, hb.y + 31, 3660, -3660, { team: 0, dmg: 9, r: .2 });
    b.update(w, 1 / 60);
    expect(e.hp).toBeLessThan(hp);expect(b.dead).toBe(true);
  });
  it('o tiro hostil também detecta o canto do jogador e aplica dano uma única vez', () => {
    const w = scene(), hb = w.player.hitbox, hp = w.player.hp;
    const b = new Bullet(hb.x - 30, hb.y + 31, 3660, -3660, { team: 1, dmg: 9, r: .2 });
    b.update(w, 1 / 60);b.update(w, 1 / 60);
    expect(w.player.hp).toBe(hp - 9);expect(b.dead).toBe(true);
    expect(b.x).toBeCloseTo(hb.x - .2);expect(b.y).toBeCloseTo(hb.y + 1.2);
  });
  it.each(['invuln', 'dash'] as const)('preserva a proteção de %s no contato exato', protection => {
    const w = scene(), hb = w.player.hitbox, hp = w.player.hp;
    if (protection === 'invuln') w.player.invuln = 1;
    else vi.spyOn(w.player, 'isDashing', 'get').mockReturnValue(true);
    const b = new Bullet(hb.x - 30, hb.y + 31, 3660, -3660, { team: 1, dmg: 9, r: .2 });
    b.update(w, 1 / 60);
    expect(w.player.hp).toBe(hp);expect(b.dead).toBe(protection === 'dash');
  });
  it('explosivo hostil explode no primeiro contato com o jogador, uma única vez', () => {
    const w = scene(), hb = w.player.hitbox, explode = vi.spyOn(w, 'explode');
    const b = new Bullet(hb.x - 30, hb.y + 31, 3660, -3660, { team: 1, dmg: 9, r: .2, explode: { radius: 48, dmg: 18 } });
    b.update(w, 1 / 60);b.update(w, 1 / 60);
    expect(explode).toHaveBeenCalledTimes(1);
    expect(explode).toHaveBeenCalledWith(expect.closeTo(hb.x - .2), expect.closeTo(hb.y + 1.2), 48, 18, 1, expect.any(Object));
  });
});
