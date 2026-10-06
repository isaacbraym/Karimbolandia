import { describe, expect, it } from 'vitest';
import { buildLevel } from '../src/game/level/index';
import { buildJungle } from '../src/game/level/jungle';
import { cityGround } from '../src/art/cityStreet';
import { drawWindSprite, windAt, windFlex, windTip } from '../src/art/wind';
import { TILE, T, THEME } from '../src/game/level';
import { RUN } from '../src/game/movement';
import { World } from '../src/game/world';
import { newCtl } from './helpers/bot';
import { CITY_BLOCKS, CITY_GARDENS } from '../src/game/level/cityScenery';

describe('Rua integrada e vento ambiental', () => {
  it('abre intervalos variados entre prédios e apoia bancos e jardins na calçada', () => {
    const d = buildLevel(), gaps: number[] = [];
    for (let i = 1; i < CITY_BLOCKS.length; i++) {
      const prev = CITY_BLOCKS[i - 1], block = CITY_BLOCKS[i];
      gaps.push(block.x - prev.x - prev.w);
    }
    expect(Math.min(...gaps)).toBeGreaterThan(250);
    expect(new Set(gaps).size).toBeGreaterThan(4);
    expect(d.decos.some(a => a.kind === 'facade' && a.x < d.level.scenicStreet!.x1)).toBe(false);
    for (const x of CITY_GARDENS) {
      for (const a of d.decos.filter(a => (a.x === x || a.x === x + 115) && (a.kind === 'streetTree' || a.kind === 'bench'))) {
        expect(cityGround(d.level, Math.floor(a.x / TILE), 32)).toBe(true);
        expect(a.y).toBeLessThan(32 * TILE);
      }
    }
    expect(d.decos.filter(a => a.kind === 'bench' && a.x < 6000).length).toBeGreaterThan(3);
  });
  it('cobre 30 segundos da cidade e preserva buracos, plataformas e a balada subterrânea', () => {
    const data = buildLevel(), L = data.level;
    expect(L.scenicStreet).toEqual({ x0: 0, x1: data.playerStart.x + RUN * 30 });
    expect(buildJungle().level.scenicStreet).toBeUndefined();
    expect(cityGround(L, 4, 32)).toBe(true);
    expect(cityGround(L, 52, 32)).toBe(false);
    expect(L.get(52, 32)).toBe(T.EMPTY);
    expect(cityGround(L, 58, 30)).toBe(false);
    expect(L.get(58, 30)).toBe(T.ONEWAY);
    for (let x = 0; x < L.w; x++) for (let y = 33; y < L.h; y++) {
      if (L.themeAt(x, y) === THEME.HANGAR) expect(cityGround(L, x, y)).toBe(false);
    }
    expect(cityGround(L, Math.ceil(L.scenicStreet!.x1 / TILE), 32)).toBe(false);
  });
  it('mantém a caminhada no asfalto e a queda real no primeiro buraco', () => {
    const w = new World(buildLevel()), ctl = newCtl();
    w.player.reset(4 * TILE, 32 * TILE - 8);
    for (let i = 0; i < 30; i++) w.player.update(w, 1 / 60, ctl);
    ctl.moveX = 1;
    for (let i = 0; i < 80; i++) w.player.update(w, 1 / 60, ctl);
    expect(w.player.x).toBeGreaterThan(10 * TILE);
    expect(w.player.body.wallDir).toBe(0);
    w.player.reset(53 * TILE, 32 * TILE - 8); ctl.moveX = 0;
    for (let i = 0; i < 30; i++) w.player.update(w, 1 / 60, ctl);
    expect(w.player.feetY).toBeGreaterThan(32 * TILE + 64);
  });
  it('vegetação compartilha rajadas e construções rígidas não flexionam', () => {
    for (const kind of ['jTree', 'jPalm', 'jFern', 'jFlowers', 'streetTree']) {
      expect(windFlex(kind)).toBeGreaterThan(0);
      expect(windTip(kind, 5000, 1)).not.toBe(windTip(kind, 5000, 3));
      expect(windTip(kind, 5000, 1)).toBe(windTip(kind, 5000, 1));
    }
    for (const kind of ['facade', 'powerPole', 'jRock', 'jRoots', 'clubFront']) expect(windFlex(kind)).toBe(0);
    expect(Math.abs(windAt(5001, 3) - windAt(5000, 3))).toBeLessThan(.002);
  });
  it('deforma imagem pronta sem frestas entre faixas e mantém a base imóvel', () => {
    const transforms: number[][] = [];
    const g = { save() {}, restore() {}, drawImage() {}, transform(...args: number[]) { transforms.push(args); } } as unknown as CanvasRenderingContext2D;
    const img = { width: 232, height: 485 } as HTMLCanvasElement;
    drawWindSprite(g, img, -114, -475, 232, 485, -100, 6);
    const offset = (tr: number[], y: number) => tr[2] * y + tr[4];
    for (let i = 1; i < transforms.length; i++) {
      const y = -475 + 485 * i / 6;
      expect(offset(transforms[i - 1], y)).toBeCloseTo(offset(transforms[i], y), 8);
    }
    expect(offset(transforms.at(-1)!, 0)).toBe(0);
  });
});
