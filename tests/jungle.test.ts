import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { buildJungle, LAKE_X0, LAKE_X1, LAKE_TOP, LAKE_FLOOR, GORGE_X0, GORGE_X1, GORGE_ISLAND, TEMPLE_X0, TEMPLE_X1, TEMPLE_DOOR_IN, TEMPLE_DOOR_OUT } from '../src/game/level/jungle';
import { G } from '../src/game/level/builder';
import { SINK_MAX } from '../src/game/player';
import { captureSave, applySave } from '../src/game/save';
import { TILE, T } from '../src/game/level';
import { analyzeReach } from '../src/game/level/reach';
import { RUN } from '../src/game/movement';
import { newCtl } from './helpers/bot';
import { progress } from '../src/core/storage';

const data = buildJungle();

describe('Brejo ampliado do crocodilo', () => {
  it('triplica o primeiro pantano sem agua sobreposta nem checkpoints inundados', () => {
    const swamps = data.water.filter(z => z.kind === 'swamp');
    expect(swamps[0].x).toBe(222 * TILE);
    expect(swamps[0].w).toBe(13 * 3 * TILE);
    for (let i = 1; i < swamps.length; i++) expect(swamps[i].x).toBeGreaterThanOrEqual(swamps[i - 1].x + swamps[i - 1].w);
    for (const cp of data.checkpoints) expect(swamps.some(z => cp.x >= z.x && cp.x < z.x + z.w)).toBe(false);
    const w = new World(buildJungle());
    expect(w.wildlife.crocodile!.x).toBeGreaterThan(swamps[0].x);
    expect(w.wildlife.crocodile!.x).toBeLessThan(swamps[0].x + swamps[0].w);
  });
  it('oferece apoios ao longo do brejo e mais fauna distribuida pelo novo espaco', () => {
    for (const [x, y] of [[226, G - 2], [235, G - 2], [242, G - 3], [247, G - 3], [257, G]]) expect(data.level.get(x, y)).not.toBe(T.EMPTY);
    const swamp = data.water.find(z => z.kind === 'swamp')!;
    const inside = data.decos.filter(d => d.x >= swamp.x && d.x < swamp.x + swamp.w);
    expect(inside.filter(d => d.kind === 'jDragonfly').length).toBeGreaterThanOrEqual(5);
    expect(inside.filter(d => d.kind === 'jFrogLily').length).toBeGreaterThanOrEqual(5);
  });
});

function jungleWorld() {
  const w = new World(buildJungle());
  w.screenToWorldFn = (x, y) => ({ x, y });
  w.invulnerable = true;
  return w;
}

describe('Fase 2 (selva): dados', () => {
  it('é a fase 2, sem Nômad nem chefe, com pântanos e um lago fundo', () => {
    expect(data.stage).toBe(2);
    expect(data.enemies.some((e) => e.type === 'boss')).toBe(false);
    const swamps = data.water.filter((z) => z.kind === 'swamp');
    const lakes = data.water.filter((z) => z.kind === 'lake');
    expect(swamps.length).toBeGreaterThanOrEqual(3);
    // lago, câmara funda de Atlântida (com a superfície real do lago) e o laguinho da aldeia
    expect(lakes.length).toBe(3);
    expect(lakes.filter((z) => z.surface !== undefined)).toHaveLength(1);
    expect(lakes[0].h).toBeGreaterThan(8 * TILE);
    expect(data.finishX).toBeGreaterThan(LAKE_X1 * TILE);
  });

  it('inimigos são só humanos (mercenários) — nada de robôs', () => {
    // piranhas são fauna hostil do lago, não máquinas
    const human = new Set(['rifle', 'shotgun', 'shield', 'sniper', 'grenadier', 'hunter', 'piranha']);
    expect(data.enemies.filter((e) => !human.has(e.type))).toEqual([]);
  });

  it('nenhum inimigo, item ou caixa embutido em tile sólido', () => {
    const L = data.level;
    const bad: string[] = [];
    for (const e of data.enemies) if (L.solidAtPx(e.x, e.y - 20)) bad.push(`inimigo ${e.type} @${Math.floor(e.x / TILE)}`);
    for (const p of data.props) if (L.solidAtPx(p.x, p.y - 8)) bad.push(`prop ${p.kind} @${Math.floor(p.x / TILE)}`);
    for (const p of data.pickups) if (L.solidAtPx(p.x, p.y)) bad.push(`pickup ${p.kind} @${Math.floor(p.x / TILE)}`);
    expect(bad).toEqual([]);
  });

  it('inimigos terrestres nascem sobre chão firme e fora da água', () => {
    const L = data.level;
    const bad: string[] = [];
    for (const e of data.enemies) {
      if (e.type === 'piranha') continue;
      const t = L.get(Math.floor(e.x / TILE), Math.round(e.y / TILE));
      if (!L.solidAtPx(e.x,e.y+1) && t !== T.SOLID && t !== T.ONEWAY) bad.push(`${e.type} @${Math.floor(e.x / TILE)} sem chão`);
      if (data.water.some((z) => e.x >= z.x && e.x < z.x + z.w && e.y > z.y)) bad.push(`${e.type} @${Math.floor(e.x / TILE)} na água`);
    }
    expect(bad).toEqual([]);
  });

  it('o lago tem fundo (não é um buraco mortal)', () => {
    const w = jungleWorld();
    const lake = data.water.find((z) => z.kind === 'lake')!;
    for (const p of w.pits) expect(p.x1 <= lake.x || p.x0 >= lake.x + lake.w).toBe(true);
    // a fenda sob a cachoeira desce para Atlântida, mas toda coluna do lago tem leito lá embaixo
    for (let tx = LAKE_X0; tx < LAKE_X1; tx++) {
      let floor = false;
      for (let ty = LAKE_FLOOR; ty < data.level.h && !floor; ty++) floor = data.level.isSolid(tx, ty);
      expect(floor, `coluna ${tx}`).toBe(true);
    }
  });
});

