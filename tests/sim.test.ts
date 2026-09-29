import { describe, it, expect } from 'vitest';
import { makeWorld, armUp, teleport, Bot, run, newCtl } from './helpers/bot';
import { TILE } from '../src/game/level';
import type { World } from '../src/game/world';
import type { ControlState } from '../src/core/input';

/** Roda a apresentação e faz o Karimbo cair em cima do Nômad. */
function mountNomad(w: World, ctl: ControlState) {
  run(w, new Bot(w), ctl, 14, () => w.director.nomadMountable);
  ctl.moveX = 0;
  ctl.fire.held = false;
  ctl.jump.held = false;
  ctl.mouseAim = null;
  const ns = w.data.nomadSpawn;
  w.player.reset(ns.x, ns.y - 170);
  for (let i = 0; i < 180 && !w.player.mounted; i++) w.update(1 / 60, ctl);
  for (let i = 0; i < 90; i++) w.update(1 / 60, ctl);
}

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
    run(w, bot, ctl, 14, () => w.director.nomadMountable);
    expect(w.director.nomadMountable).toBe(true);
    expect(w.player.mounted).toBe(false); // não embarca sozinho
    // pula em cima do Nômad
    ctl.moveX = 0;
    ctl.fire.held = false;
    ctl.jump.held = false;
    ctl.mouseAim = null;
    const ns = w.data.nomadSpawn;
    w.player.reset(ns.x, ns.y - 170);
    for (let i = 0; i < 90 && !w.player.mounted; i++) w.update(1 / 60, ctl);
    for (let i = 0; i < 90; i++) w.update(1 / 60, ctl);
    expect(w.player.mounted).toBe(true);
    expect(w.player.nomad!.hp).toBeGreaterThan(0);
  });

  it('Nômad: avanço e segundo avanço (janela de 5 s)', () => {
    const w = makeWorld();
    teleport(w, 534, 32);
    const ctl = newCtl();
    mountNomad(w, ctl);
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
    mountNomad(w2, c2);
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
    mountNomad(w, ctl);
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

describe('Reinício e restauração', () => {
  it('restaurar o mapa desfaz o piso desabado da arena do chefe', () => {
    const w = makeWorld();
    const boss = w.data.arenas.find((a) => a.id === 'boss')!;
    const cc = Math.round((boss.rect.x + boss.rect.w / 2) / TILE);
    const before = w.level.get(cc, 14);
    expect(before).toBe(1);
    w.level.set(cc, 14, 0);
    expect(w.level.get(cc, 14)).toBe(0);
    w.restart();
    expect(w.level.get(cc, 14)).toBe(1);
  });

  it('reiniciar a fase zera progresso: inimigos, itens, arenas, Nômad e checkpoints', () => {
    const w = makeWorld();
    armUp(w);
    teleport(w, 100, 32);
    run(w, new Bot(w, { hold: true }), newCtl(), 8);
    w.score = 999;
    w.emblems.add(3);
    w.nomadUsed = true;
    w.director.arenas[0].status = 'cleared';
    w.restart();
    expect(w.score).toBe(0);
    expect(w.emblems.size).toBe(0);
    expect(w.killedEnemies.size).toBe(0);
    expect(w.nomadUsed).toBe(false);
    expect(w.director.arenas.every((a) => a.status === 'idle')).toBe(true);
    expect(w.checkpointIdx).toBe(-1);
    expect(w.player.x).toBeCloseTo(w.data.playerStart.x, 0);
    expect(w.enemies.length).toBe(w.data.enemies.filter((e) => !e.arena).length);
  });
});

describe('Seção 11: desembarque e túnel de engatinhar', () => {
  it('o Nômad é forçado a estacionar e o Karimbo atravessa o túnel de 1 tile engatinhando', () => {
    const w = makeWorld();
    teleport(w, 1042, 32);
    w.director.remountAtCheckpoint(200);
    const ctl = newCtl();
    expect(w.player.mounted).toBe(true);
    // anda para a direita até o gatilho de desembarque
    ctl.moveX = 1;
    for (let i = 0; i < 60 * 3; i++) {
      w.update(1 / 60, ctl);
      if (!w.player.mounted) break;
    }
    expect(w.player.mounted).toBe(false);
    expect(w.parkedNomad).not.toBeNull();
    // engatinha: baixo + direita
    ctl.moveY = 1;
    let crossed = false;
    for (let i = 0; i < 60 * 14; i++) {
      w.update(1 / 60, ctl);
      if (w.player.x > 1070 * 32) {
        crossed = true;
        break;
      }
    }
    expect(crossed).toBe(true);
  });

  it('em pé o Karimbo NÃO passa pelo túnel (a passagem exige agachar)', () => {
    const w = makeWorld();
    teleport(w, 1046, 32);
    const ctl = newCtl();
    ctl.moveX = 1;
    for (let i = 0; i < 60 * 8; i++) w.update(1 / 60, ctl);
    expect(w.player.x).toBeLessThan(1053 * 32);
  });
});
