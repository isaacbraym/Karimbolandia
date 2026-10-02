import { T, TILE, THEME } from '../level';
import { G } from './builder';
import type { LevelBuilder } from './builder';

/**
 * Suprimentos espalhados pela fase: CORAÇÕES (vida) bem visíveis, caixas de munição e
 * cápsulas de arma no caminho. Cada item é posto sobre a superfície mais próxima abaixo de `from`.
 */
export function addSupplies(b: LevelBuilder) {
  const L = b.level;
  const surf = (x: number, from: number): number | null => {
    for (let y = from; y < L.h; y++) {
      const t = L.get(x, y);
      if (t === T.SOLID || t === T.ONEWAY) return y;
    }
    return null;
  };
  const put = (kind: 'health' | 'healthBig' | 'ammo' | 'nade' | 'launcher' | 'energy', x: number, from: number) => {
    const s = surf(x, x >= 1176 && from === 26 ? 8 : from); // telhado final fica bem mais alto
    if (s === null) return;
    b.pickup(kind, x, s - 1);
  };

  // Vida com critério: poucos corações fixos (recompensa/alívio após combates duros),
  // o resto vem de caixas sorteadas e de drops adaptativos (mais vida quando o jogador está ferido).
  for (const x of [118, 232, 336, 480, 592, 690, 802, 925, 1076]) put('health', x, 26);
  // corações grandes (+80): só perto de checkpoints
  for (const x of [217, 415, 598, 786, 1001, 1098]) put('healthBig', x, 26);
  // elevados (recompensa por explorar)
  put('health', 262, 20);
  put('health', 636, 22);
  put('health', 1134, 19);
  put('health', 1166, 15);
  put('health', 1128, 34); // no chão de segurança da torre (presente para quem cai)
  // telhado final: preparo para o chefe
  put('health', 1204, 8);
  put('healthBig', 1183, 8);

  // munição para TODAS as armas
  for (const x of [60, 130, 200, 260, 320, 382, 490, 566, 620, 680, 730, 790, 850, 900, 990, 1082, 1200, 1250]) put('ammo', x, 26);
  put('ammo', 1140, 34);
  // granadas
  for (const x of [250, 380, 660, 940, 1100]) put('nade', x, 26);
  // armas raras em cápsulas visíveis, no caminho
  put('launcher', 422, 26);
  put('energy', 903, 26);
}

/**
 * Alturas ao alcance do pulo: plataformas que ficavam 4–5 tiles acima do chão de onde se pula
 * (inalcançáveis sem planar) descem para 3 tiles, levando junto o que está em cima delas
 * (moedas, caixas, inimigos, decoração). Paredes sólidas de 4 tiles ganham um degrau no meio.
 */
export function easeClimbs(b: LevelBuilder) {
  const L = b.level;
  const standable = (x: number, y: number) => {
    const t = L.get(x, y);
    return (t === T.SOLID || t === T.ONEWAY) && L.get(x, y - 1) !== T.SOLID && L.get(x, y - 2) !== T.SOLID;
  };
  // 1) plataformas one-way altas demais (várias passadas: escadinhas descem em cadeia)
  for (let pass = 0; pass < 3; pass++) lowerPass(b, standable);
  stepWalls(b);
}

function lowerPass(b: LevelBuilder, standable: (x: number, y: number) => boolean) {
  const L = b.level;
  const runs: { x0: number; x1: number; y: number; rise: number }[] = [];
  for (let y = 1; y < L.h; y++) {
    let x = 0;
    while (x < L.w) {
      if (L.get(x, y) !== T.ONEWAY) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < L.w && L.get(x, y) === T.ONEWAY) x++;
      const x1 = x - 1;
      let rise = 99;
      for (let sx = x0 - 4; sx <= x1 + 4; sx++) {
        for (let sy = y + 1; sy < Math.min(L.h, y + 12); sy++) {
          if (standable(sx, sy)) {
            rise = Math.min(rise, sy - y);
            break;
          }
        }
      }
      if (rise === 4 || rise === 5) runs.push({ x0, x1, y, rise });
    }
  }
  for (const r of runs) {
    const d = r.rise - 3;
    const ny = r.y + d;
    let free = true;
    for (let x = r.x0; x <= r.x1 && free; x++) for (let y = r.y + 1; y <= ny; y++) if (L.get(x, y) !== T.EMPTY) free = false;
    if (!free) continue;
    const theme = L.theme[r.y * L.w + r.x0];
    for (let x = r.x0; x <= r.x1; x++) {
      L.set(x, r.y, T.EMPTY, 0);
      L.set(x, ny, T.ONEWAY, theme);
    }
    // o que estava apoiado em cima acompanha
    const px0 = r.x0 * TILE - 8;
    const px1 = (r.x1 + 1) * TILE + 8;
    const on = (x: number, y: number) => x >= px0 && x <= px1 && y <= r.y * TILE + 2 && y >= (r.y - 4) * TILE;
    const dy = d * TILE;
    for (const p of b.pickups) if (on(p.x, p.y)) p.y += dy;
    for (const p of b.props) if (on(p.x, p.y)) p.y += dy;
    for (const e of b.enemies) if (!e.arena && on(e.x, e.y) && e.type !== 'drone' && e.type !== 'jetpack') e.y += dy;
    for (const dc of b.decos) if (on(dc.x, dc.y)) dc.y += dy;
  }
}