describe('Fase 2 (selva): caminho alcançável', () => {
  it('a pé, do início até a beira do lago; e da margem até a saída', () => {
    const margem = data.checkpoints.find((c) => c.name === 'Margem')!;
    const depois = data.checkpoints.find((c) => c.name === 'Depois dos cipós')!;
    const res = analyzeReach(data, [{ x: margem.x, y: margem.y }, { x: depois.x, y: depois.y }]);
    const missing: string[] = [];
    for (const c of data.checkpoints) {
      const tx = Math.floor(c.x / TILE);
      const ty = Math.round(c.y / TILE);
      if (!res.reached.has(res.key(tx, ty))) missing.push(c.name);
    }
    expect(missing).toEqual([]);
    const fx = Math.floor(data.finishX / TILE);
    expect(res.reached.has(res.key(fx, 32))).toBe(true);
  }, 60000); // Simulates the full campaign, including the 620-column community.
});

describe('Fase 2 (selva): água', () => {
  it('cair no lago (com o traje do Sivirino) veste o capacete e o Karimbo nada até a outra margem', () => {
    progress.ownedSkins.push('diver');
    progress.equippedSkin = 'diver';
    const w = jungleWorld();
    const ctl = newCtl();
    // pula do paredão para dentro do lago
    w.player.reset((LAKE_X0 - 2) * TILE, 32 * TILE);
    w.cameraSnap();
    let wasSwimming = false;
    let suited = false;
    let out = false;
    for (let f = 0; f < 60 * 40 && !out; f++) {
      ctl.moveX = 1;
      // braçadas ritmadas; perto da margem, sobe e salta para fora
      const press = f % 18 === 0;
      ctl.jump.pressed = press;
      ctl.jump.held = press || f % 18 < 6;
      w.update(1 / 60, ctl);
      if (w.player.swimming) wasSwimming = true;
      if (w.player.suitOn) suited = true;
      if (w.player.x > LAKE_X1 * TILE + 40 && w.player.body.onGround && !w.player.swimming) out = true;
    }
    expect(wasSwimming).toBe(true);
    expect(suited).toBe(true);
    expect(out).toBe(true);
    progress.equippedSkin = 'classic';
    progress.ownedSkins.length = 0;
  });

  it('nadando o Karimbo afunda devagar (sem a gravidade de terra)', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    w.player.reset((LAKE_X0 + 36) * TILE, (LAKE_TOP + 4) * TILE);
    for (let f = 0; f < 30; f++) w.update(1 / 60, ctl);
    expect(w.player.swimming).toBe(true);
    expect(w.player.body.vy).toBeLessThan(80);
    expect(w.player.body.vy).toBeGreaterThan(-1);
  });

  it('no pântano anda mais devagar', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    const swamp = data.water.find((z) => z.kind === 'swamp')!;
    w.player.reset(swamp.x + 3 * TILE, 33 * TILE);
    ctl.moveX = 1;
    for (let f = 0; f < 30; f++) w.update(1 / 60, ctl);
    expect(w.water.wadeDepth(w.player.x, w.player.feetY)).toBeGreaterThan(10);
    expect(Math.abs(w.player.body.vx)).toBeLessThan(RUN * 0.8);
  });

  it('peixes nunca saem da água e só ficam em pedra quando passam por trás dela', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    expect(w.water.fish.length).toBeGreaterThan(20);
    w.player.reset((LAKE_X0 + 36) * TILE, (LAKE_TOP + 4) * TILE);
    w.cameraSnap();
    for (let f = 0; f < 60 * 12; f++) {
      ctl.moveX = Math.sin(f / 50);
      w.update(1 / 60, ctl);
    }
    const bad = w.water.fish.filter((f) => {
      const z = f.zone;
      return f.x < z.x || f.x > z.x + z.w || f.y < z.y || f.y > z.y + z.h || (w.level.solidAtPx(f.x, f.y) && f.depth < 0.5); // pedra só atrás (afastado da câmera)
    });
    expect(bad.length).toBe(0);
  });
});

