/**
 * Vegetação de rio e partículas fixas do lago e de Atlântida (só decoração: nenhuma colisão, item,
 * entrada ou ID muda). Chamado NO FIM de `buildAtlantis`, então a ordem dos spawns antigos fica.
 * A arte está em `art/lake/lakeFlora.ts`; os kinds novos começam com `lk`.
 */
import { Rng } from '../../core/math';
import { T } from '../level';
import type { LevelBuilder } from './builder';
import { ABYSS_FLOOR, DEEP_TOP, DEEP_X0, DEEP_X1, FENDA, LAKE_FLOOR, LAKE_TOP, LAKE_X0, LAKE_X1 } from './atlantis';

/** Tipos animados (balançam): usados também pelo teste de teto de plantas visíveis. */
export const ANIMATED_LAKE_KINDS = ['lkVallis', 'lkCabomba', 'lkAguape', 'lkGlow', 'uKelp', 'uGrass'] as const;

/** Faixas (colunas) onde a vegetação não entra: estátua, relíquias, baús e passagens estreitas. */
const KEEP_CLEAR: [number, number][] = [[511, 526], [542, 547], [551, 555], [571, 575], [593, 597], [598, 602], [605, 609], [506, 510], [465, 469]];
const blocked = (x: number) => KEEP_CLEAR.some(([a, b]) => x >= a && x <= b);

export function decorateLake(b: LevelBuilder, seabed: (x: number) => number) {
  const L = b.level;
  const r = new Rng(2026);

  // ---------------------------------------------------------------- lago raso (rio amazônico)
  // topo do leito de cada coluna do lago raso (fora da fenda, que desce para Atlântida)
  const shallowFloor = (x: number): number | null => {
    if (x >= FENDA[0] - 1 && x <= FENDA[1]) return null;
    for (let y = LAKE_TOP + 2; y < LAKE_FLOOR + 4; y++) if (L.get(x, y) === T.SOLID) return y;
    return null;
  };
  let n = 0;
  for (let x = LAKE_X0 + 4; x < LAKE_X1 - 3; x += r.int(3, 5)) {
    const top = shallowFloor(x);
    if (top === null) continue;
    const kinds = ['lkVallis', 'lkCabomba', 'lkSagit', 'lkVallis', 'lkPebbles', 'lkCabomba'] as const;
    b.deco(kinds[n++ % kinds.length], x, top, 'back', { flip: r.chance(0.5), scale: r.range(0.85, 1.2) });
  }
  // troncos submersos com musgo
  for (const x of [498, 531]) {
    const top = shallowFloor(x);
    if (top !== null) b.deco('lkLog', x, top, 'back', { flip: x % 2 === 0 });
  }
  // aguapés flutuando na superfície, com raízes penduradas
  for (const x of [479, 486, 497, 508, 519, 531, 541]) b.deco('lkAguape', x, LAKE_TOP, 'back', { scale: r.range(0.8, 1.1), flip: r.chance(0.5) });
  // raízes de igapó descendo das margens
  b.deco('lkRoot', LAKE_X0 + 1, LAKE_TOP, 'back', { scale: 0.9 });
  b.deco('lkRoot', LAKE_X1 - 2, LAKE_TOP, 'back', { scale: 1.1, flip: true });
  b.deco('lkRoot', LAKE_X0 + 38, LAKE_TOP, 'back', { scale: 0.8 });
  // primeiro plano desfocado (marca do jogo): poucos e baixos, longe de moedas e passagens
  for (const [x, par] of [[484, 0.26], [514, 0.3], [540, 0.28]] as [number, number][]) b.deco('lkFgWeed', x, LAKE_FLOOR + 2, 'front', { par, scale: 0.55, flip: x % 2 === 0 });

  // ---------------------------------------------------------------- Atlântida (no breu)
  for (let x = DEEP_X0 + 6; x < DEEP_X1 - 4; x += r.int(5, 8)) {
    if (blocked(x)) continue;
    const floor = seabed(x);
    if (floor >= ABYSS_FLOOR + 2 || L.get(x, floor - 1) !== T.EMPTY) continue;
    const pick = r.next();
    if (pick < 0.4) b.deco('lkGlow', x, floor, 'back', { scale: r.range(0.8, 1.15), flip: r.chance(0.5) });
    else if (pick < 0.62) b.deco('lkVallis', x, floor, 'back', { scale: r.range(0.8, 1), flip: r.chance(0.5) });
    else if (pick < 0.78) b.deco('lkSponge', x, floor, 'back', { flip: r.chance(0.5) });
    else if (pick < 0.9) b.deco('lkCabomba', x, floor, 'back', { scale: 0.9 });
    else b.deco('lkPebbles', x, floor, 'back');
  }
  // raízes de igapó caindo do teto da caverna (na borda esquerda e na câmara da direita)
  for (const x of [DEEP_X0 + 5, DEEP_X0 + 12, 482, 603, DEEP_X1 - 6]) {
    let y = DEEP_TOP - 3;
    while (y < DEEP_TOP + 14 && L.get(x, y) !== T.EMPTY) y++;
    b.deco('lkRoot', x, y, 'back', { scale: r.range(0.75, 1), flip: r.chance(0.5) });
  }
  // cortinas de bolhas nas fendas do leito
  for (const x of [500, 556, 612]) b.deco('uVentLine', x, seabed(x), 'back');
  // primeiro plano desfocado dentro da caverna
  for (const [x, par] of [[478, 0.25], [566, 0.27], [608, 0.3]] as [number, number][]) b.deco('lkFgWeed', x, seabed(x) + 1, 'front', { par, scale: 0.5, flip: x % 2 === 0 });
}
