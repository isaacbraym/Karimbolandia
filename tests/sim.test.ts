import { mapTile as M } from '../src/game/level/index';
import { describe, it, expect } from 'vitest';
import { makeWorld, armUp, teleport, Bot, run, newCtl } from './helpers/bot';
import { TILE } from '../src/game/level';
import { pickLoot } from '../src/game/props';
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
    teleport(w, M(436), 32);
    const bot = new Bot(w, { hold: true });
    const ctl = newCtl();
    const a = w.director.arenas.find((x) => x.def.id === 'a1')!;
    const tm = run(w, bot, ctl, 180, () => a.status === 'cleared');
    expect(a.status).toBe('cleared');
    expect(tm).toBeLessThan(179);
  });

  it('a cinemática do Nômad embarca o Karimbo', () => {
    const w = makeWorld();
    teleport(w, M(534), 32);
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
    teleport(w, M(534), 32);
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
    teleport(w2, M(534), 32);
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
    teleport(w, M(534), 32);
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
    teleport(w, M(100), 32);
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
    teleport(w, M(100), 32);
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
    teleport(w, M(1042), 32);
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
      if (w.player.x > M(1070) * 32) {
        crossed = true;
        break;
      }
    }
    expect(crossed).toBe(true);
  });

  it('em pé o Karimbo NÃO passa pelo túnel (a passagem exige agachar)', () => {
    const w = makeWorld();
    teleport(w, M(1046), 32);
    const ctl = newCtl();
    ctl.moveX = 1;
    for (let i = 0; i < 60 * 8; i++) w.update(1 / 60, ctl);
    expect(w.player.x).toBeLessThan(M(1053) * 32);
  });
});