describe('Fase 2 (selva): cipós', () => {
  it('apoio central tem 192px, acrescentando um tile seguro em cada lado',()=>{
    const w=jungleWorld();
    expect(GORGE_ISLAND).toEqual([351,357]);
    for(let col=351;col<357;col++)expect(w.level.solidAtPx((col+.5)*TILE,(G-.5)*TILE)).toBe(true);
    for(const col of [350,357])expect(w.level.solidAtPx((col+.5)*TILE,(G-.5)*TILE)).toBe(false);
    expect(w.data.vines!.filter(v=>v.x>GORGE_X0*TILE&&v.x<GORGE_X1*TILE)).toHaveLength(4);
  });
  it('o desfiladeiro NÃO dá para atravessar só pulando/planando', () => {
    const res = analyzeReach(data);
    expect(res.reached.has(res.key(GORGE_ISLAND[0] + 1, G - 1))).toBe(false);
    expect(res.reached.has(res.key(GORGE_X1 + 1, G))).toBe(false);
  });

  it('balançando nos cipós (e planando entre eles) o Karimbo atravessa o desfiladeiro', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    w.player.reset((GORGE_X0 - 3) * TILE, G * TILE);
    w.cameraSnap();
    let grabs = 0;
    let was = false;
    let crossed = false;
    for (let f = 0; f < 60 * 40 && !crossed; f++) {
      const p = w.player;
      ctl.jump.pressed = false;
      if (p.vine) {
        const v = p.vine;
        ctl.moveX = v.av >= 0 ? 1 : -1;
        ctl.jump.held = false;
        if (v.a > 0.62 && v.av > 0.4) ctl.jump.pressed = ctl.jump.held = true;
      } else if (p.body.onGround) {
        ctl.moveX = 1;
        ctl.jump.held = false;
        if (w.level.groundBelow(p.x + 34, p.feetY - 10, 60) === null) ctl.jump.pressed = ctl.jump.held = true;
      } else {
        ctl.moveX = 1;
        if (p.body.vy > 60 && !p.glide && p.glideFuel > 0.5) ctl.jump.pressed = true;
        ctl.jump.held = ctl.jump.held || ctl.jump.pressed;
      }
      w.update(1 / 60, ctl);
      if (!!w.player.vine !== was) {
        was = !!w.player.vine;
        if (was) grabs++;
      }
      if (w.player.x > (GORGE_X1 + 1) * TILE && w.player.body.onGround) crossed = true;
    }
    expect(grabs).toBeGreaterThanOrEqual(2);
    expect(w.stats.pitFalls).toBe(0);
    expect(crossed).toBe(true);
  });
});

