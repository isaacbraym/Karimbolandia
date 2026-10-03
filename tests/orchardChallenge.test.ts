import { describe, expect, it, vi } from 'vitest';
import { encounterCatalog } from '../src/game/encounters/catalog';
import { TRAIL, TrailChallenge } from '../src/game/encounters/challenge';
import { World } from '../src/game/world';
import { buildJungle } from '../src/game/level/jungle';
import { newCtl } from './helpers/bot';
import { applySave, captureSave } from '../src/game/save';
import { validateSave } from '../src/core/saveValidation';

const orchard = (w: World) => w.encounters.trails.find(t => t.def.theme === 'harvest')!;
function walkHarvest(w: World) {
  const trail = orchard(w), first = trail.def.points[0], ctl = newCtl();
  w.player.reset(first.x - 64, w.level.groundBelow(first.x, first.y)!);
  w.player.lockInput = false;w.director.cine = null;
  let hold = 0, frames = 0;
  for (; frames < 1800 && trail.status !== 'complete'; frames++) {
    const target = trail.def.points[Math.min(trail.next, trail.def.points.length - 1)], dx = target.x - w.player.x;
    ctl.moveX = Math.abs(dx) > 5 ? Math.sign(dx) : 0;
    ctl.jump.pressed = w.player.body.onGround && (Math.abs(dx) < 30 || w.player.body.wallDir !== 0);
    if (ctl.jump.pressed) hold = .22;
    ctl.jump.held = hold > 0;hold -= 1 / 60;
    w.player.update(w, 1 / 60, ctl);w.encounters.update(w, 1 / 60);
  }
  return frames / 60;
}

describe('colheita opcional no pomar', () => {
  it('preserva o encontro anterior e situa seis saltos entre Pomares e Saída', () => {
    const w = new World(buildJungle()), trail = orchard(w);
    expect(w.encounters.trails[0].def.id).toBe('jungle:firefly-trail');
    expect(trail).toBeDefined();expect(trail.def.points).toHaveLength(6);
    const first = trail.def.points[0], last = trail.def.points.at(-1)!;
    expect(w.data.checkpoints.some(c => c.x > first.x && c.x < last.x)).toBe(false);
    expect(w.data.checkpoints.some(c => c.x < first.x && c.x > first.x - 600)).toBe(true);
    // Some tree platforms are overhead: query the public walking floor beneath the ring.
    for (const p of trail.def.points) {
      expect(w.level.groundBelow(p.x, p.y + 64)! - p.y).toBe(82);
      expect(w.level.solidAtPx(p.x, p.y)).toBe(false);
    }
  });
  it('conclui andando e saltando com colisões reais e margem no prazo', () => {
    const w = new World(buildJungle()), elapsed = walkHarvest(w), trail = orchard(w);
    expect({ status: trail.status, next: trail.next }).toEqual({ status: 'complete', next: 6 });
    expect(elapsed).toBeLessThan(trail.def.seconds - 5);
    expect(trail.left).toBeGreaterThan(5);expect(w.tokens).toBe(20);
  });
  it('guardar, morrer e reabrir não duplicam a colheita nem as moedas', () => {
    const w = new World(buildJungle()), hook = vi.fn();w.hooks.onProgress = hook;
    walkHarvest(w);expect(hook).toHaveBeenCalledTimes(1);
    w.respawn();expect(orchard(w).status).toBe('complete');
    const saved = validateSave(captureSave(w))!;
    expect(saved.encounters).toContain('jungle:orchard-harvest');
    const restored = new World(buildJungle());applySave(restored, saved);walkHarvest(restored);
    expect(orchard(restored).status).toBe('complete');expect(restored.tokens).toBe(20);
  });
  it('cinema suspende a tentativa e morte reinicia o percurso sem cobrar moedas', () => {
    const w = new World(buildJungle()), t = orchard(w), p = t.def.points[0];
    w.player.reset(p.x, p.y + w.player.body.h / 2);w.encounters.update(w, .1);
    const left = t.left;w.player.lockInput = true;w.encounters.update(w, 30);
    expect(t.left).toBe(left);w.respawn();expect(t.status).toBe('ready');expect(w.tokens).toBe(0);
  });
  it('layouts incompatíveis não recebem a colheita: água, checkpoint, objeto ou chão ausente', () => {
    for (const obstacle of ['water', 'checkpoint', 'prop', 'floor']) {
      const data = buildJungle(), x = 1198.5 * 32;
      if (obstacle === 'water') data.water.push({ ...data.water[0], x, w: 32 });
      if (obstacle === 'checkpoint') data.checkpoints.push({ ...data.checkpoints[0], x });
      if (obstacle === 'prop') data.props.push({ ...data.props[0], x });
      if (obstacle === 'floor') vi.spyOn(data.level, 'groundBelow').mockReturnValue(null);
      expect(encounterCatalog(data).some(d => d.theme === 'harvest')).toBe(false);
    }
  });
  it('um avanço longo coleta os aros na ordem, mas atravessar de trás para frente não coleta retroativamente', () => {
    const definition = { id: 'test:order', title: 'Order', theme: 'harvest' as const,
      points: [100, 220, 340].map(x => ({ x, y: 100 })), seconds: 3, coins: 20 };
    const forward = new TrailChallenge(definition);forward.update(0, 50, 100);
    expect(forward.update(.1, 390, 100) & TRAIL.COMPLETE).toBeTruthy();
    const reverse = new TrailChallenge(definition);reverse.update(0, 390, 100);
    expect(reverse.update(.1, 50, 100) & TRAIL.COMPLETE).toBeFalsy();expect(reverse.next).toBe(1);
    expect(reverse.update(.1, 390, 100) & TRAIL.COMPLETE).toBeTruthy();
  });
});
