import { describe, expect, it } from 'vitest';
import { buildJungle, SHIFT } from '../src/game/level/jungle';
import { buildLevel } from '../src/game/level/index';
import { TILE, T, THEME } from '../src/game/level';
import { scenicGround, trailProfile } from '../src/art/forestTrail';
import { World } from '../src/game/world';
import { newCtl } from './helpers/bot';
import { villageHomeDoorX } from '../src/game/exploration';

describe('Amostra artística e telhados caminháveis', () => {
  it('a trilha muda de largura e atravessa montes e bordas de cache sem recortes retos', () => {
    const L = buildJungle().level, widths: number[] = [];
    for (let x = 162 * TILE; x <= 207 * TILE; x += 2) {
      const p = trailProfile(L, x), next = trailProfile(L, x + 2);
      widths.push(p.width);
      expect(Math.abs(next.y - p.y)).toBeLessThan(1.3);
    }
    expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(10);
    for (const x of [11, 12, 13].map(chunk => chunk * 512)) {
      expect(Math.abs(trailProfile(L, x - .01).y - trailProfile(L, x + .01).y)).toBeLessThan(.02);
      expect(Math.abs(trailProfile(L, x - .01).width - trailProfile(L, x + .01).width)).toBeLessThan(.02);
    }
  });
  it('atravessa os dois montes iniciais andando nos dois sentidos sem paredes ou saltos', () => {
    for (const [a, b] of [[162, 178], [196, 207]]) for (const dir of [1, -1]) {
      const w = new World(buildJungle()), start = (dir > 0 ? a : b) * TILE, end = (dir > 0 ? b : a) * TILE;
      w.player.reset(start, (w.level.reliefSurface(start) ?? 32 * TILE) - 8);
      const ctl = newCtl();
      for (let frame = 0; frame < 30; frame++) w.player.update(w, 1 / 60, ctl);
      ctl.moveX = dir;
      let walls = 0;
      for (let frame = 0; frame < 240 && (end - w.player.x) * dir > 0; frame++) {
        w.player.update(w, 1 / 60, ctl);
        if (w.player.body.wallDir !== 0) walls++;
      }
      expect((w.player.x - end) * dir, `caminhada ${a}–${b}, sentido ${dir}`).toBeGreaterThanOrEqual(0);
      expect(walls).toBe(0);
      expect(ctl.jump.held).toBe(false);
    }
  });

  it('estende a trilha seca pela fase 2, excluindo água, poços, plataformas e interiores', () => {
    const data = buildJungle(), L = data.level;
    expect(L.scenicTrail).toEqual({ x0: SHIFT * TILE, x1: L.pxW });
    expect(scenicGround(L, 154, 32)).toBe(true);
    expect(scenicGround(L, 238, 32)).toBe(false); // brejo
    expect(scenicGround(L, 340, 32)).toBe(false); // abismo
    expect(scenicGround(L, 400, 32)).toBe(true); // clareira local do templo reformulado
    expect(scenicGround(L, 450, 32)).toBe(false); // fora da amostra e das clareiras
    expect(scenicGround(L, 800, 32)).toBe(true);
    expect(scenicGround(L, 1200, 32)).toBe(true);
    expect(scenicGround(L, 154, 28)).toBe(false);
    expect(buildLevel().level.scenicTrail).toBeUndefined();
  });

  it('mantém 30 identidades em núcleos próximos e intervalos variados, com a praça livre', () => {
    const data = buildJungle(), homes = data.decos.filter(d => d.kind === 'villageHome');
    expect(homes).toHaveLength(30);
    expect(homes.map(d => d.variant)).toEqual(Array.from({ length: 30 }, (_, i) => i));
    const gaps = homes.slice(1).map((d, i) => (d.x - homes[i].x) / TILE);
    expect(gaps.filter(g => g <= 11).length).toBeGreaterThanOrEqual(23);
    expect(new Set(gaps).size).toBeGreaterThan(4);
    expect(homes.every(d => Math.abs(d.x / TILE - 1004) > 35)).toBe(true);
    const w = new World(data);
    const oldColumns = [702, 719, 739, ...Array.from({ length: 27 }, (_, i) => 766 + i * 17 + (i >= 13 ? 62 : 0))];
    expect(w.exploration.spots.filter(s => s.home).map(s => s.id)).toEqual(homes.map((home, i) =>
      `house:${Math.round(villageHomeDoorX({ ...home, x: oldColumns[i] * TILE + 16 }) / TILE)}`));
  });

  it('todos os telhados/lajes sustentam Karimbo pela colisão real e têm moedas indicadoras', () => {
    const w = new World(buildJungle()); w.enemies = [];
    for (const roof of w.level.roofs) {
      const x = roof.x + roof.w / 2, col = Math.floor(x / TILE), row = roof.y / TILE;
      expect(w.level.get(col, row)).toBe(T.ONEWAY);
      expect(w.level.themeAt(col, row)).toBe(THEME.WOOD);
      w.player.reset(x, roof.y - 8);
      for (let frame = 0; frame < 60; frame++) w.player.update(w, 1 / 60, newCtl());
      expect(w.player.body.onGround, `telhado ${col}`).toBe(true);
      expect(w.player.feetY, `telhado ${col}`).toBeCloseTo(roof.y, 1);
      expect(w.data.pickups.some(p => p.kind === 'token' && p.x >= roof.x && p.x <= roof.x + roof.w && p.y < roof.y && p.y > roof.y - 80)).toBe(true);
    }
  });

  it('os telhados altos podem ser alcançados da rua usando a marquise e o pulo normal', () => {
    const w = new World(buildJungle()); w.enemies = [];
    const jumpTo = (x: number, y: number) => {
      const ctl = newCtl();
      for (let frame = 0; frame < 100; frame++) {
        ctl.moveX = Math.abs(x - w.player.x) > 3 ? Math.sign(x - w.player.x) : 0;
        ctl.jump.pressed = frame === 0; ctl.jump.held = frame < 28;
        w.player.update(w, 1 / 60, ctl);
        if (frame > 4 && w.player.body.onGround) break;
      }
      for (let frame = 0; frame < 4; frame++) w.player.update(w, 1 / 60, newCtl());
      expect(Math.abs(w.player.feetY - y), `pulo para ${x / TILE}`).toBeLessThan(1);
    };
    for (const roof of w.level.roofs.filter(r => !r.awning)) {
      const target = roof.x + roof.w / 2;
      const floor = w.level.reliefSurface(target) ?? 32 * TILE;
      if (floor - roof.y < 115) {
        w.player.reset(target, floor - 8);
        for (let frame = 0; frame < 20; frame++) w.player.update(w, 1 / 60, newCtl());
        jumpTo(target, roof.y);
      } else {
        const awning = w.level.roofs.find(r => r.awning && r.x === roof.x - TILE)!;
        expect(awning).toBeDefined();
        const stepX = awning.x + 16;
        w.player.reset(stepX, (w.level.reliefSurface(stepX) ?? 32 * TILE) - 8);
        for (let frame = 0; frame < 20; frame++) w.player.update(w, 1 / 60, newCtl());
        jumpTo(stepX, awning.y); jumpTo(target, roof.y);
      }
    }
  });
});