describe('Fase 2 (selva): templo', () => {
  it('↑ na porta do topo da pirâmide leva ao interior; a saída fica ao lado da entrada', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    w.player.reset(TEMPLE_DOOR_IN[0] * TILE + 16, TEMPLE_DOOR_IN[1] * TILE);
    for (let f = 0; f < 10; f++) w.update(1 / 60, ctl);
    expect(w.doorNear?.kind).toBe('in');
    ctl.moveY = -1;
    for (let f = 0; f < 60; f++) w.update(1 / 60, ctl);
    ctl.moveY = 0;
    expect(w.player.x).toBeGreaterThan(TEMPLE_X0 * TILE);
    expect(w.player.x).toBeLessThan(TEMPLE_X1 * TILE);
    expect(w.inRoom()).toBe(true);
    // lá dentro nenhum checkpoint/arena/fim de fase dispara (eles ficam do lado de fora)
    const idx = w.checkpointIdx;
    for (let f = 0; f < 120; f++) w.update(1 / 60, ctl);
    expect(w.checkpointIdx).toBe(idx);
    expect(w.finished).toBe(false);
    expect(Math.abs(TEMPLE_DOOR_OUT[0] - TEMPLE_DOOR_IN[0])).toBeLessThan(16);
  });

  it('a masmorra é grande (3 andares) e, trecho a trecho, leva da entrada até a porta de saída', () => {
    const inn = data.doors.find((d) => d.kind === 'in')!;
    const out = data.doors.find((d) => d.kind === 'out')!;
    expect(data.rooms[0].h).toBeGreaterThan(30 * TILE);
    expect(data.vines.filter((v) => v.x < TEMPLE_X1 * TILE).length).toBeGreaterThanOrEqual(9);
    // os poços de cipós não entram no validador (ele só pula): parte de depois de cada um
    const after = [[49, 14], [121, 14], [95, 28], [17, 28], [72, 45]].map(([x, r]) => ({ x: x * TILE + 16, y: r * TILE }));
    // só o caminho de dentro da masmorra (sem atravessar a porta de saída para a selva toda)
    const res = analyzeReach(data, [{ x: inn.tx, y: inn.ty }, ...after], { noDoors: true });
    expect(res.reached.has(res.key(Math.floor(out.x / TILE), Math.round(out.y / TILE)))).toBe(true);
  });
});

describe('Fase 2 (selva): areia movediça', () => {
  it('parado no pântano o Karimbo afunda; pulando várias vezes ele se solta', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    const swamp = data.water.find((z) => z.kind === 'swamp')!;
    w.player.reset(swamp.x + 5 * TILE, 33 * TILE);
    for (let f = 0; f < 120; f++) w.update(1 / 60, ctl);
    expect(w.player.sink).toBeGreaterThan(8);
    expect(w.player.sink).toBeLessThan(SINK_MAX);
    // insiste nos pulos até sair do poço
    let out = false;
    for (let f = 0; f < 60 * 6 && !out; f++) {
      ctl.moveX = 1;
      // só aperta com os pés na lama (no ar, apertar de novo seria o planeio)
      ctl.jump.pressed = w.player.body.onGround && f % 8 === 0;
      ctl.jump.held = true;
      w.update(1 / 60, ctl);
      if (w.player.feetY <= 32 * TILE + 1 && w.player.body.onGround) out = true;
    }
    expect(out).toBe(true);
  });

  it.each([30, 60])('escapa quase totalmente enterrado com um toque curto por segundo a %i Hz, sem invencibilidade', (fps) => {
    const w = jungleWorld();
    w.invulnerable = false;
    w.enemies = [];
    const ctl = newCtl();
    const swamp = data.water.find((z) => z.kind === 'swamp')!;
    w.player.reset(swamp.x + swamp.w - 3 * TILE, 33 * TILE);
    w.update(1 / fps, ctl);
    w.player.sink = SINK_MAX - 1;
    let out = false;
    for (let f = 0; f < fps * 8 && !out; f++) {
      ctl.moveX = 1;
      ctl.jump.pressed = f % fps === 0;
      ctl.jump.held = ctl.jump.pressed;
      w.update(1 / fps, ctl);
      out = w.player.x >= swamp.x + swamp.w && w.player.body.onGround;
    }
    expect(out).toBe(true);
    expect(w.player.hp).toBeGreaterThan(0);
    expect(w.stats.deaths).toBe(0);
    expect(w.player.sink).toBe(0);
  });

  it('dá tempo de reagir, mas ficar parado continua perigoso', () => {
    const w = jungleWorld();
    w.invulnerable = false;
    w.enemies = [];
    const ctl = newCtl();
    const swamp = data.water.find((z) => z.kind === 'swamp')!;
    w.player.reset(swamp.x + 5 * TILE, 33 * TILE);
    for (let f = 0; f < 60 * 5; f++) w.update(1 / 60, ctl);
    expect(w.player.hp).toBeGreaterThan(0);
    expect(w.stats.deaths).toBe(0);
    expect(w.player.sink).toBeGreaterThan(30);
    for (let f = 0; f < 60 * 4 && w.player.mode !== 'dead'; f++) w.update(1 / 60, ctl);
    expect(w.player.mode).toBe('dead');
    expect(w.stats.deaths).toBe(1);
  });

  it('aceita o esforço para se desenterrar mesmo durante a reação a dano', () => {
    const w = jungleWorld();
    w.invulnerable = false;
    w.enemies = [];
    const ctl = newCtl();
    const swamp = data.water.find((z) => z.kind === 'swamp')!;
    w.player.reset(swamp.x + 5 * TILE, 33 * TILE);
    w.update(1 / 60, ctl);
    w.player.sink = SINK_MAX - 1;
    w.player.hurtT = 0.2;
    ctl.jump.pressed = true;
    w.update(1 / 60, ctl);
    expect(w.player.sink).toBeLessThan(40);
    expect(w.player.hp).toBeGreaterThan(0);
    expect(w.stats.deaths).toBe(0);
  });
});

