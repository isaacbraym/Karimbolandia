import { describe, it, expect } from 'vitest';
import { makeWorld, armUp, teleport, Bot, run, newCtl } from './helpers/bot';
import { TILE } from '../src/game/level';

describe('Simulação headless (bot invencível)', () => {
  it('percorre cada seção da fase sem exceções nem NaN', () => {
    const w = makeWorld();
    armUp(w);
    for (const s of w.data.sections) {
      teleport(w, Math.floor(s.x / TILE), Math.round(s.y / TILE));
      const bot = new Bot(w);
      const ctl = newCtl();
      run(w, bot, ctl, 10);
      expect(Number.isFinite(w.player.x)).toBe(true);
    }
  });

  it('limpa a arena 1 (ondas de inimigos) e destrava a câmera', () => {
    const w = makeWorld();
    armUp(w);
    teleport(w, 436, 32);
    const bot = new Bot(w, { hold: true });
    const ctl = newCtl();
    const a = w.director.arenas.find((x) => x.def.id === 'a1')!;
    const tm = run(w, bot, ctl, 180, () => a.status === 'cleared');
    expect(a.status).toBe('cleared');
    expect(tm).toBeLessThan(179);
  });

  it('a cinemática do Nômad embarca o Karimbo', () => {
    const w = makeWorld();
    teleport(w, 534, 32);
    const bot = new Bot(w, { walk: true });
    const ctl = newCtl();
    run(w, bot, ctl, 14, () => w.player.mounted);
    expect(w.player.mounted).toBe(true);
    expect(w.player.nomad!.hp).toBeGreaterThan(0);
  });

  it('Nômad: avanço e segundo avanço (janela de 5 s)', () => {
    const w = makeWorld();
    teleport(w, 534, 32);
    const ctl = newCtl();
    run(w, new Bot(w), ctl, 14, () => w.player.mounted);
    expect(w.player.mounted).toBe(true);
    const n = w.player.nomad!;
    // primeiro avanço
    ctl.special.pressed = true;
    w.update(1 / 60, ctl);
    ctl.special.pressed = false;
    expect(n.dashKind).toBe(1);
    expect(n.window).toBeGreaterThan(4.5);
    for (let i = 0; i < 30; i++) w.update(1 / 60, ctl); // termina o avanço
    expect(n.dashT).toBe(0);
    // segundo avanço dentro dos 5 s
    ctl.special.pressed = true;
    w.update(1 / 60, ctl);
    ctl.special.pressed = false;
    expect(n.dashKind).toBe(2);
    expect(n.dash2Used).toBe(true);
    for (let i = 0; i < 45; i++) w.update(1 / 60, ctl);
  });

  it('fora da janela de 5 s o segundo avanço não existe (volta a ser o primeiro)', () => {
    const w2 = makeWorld();
    teleport(w2, 534, 32);
    const c2 = newCtl();
    run(w2, new Bot(w2), c2, 14, () => w2.player.mounted);
    const n2 = w2.player.nomad!;
    c2.special.pressed = true;
    w2.update(1 / 60, c2);
    c2.special.pressed = false;
    for (let i = 0; i < 60 * 5.5; i++) w2.update(1 / 60, c2);
    expect(n2.window).toBeLessThanOrEqual(0);
    c2.special.pressed = true;
    w2.update(1 / 60, c2);
    expect(n2.dashKind).toBe(1);
  });

  it('Nômad destruído ejeta o Karimbo, que segue a pé', () => {
    const w = makeWorld();
    w.invulnerable = false;
    teleport(w, 534, 32);
    const ctl = newCtl();
    run(w, new Bot(w), ctl, 14, () => w.player.mounted);
    w.player.invuln = 0;
    w.player.nomad!.hp = 1;
    w.player.hit(w, 50, 1);
    expect(w.player.mounted).toBe(false);
    expect(w.nomadLost).toBe(true);
    expect(w.player.mode).toBe('foot');
    expect(w.player.hp).toBeGreaterThan(0);
  });

  it('derrota o Felipão (3 fases) e completa a fase', () => {
    const w = makeWorld();
    armUp(w);
    let completed = false;
    w.hooks.onComplete = () => (completed = true);
    const boss = w.data.arenas.find((a) => a.id === 'boss')!;
    teleport(w, Math.floor(boss.rect.x / TILE) + 8, 14);
    const bot = new Bot(w, { hold: true });
    const ctl = newCtl();
    run(w, bot, ctl, 300, () => completed);
    expect(completed).toBe(true);
    expect(w.finished).toBe(true);
  }, 60000);

  it('respawn preserva progresso (inimigos mortos) e volta ao checkpoint', () => {
    const w = makeWorld();
    w.invulnerable = false;
    armUp(w);
    teleport(w, 100, 32);
    const bot = new Bot(w, { hold: true });
    const ctl = newCtl();
    run(w, bot, ctl, 6);
    const kills = w.killedEnemies.size;
    w.player.invuln = 0;
    w.player.hit(w, 9999, 1);
    expect(w.player.mode).toBe('dead');
    run(w, bot, ctl, 4);
    expect(w.player.mode).toBe('foot');
    expect(w.killedEnemies.size).toBeGreaterThanOrEqual(kills);
    expect(w.stats.deaths).toBe(1);
  });
});
