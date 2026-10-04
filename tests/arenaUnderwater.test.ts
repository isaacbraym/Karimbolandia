import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCtl } from './helpers/bot';

let disk: Map<string, string>;
beforeEach(() => {
  disk = new Map();
  vi.stubGlobal('localStorage', { get length() { return disk.size; }, key: (i: number) => [...disk.keys()][i] ?? null, getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => disk.set(k, v) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

async function jungleWithSuit() {
  const s = await import('../src/core/storage');
  s.progress.ownedSkins.push('diver');
  s.progress.equippedSkin = 'diver';
  const { World } = await import('../src/game/world');
  const { buildJungle } = await import('../src/game/level/jungle');
  const w = new World(buildJungle());
  w.director.cine = null;
  return w;
}

const campArena = (w: { data: { arenas: { id: string; rect: { x: number; y: number; w: number; h: number } }[] } }) =>
  w.data.arenas.find((a) => a.id === 'camp')!;

describe('Atlântida embaixo do acampamento (bug: arena disparada debaixo d\'água)', () => {
  it('nadar no fundo da caverna sob o acampamento não dispara a arena nem checkpoints', async () => {
    const w = await jungleWithSuit();
    const p = w.player;
    const ctl = newCtl();
    const camp = campArena(w);
    const cpBefore = w.checkpointIdx;
    // canto direito da caverna, já dentro das colunas do acampamento (608+)
    for (const col of [606, 609, 612, 614]) {
      p.reset(col * 32 + 16, 70 * 32);
      w.cameraSnap();
      for (let f = 0; f < 60; f++) { p.body.vy = 0; w.update(1 / 60, ctl); }
      expect(w.director.activeArenaRect()).toBeNull();
      expect(w.camera.lock).not.toBe(camp.rect);
      expect(p.mode).not.toBe('dead');
    }
    // nenhum checkpoint da superfície ("Margem", 555) é tomado lá de baixo
    const reached = w.checkpointIdx >= 0 ? w.data.checkpoints[w.checkpointIdx] : null;
    expect(reached?.x ?? -1).toBe(cpBefore >= 0 ? w.data.checkpoints[cpBefore].x : -1);
  });

  it('entrar pelo chão do acampamento continua disparando a arena', async () => {
    const w = await jungleWithSuit();
    const p = w.player;
    const ctl = newCtl();
    const camp = campArena(w);
    p.reset(610 * 32 + 16, 32 * 32);
    w.cameraSnap();
    for (let f = 0; f < 10; f++) w.update(1 / 60, ctl);
    expect(w.director.activeArenaRect()).toBe(camp.rect);
  });

  it('rede de segurança: arena ativa com o Karimbo longe dela é abortada e destrava a câmera', async () => {
    const w = await jungleWithSuit();
    const p = w.player;
    const ctl = newCtl();
    const camp = campArena(w);
    p.reset(610 * 32 + 16, 32 * 32);
    w.cameraSnap();
    for (let f = 0; f < 90; f++) w.update(1 / 60, ctl); // primeira onda já em campo
    expect(w.director.activeArenaRect()).toBe(camp.rect);
    // algo leva o Karimbo para fora da arena (debaixo d'água, embaixo do acampamento)
    p.reset(612 * 32 + 16, 70 * 32);
    for (let f = 0; f < 60 * 4; f++) { p.body.vy = 0; w.update(1 / 60, ctl); }
    expect(p.mode).not.toBe('dead');
    expect(w.director.activeArenaRect()).toBeNull();
    expect(w.camera.lock).not.toBe(camp.rect);
    expect(w.props.some((pr) => pr.barrier && pr.alive && pr.spawn.id <= -1000)).toBe(false);
    expect(w.enemies.some((e) => e.alive && e.spawnedByArena)).toBe(false);
    // voltando pelo caminho certo, a arena recomeça do zero
    p.reset(610 * 32 + 16, 32 * 32);
    w.cameraSnap();
    for (let f = 0; f < 10; f++) w.update(1 / 60, ctl);
    expect(w.director.activeArenaRect()).toBe(camp.rect);
  });
});

describe('Faixas verticais de checkpoints e arenas em todas as fases', () => {
  it('todo checkpoint e toda arena continuam alcançáveis pelo chão', async () => {
    const { World } = await import('../src/game/world');
    const { buildLevel } = await import('../src/game/level/index');
    const { buildJungle } = await import('../src/game/level/jungle');
    for (const data of [buildLevel(), buildJungle()]) {
      const w = new World(data);
      const L = w.level;
      const standH = w.player.body.h;
      // centro do Karimbo em pé no chão logo abaixo de (x, desde y0)
      const standY = (x: number, y0: number) => {
        const g = L.groundBelow(x, y0, 40 * 32);
        return g === null ? null : g - standH / 2;
      };
      for (const cp of data.checkpoints) {
        const y = standY(cp.x + 8, cp.y - 8 * 32);
        expect(y, `checkpoint ${cp.name}`).not.toBeNull();
        expect(y! <= cp.y + 6 * 32, `checkpoint ${cp.name}`).toBe(true);
      }
      for (const a of data.arenas) {
        const r = a.rect;
        let ok = false;
        for (let x = a.triggerX + 8; x < r.x + r.w && !ok; x += 16) {
          const y = standY(x, r.y);
          if (y !== null && y >= r.y - 4 * 32 && y <= r.y + r.h + 2 * 32) ok = true;
        }
        expect(ok, `arena ${a.id}`).toBe(true);
      }
    }
  });
});