describe('Agachar desvia de tiros retos', () => {
  const setup = (crouch: boolean) => {
    const w = makeWorld();
    w.invulnerable = false;
    teleport(w, M(38), 32);
    w.director.arenas.length = 0;
    const px = w.player.x;
    // atirador e jogador no mesmo nível, a ~7 tiles
    w.spawnEnemy({ id: 99991, type: 'rifle', x: px + 7 * TILE, y: 32 * TILE, facing: -1 });
    const ctl = newCtl();
    ctl.moveY = crouch ? 1 : 0;
    let hits = 0;
    let lastHp = w.player.hp;
    for (let i = 0; i < 60 * 12; i++) {
      w.update(1 / 60, ctl);
      if (w.player.hp < lastHp) hits++;
      lastHp = w.player.hp;
      if (!w.enemies.some((e) => e.alive)) break;
    }
    return { hits, crouched: w.player.crouch, hp: w.player.hp };
  };

  it('em pé o jogador é atingido', () => {
    const r = setup(false);
    expect(r.hits).toBeGreaterThan(0);
  });

  it('agachado, os tiros retos passam por cima', () => {
    const r = setup(true);
    expect(r.crouched).toBe(true);
    expect(r.hits).toBe(0);
    expect(r.hp).toBe(119);
  });
  it('Nômad de apoio: cai após ~90 s, embarca por cima, dura 50 s e some sem marcar o principal como perdido', () => {
    const w = makeWorld();
    teleport(w, M(200), 32);
    w.nomadLost = true; // já passou pelo Nômad principal
    const ctl = newCtl();
    const d = w.director;
    d.supportClock = 89.5;
    for (let i = 0; i < 60 * 4 && !d.support?.ready; i++) w.update(1 / 60, ctl);
    expect(d.support?.ready).toBe(true);
    const s = d.support!;
    w.player.reset(s.x, s.y - 170);
    for (let i = 0; i < 240 && !w.player.mounted; i++) w.update(1 / 60, ctl);
    expect(w.player.mounted).toBe(true);
    expect(w.player.nomad!.timeLeft).toBeLessThanOrEqual(50);
    expect(w.player.nomad!.timeLeft).toBeGreaterThan(40);
    expect(d.supportUsed).toBe(true);
    // não vira o Nômad "principal" do checkpoint
    expect(w.player.snapshot().nomad).toBe(-1);
    for (let i = 0; i < 60 * 52 && w.player.mounted; i++) w.update(1 / 60, ctl);
    expect(w.player.mounted).toBe(false);
    expect(w.player.mode).not.toBe('dead');
  });

  it('caixas: nem todas dão item e o sorteio varia', () => {
    const kinds = new Set<string>();
    let empty = 0;
    for (let i = 0; i < 400; i++) {
      const k = pickLoot('random', new Set(['pistol', 'rifle', 'shotgun']));
      if (k === null) empty++;
      else kinds.add(k);
    }
    expect(empty).toBeGreaterThan(40);
    expect(empty).toBeLessThan(200);
    expect(kinds.size).toBeGreaterThanOrEqual(5);
  });
  it('3 vidas por fase: continua de onde morreu; sem vidas vira fim de jogo', () => {
    const w = makeWorld();
    w.invulnerable = false;
    teleport(w, M(200), 32);
    const ctl = newCtl();
    let asked = 0;
    let over = 0;
    w.hooks.onContinue = () => {
      asked++;
    };
    w.hooks.onGameOver = () => {
      over++;
    };
    expect(w.lives).toBe(3);
    const die = () => {
      w.player.invuln = 0;
      w.player.hit(w, 999, 1, { ignoreInvuln: true });
      for (let i = 0; i < 60 * 3 && asked + over === before; i++) w.update(1 / 60, ctl);
    };
    let before = 0;
    const startX = w.player.x;
    for (let n = 1; n <= 3; n++) {
      before = asked + over;
      die();
      expect(asked).toBe(n);
      w.reviveInPlace();
      expect(w.lives).toBe(3 - n);
      expect(w.player.mode).toBe('foot');
      expect(w.player.hp).toBe(w.player.maxHp);
      expect(Math.abs(w.player.x - startX)).toBeLessThan(120); // continuou onde parou (não voltou ao checkpoint)
      for (let i = 0; i < 30; i++) w.update(1 / 60, ctl);
    }
    before = asked + over;
    die();
    expect(over).toBe(1);
    expect(w.lives).toBe(0);
    w.reviveInPlace(); // sem vidas: nada acontece
    expect(w.lives).toBe(0);
    // reiniciar a fase devolve as vidas
    w.restart();
    expect(w.lives).toBe(3);
  });
  it('Nômad obrigatório: o portão da garagem só abre depois de embarcar; depois vêm hordas', () => {
    const w = makeWorld();
    teleport(w, M(586), 32);
    w.director.triggered.add('nomadMeet');
    const ctl = newCtl();
    ctl.moveX = 1;
    for (let i = 0; i < 60 * 8; i++) w.update(1 / 60, ctl);
    expect(w.nomadUsed).toBe(false);
    expect(w.player.x).toBeLessThan(597 * TILE); // barrado pelo portão
    expect(w.director.nomadGate?.alive).toBe(true);
    ctl.moveX = 0;
    mountNomad(w, ctl);
    expect(w.player.mounted).toBe(true);
    expect(w.director.nomadGate).toBeNull();
    // trecho de guerra: chegam levas contínuas enquanto pilota
    w.player.body.x = M(650) * TILE;
    for (let i = 0; i < 60 * 8; i++) w.update(1 / 60, ctl);
    expect(w.enemies.filter((e) => e.alive && e.spawnedByArena === false && e.spawn.id <= -5000).length).toBeGreaterThan(0);
  });
  it('Nômad quebra caixas só de passar (sem atirar); Karimbo desliza ao agachar correndo', () => {
    const w = makeWorld();
    teleport(w, M(640), 32);
    w.nomadUsed = true;
    w.director.remountAtCheckpoint(300);
    const ctl = newCtl();
    // caixa logo à frente
    const crate = w.props.find((p) => p.alive && p.kind === 'crate' && p.x > w.player.x);
    expect(crate).toBeTruthy();
    w.player.body.x = crate!.x - 120;
    w.player.body.y = crate!.y + crate!.h / 2 - w.player.body.h / 2 - 1;
    ctl.moveX = 1;
    for (let i = 0; i < 90 && crate!.alive; i++) w.update(1 / 60, ctl);
    expect(crate!.alive).toBe(false);
    expect(w.stats.shots).toBe(0);
    // deslize a pé
    const w2 = makeWorld();
    teleport(w2, M(200), 32);
    const c2 = newCtl();
    c2.moveX = 1;
    for (let i = 0; i < 40; i++) w2.update(1 / 60, c2);
    c2.moveY = 1;
    w2.update(1 / 60, c2);
    expect(w2.player.slideT).toBeGreaterThan(0);
    expect(w2.player.crouch).toBe(true);
    expect(Math.abs(w2.player.body.vx)).toBeGreaterThan(300);
  });

  it('vida +40% e +3 vidas ao chegar no chefe (uma vez)', () => {
    const w = makeWorld();
    expect(w.player.maxHp).toBe(119);
    expect(w.lives).toBe(3);
    const d = w.director as unknown as { startBoss: (a: unknown) => void; arenas: { def: { id: string } }[] };
    const a = d.arenas.find((x) => x.def.id === 'boss');
    d.startBoss(a);
    expect(w.lives).toBe(6);
    d.startBoss(a);
    expect(w.lives).toBe(6);
  });
  it('escudo tem vida e quebra; Nômad 450 de vida; granada maior; contador da zona de guerra', async () => {
    const { newNomad } = await import('../src/game/player');
    const { Grenade } = await import('../src/game/bullets');
    expect(newNomad().maxHp).toBe(450);
    expect(new Grenade(0, 0, 0, 0).radius).toBeGreaterThanOrEqual(115);
    const w = makeWorld();
    const sp = w.data.enemies.find((e) => e.type === 'shield' && !e.arena)!;
    const e = w.enemies.find((x) => x.spawn.id === sp.id) as unknown as { shieldHp: number; broken: boolean; facing: number; x: number; y: number; hurt: (w: unknown, d: number, i: unknown) => number };
    const bullet = { vx: -e.facing * 900, vy: 0, kind: 'rifle' };
    let blocked = 0;
    for (let i = 0; i < 40 && !e.broken; i++) if (e.hurt(w, 10, { type: 'bullet', bullet, x: e.x, y: e.y, dir: -e.facing, kx: 0, ky: 0 }) === -1) blocked++;
    expect(blocked).toBeGreaterThan(5);
    expect(e.broken).toBe(true);
    // contador: arena 1
    const d = w.director as unknown as { arenas: { def: { triggerX: number } }[] };
    teleport(w, Math.floor(d.arenas[0].def.triggerX / TILE) + 1, 32);
    const ctl = newCtl();
    for (let i = 0; i < 30; i++) w.update(1 / 60, ctl);
    const z = w.director.warZone();
    expect(z).not.toBeNull();
    expect(z!.remaining).toBeGreaterThan(3);
  });
  it('reviver na luta do chefe após o chão desabar não cai de novo no buraco (bug: perdia todas as vidas)', () => {
    const w = makeWorld();
    w.invulnerable = false;
    const ctl = newCtl();
    let asked = 0;
    let over = 0;
    w.hooks.onContinue = () => asked++;
    w.hooks.onGameOver = () => over++;
    teleport(w, M(1296), 14);
    ctl.moveX = 1;
    for (let i = 0; i < 60; i++) w.update(1 / 60, ctl);
    ctl.moveX = 0;
    for (let i = 0; i < 60 * 5; i++) w.update(1 / 60, ctl);
    const b = w.director.bossRef as unknown as { rect: { x: number; w: number }; phase: number; warnCrumble: (w: unknown, k: string) => void };
    expect(b).toBeTruthy();
    const cc = Math.round((b.rect.x + b.rect.w / 2) / TILE);
    // o "último ponto seguro" fica justamente no meio do palco…
    w.player.lastSafe = { x: cc * TILE + 16, y: 14 * TILE };
    b.phase = 2;
    b.warnCrumble(w, 'center');
    for (let i = 0; i < 60 * 2.2; i++) w.update(1 / 60, ctl);
    // …que desabou: o Karimbo cai no buraco com pouca vida e morre
    w.player.body.x = cc * TILE + 16;
    w.player.body.y = 12 * TILE;
    w.player.hp = 15;
    w.player.invuln = 0;
    for (let i = 0; i < 60 * 6 && asked === 0; i++) w.update(1 / 60, ctl);
    expect(asked).toBe(1);
    const lives = w.lives;
    w.reviveInPlace();
    expect(w.lives).toBe(lives - 1);
    // reviveu em chão firme e continua vivo (não entra em ciclo de quedas)
    expect(w.standableAt(Math.floor(w.player.x / TILE), Math.floor(w.player.feetY / TILE))).toBe(true);
    for (let i = 0; i < 60 * 3; i++) w.update(1 / 60, ctl);
    expect(w.player.mode).not.toBe('dead');
    expect(asked).toBe(1);
    expect(over).toBe(0);
    expect(w.stats.pitFalls).toBeLessThanOrEqual(2);
  });
  it('escopeta: coice dá pulinho para trás; atirando para baixo dá um pulinho para cima', () => {
    const w = makeWorld();
    teleport(w, M(30), 32);
    const ctl = newCtl();
    for (let i = 0; i < 20; i++) w.update(1 / 60, ctl);
    const p = w.player;
    p.cur = 'shotgun';
    p.facing = 1;
    ctl.mouseAim = { x: p.x + 300, y: p.y - 10 };
    ctl.fire.held = true;
    w.update(1 / 60, ctl);
    ctl.fire.held = false;
    expect(p.body.vx).toBeLessThan(-150);
    expect(p.body.vy).toBeLessThan(0);
    for (let i = 0; i < 12; i++) w.update(1 / 60, ctl);
    expect(p.body.onGround).toBe(false);
    // no ar, mirando para baixo
    for (let i = 0; i < 90; i++) w.update(1 / 60, ctl);
    ctl.jump.pressed = ctl.jump.held = true;
    w.update(1 / 60, ctl);
    ctl.jump.pressed = false;
    ctl.jump.held = false;
    for (let i = 0; i < 25; i++) w.update(1 / 60, ctl);
    p.fireCd = 0;
    ctl.mouseAim = { x: p.x + 2, y: p.y + 300 };
    ctl.fire.held = true;
    w.update(1 / 60, ctl);
    expect(p.body.vy).toBeLessThan(-350);
  });
  it('novidades: golpe corpo a corpo, ORELHADA, Rolo-Bomba e cenário destrutível pelo Nômad', () => {
    // golpe: inimigo colado leva dano sem gastar munição
    const w = makeWorld();
    teleport(w, M(200), 32);
    const ctl = newCtl();
    for (let i = 0; i < 20; i++) w.update(1 / 60, ctl);
    const p = w.player;
    const sp = { id: -777, type: 'rifle' as const, x: p.x + 30, y: p.feetY, facing: -1 as const };
    const e = w.spawnEnemy(sp);
    p.facing = 1;
    const ammo = p.weapons.get(p.cur);
    const hp0 = e.hp;
    ctl.mouseAim = { x: p.x + 200, y: p.y };
    ctl.fire.held = true;
    w.update(1 / 60, ctl);
    ctl.fire.held = false;
    expect(e.hp).toBeLessThan(hp0);
    expect(p.weapons.get(p.cur)).toBe(ammo);
    // ORELHADA
    const w2 = makeWorld();
    teleport(w2, M(200), 32);
    const c2 = newCtl();
    for (let i = 0; i < 20; i++) w2.update(1 / 60, c2);
    const p2 = w2.player;
    const foe = w2.spawnEnemy({ id: -778, type: 'rifle', x: p2.x + 60, y: p2.feetY, facing: -1 });
    const fh = foe.hp;
    c2.jump.pressed = c2.jump.held = true;
    w2.update(1 / 60, c2);
    c2.jump.pressed = false;
    for (let i = 0; i < 12; i++) w2.update(1 / 60, c2);
    c2.moveY = 1;
    c2.jump.pressed = true;
    w2.update(1 / 60, c2);
    c2.jump.pressed = false;
    expect(p2.slam).toBe(true);
    for (let i = 0; i < 60 && p2.slam; i++) w2.update(1 / 60, c2);
    expect(p2.slam).toBe(false);
    expect(foe.hp).toBeLessThan(fh);
    // Rolo-Bomba existe na fase
    expect(w.data.enemies.some((x) => x.type === 'roller')).toBe(true);
    // cenário destrutível: explosão perto de um carro estacionado o destrói
    const car = w.data.decos.findIndex((d) => d.kind === 'parkedCar');
    expect(car).toBeGreaterThanOrEqual(0);
    const cd = w.data.decos[car];
    w.explode(cd.x, cd.y - 20, 80, 10, 0);
    expect(w.smash.smashed.has(car)).toBe(true);
  });
  it('Nômad destrói carros/hidrantes passando por cima; hidrante vira gêiser', () => {
    const w = makeWorld();
    const decos = w.data.decos;
    const carIdx = decos.findIndex((d) => d.kind === 'parkedCar' && d.x > M(640) * TILE && d.y === 32 * TILE);
    expect(carIdx).toBeGreaterThanOrEqual(0);
    const car = decos[carIdx];
    teleport(w, Math.floor(car.x / TILE) - 8, 32);
    w.nomadUsed = true;
    w.director.remountAtCheckpoint(450);
    const ctl = newCtl();
    ctl.moveX = 1;
    for (let i = 0; i < 120 && !w.smash.smashed.has(carIdx); i++) w.update(1 / 60, ctl);
    expect(w.smash.smashed.has(carIdx)).toBe(true);
    expect(w.smash.extra.some((d) => d.kind === 'wreckCar')).toBe(true);
    for (let i = 0; i < 30; i++) w.update(1 / 60, ctl);
    expect(Number.isFinite(w.camera.x)).toBe(true);
    // hidrante
    const hyd = decos.findIndex((d) => d.kind === 'hydrant');
    expect(hyd).toBeGreaterThanOrEqual(0);
    const hd = decos[hyd];
    w.smash.area(hd.x - 5, hd.x + 5, hd.y - 60, hd.y, 1, 'nomad');
    expect(w.smash.geysers.length).toBeGreaterThan(0);
  });
});