function stepWalls(b: LevelBuilder) {
  const L = b.level;
  // 2) paredes sólidas de 4 tiles: degrau one-way na metade, do lado de baixo
  const top = (x: number) => {
    for (let y = 1; y < L.h; y++) if (L.get(x, y) === T.SOLID && L.get(x, y - 1) !== T.SOLID) return y;
    return -1;
  };
  for (let x = 2; x < L.w - 1; x++) {
    const a = top(x);
    const c = top(x + 1);
    if (a < 0 || c < 0 || a - c < 4 || a - c > 5) continue;
    const sy = a - 2;
    if (L.get(x, sy) === T.EMPTY && L.get(x - 1, sy) === T.EMPTY) {
      L.set(x - 1, sy, T.ONEWAY, L.theme[a * L.w + x]);
      L.set(x, sy, T.ONEWAY, L.theme[a * L.w + x]);
    }
  }
}

/** Rolo-Bombas espalhados pela fase (sempre sobre chão, longe dos checkpoints). */
export function addRollers(b: LevelBuilder) {
  const L = b.level;
  for (const x of [148, 206, 336, 402, 504, 712, 764, 826, 934, 1062, 1096, 1150]) {
    for (let y = 22; y < L.h - 1; y++) {
      const t = L.get(x, y);
      if (t === T.SOLID || t === T.ONEWAY) {
        if (L.get(x, y - 1) === T.EMPTY && L.get(x, y - 2) === T.EMPTY) b.enemy('roller', x, y, { facing: -1 });
        break;
      }
    }
  }
}

/**
 * Moradores da cidade (coordenadas ORIGINAIS, chão principal): reagem à chegada do Karimbo.
 * Só em chão sólido, fora de arenas, buracos, do trecho das hordas do Nômad e da arena do chefe.
 */
export function addCivilians(b: LevelBuilder) {
  // rua inicial: a cidade recebe o herói
  b.civilian(9, G, { mood: 'cheer' });
  b.civilian(17, G, { mood: 'help' });
  b.civilian(21, G, { mood: 'cheer', facing: -1 });
  // primeiros soldados: moradores fogem quando o tiroteio começa
  b.civilian(115, G, { mood: 'flee', facing: 1 });
  b.civilian(120, G, { mood: 'flee', facing: 1 });
  // checkpoint da rua principal: medo e pedido de ajuda
  b.civilian(210, G, { mood: 'scared' });
  b.civilian(214, G, { mood: 'help', kneel: true });
  // depois da emboscada (zona de guerra limpa): comemoração
  b.civilian(474, G, { mood: 'cheer' });
  b.civilian(480, G, { mood: 'cheer', facing: -1 });
  b.civilian(482, G, { mood: 'cheer' });
  // base da torre: a Júlia foi levada lá para cima
  b.civilian(1097, G, { mood: 'help' });
  b.civilian(1101, G, { mood: 'help', kneel: true });
  b.civilian(1104, G, { mood: 'scared' });
  // telhado: últimos pedidos antes do Felipão
  b.civilian(1185, 14, { mood: 'help' });
  b.civilian(1278, 14, { mood: 'scared' });
  b.civilian(1281, 14, { mood: 'help', kneel: true });
}

/**
 * Guindastes: algumas plataformas suspensas (não todas) viram vigas de aço penduradas por cabos
 * num guindaste da obra — só visual (a plataforma continua igual), para dar vida à cidade.
 */
export function addCranes(b: LevelBuilder) {
  const L = b.level;
  let n = 0;
  for (let ty = 8; ty < G - 2; ty++) {
    let tx = 1;
    while (tx < L.w - 1) {
      if (L.get(tx, ty) !== T.ONEWAY || L.get(tx - 1, ty) === T.ONEWAY) {
        tx++;
        continue;
      }
      let e = tx;
      while (L.get(e, ty) === T.ONEWAY) e++;
      const w = e - tx;
      // vão livre em volta (nada logo acima/abaixo) e longe de outras plataformas
      let free = w >= 3 && w <= 8;
      for (let x = tx - 1; x <= e && free; x++) {
        for (let k = 1; k <= 5; k++) if (L.get(x, ty - k) !== T.EMPTY) free = false;
        for (let k = 1; k <= 2; k++) if (L.get(x, ty + k) !== T.EMPTY) free = false;
      }
      if (free && n++ % 3 === 1) {
        for (let x = tx; x < e; x++) L.set(x, ty, T.ONEWAY, THEME.STEEL);
        b.deco('crane' + w, (tx + e) / 2 - 0.5, ty, 'back');
      }
      tx = e;
    }
  }
}
