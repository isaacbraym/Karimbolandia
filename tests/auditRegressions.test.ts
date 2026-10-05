import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeWorld, newCtl } from './helpers/bot';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';
import { Level, T } from '../src/game/level';
import { Felipao } from '../src/game/enemies/felipao';
import { Bullet } from '../src/game/bullets';
import { Prop } from '../src/game/props';
import { Pickup } from '../src/game/pickups';
import { applySave, captureSave } from '../src/game/save';
import { validateSave } from '../src/core/saveValidation';
import { Input } from '../src/core/input';
import * as decor from '../src/art/decor';
import { abyss, waterDepthRange } from '../src/art/waterDraw';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Regressões da auditoria karim-npa', () => {
  it.each(['continuar', 'checkpoint'] as const)('a vitória sobre Felipão sobrevive à morte e a %s', action => {
    const w = makeWorld(), complete = vi.fn();
    w.hooks.onComplete = complete;
    const boss = new Felipao(w.data.enemies.find(e => e.type === 'boss')!);
    w.enemies = [boss]; boss.kill(w);
    expect(w.director.cine?.kind).toBe('bossDeath');
    w.player.die(w);
    if (action === 'checkpoint') w.respawn(); else { w.player.revive(w); w.director.onRevive(); }
    for (let i = 0; i < 600; i++) w.director.update(1 / 60, newCtl());
    expect(w.finished).toBe(true); expect(complete).toHaveBeenCalledOnce();
    expect(w.player.lockInput).toBe(false);
  });

  it('restaurar save com chefe derrotado também termina a fase sem recriar o chefe', () => {
    const w = makeWorld(), boss = w.data.enemies.find(e => e.type === 'boss')!;
    w.killedEnemies.add(boss.id);
    const restored = makeWorld(), complete = vi.fn(); restored.hooks.onComplete = complete;
    applySave(restored, captureSave(w));
    for (let i = 0; i < 600; i++) restored.director.update(1 / 60, newCtl());
    expect(complete).toHaveBeenCalledOnce();
    expect(restored.enemies.some(e => e.isBoss)).toBe(false);
  });

  it('Nômad restaurado no checkpoint desembarca novamente na passagem estreita', () => {
    const w = makeWorld(), cp = w.data.checkpoints.findIndex(c => c.name === 'Depois da guerra');
    expect(cp).toBeGreaterThanOrEqual(0);
    w.checkpointIdx = cp; w.director.remountAtCheckpoint(200); w.checkpointSnap = w.player.snapshot();
    (w.director as unknown as { triggered: Set<string> }).triggered.add('dismount');
    w.respawn(); expect(w.player.mode).toBe('nomad');
    const r = w.data.triggers.find(t => t.id === 'dismount')!.rect;
    w.player.body.x = r.x + r.w / 2; w.player.body.y = r.y + r.h / 2;
    w.director.update(1 / 60, newCtl());
    expect(w.player.mode).toBe('foot');
    expect(w.player.nomad).toBeNull();
  });

  it.each([1, 2])('save parcial mantém todas as notas alcançáveis e premia uma vez na fase %i', stage => {
    const create = () => stage === 1 ? makeWorld() : new World(buildJungle());
    const w = create(), notes = w.pickups.filter(p => p.kind === 'note');
    w.collect(notes[0]);
    const save = validateSave(captureSave(w))!, loaded = create();
    applySave(loaded, save);
    expect(loaded.rhythm.got).toBe(1);
    expect(loaded.pickups.some(p => p.kind === 'note' && p.id === notes[0].id && p.itemId === 1)).toBe(true);
    for (const pk of [...loaded.pickups].filter(p => p.kind === 'note')) loaded.collect(pk);
    // The remaining first-pass notes schedule their second appearance.
    loaded.update(1.4, newCtl());
    for (const pk of loaded.pickups.filter(p => p.kind === 'note' && p.itemId === 1 && !loaded.rhythmRepeats.has(p.id))) loaded.collect(pk);
    expect(loaded.rhythm.got).toBe(loaded.rhythm.total); expect(loaded.rhythm.done).toBe(true);
    const finished = validateSave(captureSave(loaded))!, resumed = create(); applySave(resumed, finished);
    expect(resumed.rhythm.done).toBe(true); expect(resumed.score).toBe(loaded.score);
    expect(resumed.pickups.some(p => p.kind === 'note')).toBe(false);
  });

  it('save legado credita notas antigas e valida IDs das repetições', () => {
    const w = makeWorld(), note = w.data.pickups.find(p => p.kind === 'note')!;
    w.collectedPickups.add(note.id);
    const old = captureSave(w); delete old.rhythmRepeats;
    const loaded = makeWorld(); applySave(loaded, validateSave(old)!);
    expect(loaded.rhythm.got).toBe(2);
    expect(validateSave({ ...old, rhythmRepeats: [-1] })).toBeNull();
    expect(validateSave({ ...old, rhythmRepeats: [999999] })).toBeNull();
  });

  it('a limpeza de projéteis interrompe o array antigo antes de causar dano', () => {
    const w = makeWorld(); w.invulnerable = false; w.level.tiles.fill(0); w.level.relief.fill(0);
    w.player.reset(500, 240); w.player.invuln = 0; w.props = []; w.enemies = [];
    const hostile = new Bullet(450, 220, 6000, 0, { team: 1, dmg: 12 });
    const friendly = new Bullet(20, 20, 0, 0, { team: 0, dmg: 1 });
    const trigger = new Bullet(10, 10, 0, 0, { team: 0, dmg: 1 });
    vi.spyOn(trigger, 'update').mockImplementation(() => w.clearEnemyBullets());
    w.bullets = [trigger, hostile, friendly]; const hp = w.player.hp;
    for (const b of w.bullets) b.update(w, 1 / 60);
    expect(hostile.dead).toBe(true); expect(w.player.hp).toBe(hp);
    expect(w.bullets).toContain(friendly);
  });

  it.each([false, true])('raycast detecta quina real e fração exata, sentido inverso=%s', reverse => {
    const w = makeWorld(), a = [11038, 604], b = [11048, 614];
    expect(w.level.get(345, 18)).toBe(T.SOLID);
    const start = reverse ? b : a, end = reverse ? a : b;
    expect(w.level.rayHit(start[0], start[1], end[0], end[1])).toBeCloseTo(reverse ? 0.6 : 0.2);
  });

  it('raycast cruza tiles finos, aceita zero comprimento e ignora one-way', () => {
    const l = new Level(10, 10); l.set(3, 3, T.SOLID); l.set(2, 2, T.ONEWAY);
    expect(l.rayHit(0, 100, 200, 100)).toBeCloseTo(96 / 200);
    expect(l.rayHit(0, 100, 96, 100)).toBe(1);
    expect(l.rayHit(100, 0, 100, 96)).toBe(1);
    expect(l.rayHit(128, 80, 112, 96)).toBe(1);
    expect(l.rayHit(100, 100, 100, 100)).toBe(0);
    expect(l.rayHit(1, 1, 1, 1)).toBe(-1);
    expect(l.rayHit(65, 60, 65, 90)).toBe(-1);
  });

  it('explosivo inimigo detona uma vez ao atingir cobertura e tiro comum não detona', () => {
    for (const explosive of [true, false]) {
      const w = makeWorld(); w.level.tiles.fill(0); w.level.relief.fill(0); w.enemies = [];
      w.player.reset(500, 240);
      w.props = [new Prop({ id: 999, kind: 'crate', x: 180, y: 240, w: 32, h: 60, solid: true })];
      const boom = vi.spyOn(w, 'explode');
      const b = new Bullet(100, 210, 12000, 0, { team: 1, dmg: 12, explode: explosive ? { radius: 48, dmg: 18 } : null });
      b.update(w, 1 / 60); b.update(w, 1 / 60);
      expect(b.dead).toBe(true); expect(boom).toHaveBeenCalledTimes(explosive ? 1 : 0);
    }
  });

  it('cenário largo continua desenhado com 38px visíveis mesmo em outro bucket', () => {
    const w = new World(buildJungle()), d = w.data.decos.find(d => d.kind === 'villageStream')!;
    const draw = vi.spyOn(decor, 'drawDeco').mockImplementation(() => {}), bounds = decor.decoExtent(d);
    w.camera.x = bounds[2] - 38.4; w.camera.viewW = 600;
    w.director.drawDecos({} as CanvasRenderingContext2D, d.layer);
    expect(draw.mock.calls.filter(([, spawn]) => spawn === d)).toHaveLength(1);
    draw.mockClear(); w.camera.x = bounds[2] + 1;
    w.director.drawDecos({} as CanvasRenderingContext2D, d.layer);
    expect(draw.mock.calls.some(([, spawn]) => spawn === d)).toBe(false);
  });

  it('Atlântida e lago usam a mesma profundidade de cor e faixas recortadas não sobrepõem', () => {
    const w = new World(buildJungle()), deep = w.water.zones.find(z => z.surface !== undefined)!;
    const shallow = w.water.zones.find(z => z.surface === undefined && z.y === deep.surface)!;
    expect(waterDepthRange(shallow, w.water.zones)).toEqual(waterDepthRange(deep, w.water.zones));
    const fillRect = vi.fn(), g = { fillRect } as unknown as CanvasRenderingContext2D;
    abyss(g, deep, { x0: 0, x1: 100, y0: 1408, y1: 1553 });
    const ranges = fillRect.mock.calls.map(([, y, , h]) => [y, y + h]);
    expect(ranges[0][0]).toBe(1408); expect(ranges.at(-1)![1]).toBe(1553);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBe(ranges[i - 1][1]);
  });

  it('Start/A/direções operam menus sem reutilizar o botão que abriu a pausa', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { index: 0, connected: true, axes: [0, 0], buttons };
    const input = new Input();
    (input as unknown as { padIndex: number }).padIndex = 0;
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    const menu = vi.fn(); input.onMenuKey = menu;
    buttons[9].pressed = true; input.poll(); expect(input.state.pause.pressed).toBe(true);
    input.enabled = false; input.poll(); expect(menu).not.toHaveBeenCalled();
    buttons[9].pressed = false; input.poll(); buttons[9].pressed = true; input.poll();
    expect(menu).toHaveBeenLastCalledWith('Escape');
    buttons[9].pressed = false; input.poll(); buttons[0].pressed = true; input.poll();
    expect(menu).toHaveBeenLastCalledWith('Enter'); expect(input.state.jump.pressed).toBe(false);
    input.poll(); expect(menu).toHaveBeenCalledTimes(2);
    buttons[0].pressed = false; buttons[13].pressed = true; input.poll();
    expect(menu).toHaveBeenLastCalledWith('ArrowDown');
  });
});