describe('Queda perto dos cipós', () => {
  it('preserva um ponto seguro anterior e restaura o checkpoint sem fechar o retorno', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    const idx = w.data.checkpoints.findIndex(c => c.name === 'Desfiladeiro');
    const cp = w.data.checkpoints[idx];
    w.checkpointIdx = idx;
    w.blockBehind(idx, false);
    const old = { x: cp.x - 8 * TILE, y: cp.y };
    expect(w.isSafeSpot(old.x, old.y)).toBe(true);
    const recovered = w.findSafeSpot(old.x, old.y)!;
    expect(recovered).not.toBeNull();
    expect(recovered.x - w.player.body.w / 2).toBeGreaterThan(w.blockX + 30);
    w.player.lastSafe = old;
    w.player.body.y = w.deathY() + 100;
    w.player.update(w, 1 / 60, ctl);
    expect(w.player.x).toBe(old.x);
    const loaded = jungleWorld();
    applySave(loaded, JSON.parse(JSON.stringify(captureSave(w))));
    expect(loaded.checkpointIdx).toBe(idx);
    expect(loaded.player.x - loaded.player.body.w / 2).toBeGreaterThan(loaded.blockX + 30);
    const blockBefore = loaded.blockX;
    loaded.blockBehind(idx + 1, false);
    expect(loaded.blockX).toBe(blockBefore);
    loaded.respawn();
    expect(loaded.player.x - loaded.player.body.w / 2).toBeGreaterThan(loaded.blockX + 30);
  });

  it('atualiza a recuperação de queda ao atravessar o checkpoint no ar, mantendo retorno livre', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    const idx = w.data.checkpoints.findIndex(c => c.name === 'Desfiladeiro');
    const cp = w.data.checkpoints[idx];
    w.checkpointIdx = idx - 1;
    w.player.reset(cp.x - 6 * TILE, cp.y);
    w.player.body.x = cp.x + 16;
    w.player.body.y = cp.y - 100;
    w.director.update(1 / 60, ctl);
    expect(w.checkpointIdx).toBe(idx);
    expect(w.blockX).toBe(-Infinity);
    expect(w.player.lastSafe.x).toBeGreaterThanOrEqual(cp.x);
    w.player.body.x = (GORGE_X0 + 4) * TILE;
    w.player.body.y = w.deathY() + 100;
    w.player.update(w, 1 / 60, ctl);
    expect(w.stats.pitFalls).toBe(1);
    expect(w.player.x).toBeGreaterThanOrEqual(cp.x);
    expect(w.player.x - w.player.body.w / 2).toBeGreaterThan(w.blockX + 30);
    ctl.moveX = 1;
    for (let f = 0; f < 15; f++) w.player.update(w, 1 / 60, ctl);
    expect(w.player.x).toBeGreaterThan(cp.x + 20);
  });
});

describe('Save-state', () => {
  it('captura o checkpoint e restaura tudo num jogo novo', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    const cp = data.checkpoints[1];
    w.player.reset(cp.x - 20, cp.y);
    ctl.moveX = 1;
    for (let f = 0; f < 40; f++) w.update(1 / 60, ctl);
    expect(w.checkpointIdx).toBeGreaterThanOrEqual(1);
    w.score = 1234;
    w.tokens = 17;
    const s = JSON.parse(JSON.stringify(captureSave(w)));
    const w2 = jungleWorld();
    applySave(w2, s);
    expect(w2.checkpointIdx).toBe(w.checkpointIdx);
    expect(w2.score).toBe(1234);
    expect(w2.tokens).toBe(17);
    expect(Math.abs(w2.player.x - data.checkpoints[w.checkpointIdx].x)).toBeLessThan(40);
    expect(w2.player.weapons.get('pistol')).toBe(Infinity);
  });
});

describe('Fase 2 (selva): sala do ritmo', () => {
  it('tambor é trampolim: pisou, quica bem mais alto que o pulo e o tambor toca', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    const d = data.drums[0];
    w.player.reset(d.x, d.y - 40);
    let minVy = 0;
    for (let f = 0; f < 40; f++) {
      w.update(1 / 60, ctl);
      minVy = Math.min(minVy, w.player.body.vy);
    }
    expect(minVy).toBeLessThan(-700);
    expect(data.drums.length).toBeGreaterThanOrEqual(4);
  });

  it('pegar todas as notas toca a música inteira e solta o tesouro', () => {
    const w = jungleWorld();
    const ctl = newCtl();
    const room = data.secretRooms.find((s) => s.id === 'ritmo')!.rect;
    w.player.reset(room.x + 64, room.y + room.h);
    for (let f = 0; f < 5; f++) w.update(1 / 60, ctl);
    expect(w.rhythm.active).toBe(true);
    const notes = w.pickups.filter((p) => p.kind === 'note');
    // cada nota aparece duas vezes (volta logo depois de pega)
    expect(w.rhythm.total).toBe(notes.length * 2);
    expect(notes.length).toBeGreaterThanOrEqual(10);
    for (const n of notes) {
      w.collect(n);
      n.alive = false;
    }
    expect(w.rhythm.done).toBe(false);
    w.player.invuln = 99;
    for (let f = 0; f < 100; f++) w.update(1 / 60, ctl);
    const again = w.pickups.filter((p) => p.kind === 'note' && p.alive);
    expect(again.length).toBe(notes.length);
    const before = w.pickups.length;
    for (const n of again) {
      w.collect(n);
      n.alive = false;
    }
    expect(w.rhythm.done).toBe(true);
    expect(w.pickups.length).toBeGreaterThan(before);
  });
});

describe('Fase 1: pista de neon (boate secreta)', () => {
  it('existe, tem porta na calçada, pista sem lasers de dano e notas duplas', async () => {
    const { buildLevel } = await import('../src/game/level/index');
    const d = buildLevel();
    const room = d.rooms.find((r) => r.kind === 'club')!;
    expect(room).toBeTruthy();
    expect(d.beams).toEqual([]);
    expect(d.drums.filter((x) => x.style === 'speaker').length).toBeGreaterThanOrEqual(3);
    const w = new World(d);
    w.invulnerable = true;
    const ctl = newCtl();
    const inn = d.doors.find((x) => x.kind === 'in' && x.tx > room.x && x.tx < room.x + room.w)!;
    w.player.reset(inn.x, inn.y);
    for (let f = 0; f < 10; f++) w.update(1 / 60, ctl);
    ctl.moveY = -1;
    for (let f = 0; f < 60; f++) w.update(1 / 60, ctl);
    ctl.moveY = 0;
    expect(w.inRoom()).toBe(true);
    for (let f = 0; f < 5; f++) w.update(1 / 60, ctl);
    expect(w.rhythm.active).toBe(true);
    expect(w.rhythm.club).toBe(true);
    for (let f = 0; f < 120; f++) w.update(1 / 60, ctl);
    expect(w.beamOn.every(x => !x)).toBe(true);
    // a saída leva de volta para a rua, mais adiante
    const out = d.doors.find((x) => x.kind === 'out' && x.x > room.x && x.x < room.x + room.w)!;
    expect(out.tx).toBeGreaterThan(inn.x);
  });
});
