/** Descobertas opcionais. Acrescenta entidades depois das antigas, preservando IDs de save. */
import { T, TILE } from '../level';
import { G, type LevelBuilder } from './builder';

const WIDTH = 26, TOP = 35, FLOOR = 44;

function entryFree(b: LevelBuilder, col: number) {
  const x = b.px(col), L = b.level;
  // Conserva o tutorial de entrega e o corredor do drone no traçado original.
  if (b.stage === 1 && (col - 18 < 52 || (col - 18 < 112 && col + 8 > 98))) return false;
  if (b.water.some(w => x > w.x - 240 && x < w.x + w.w + 240)) return false;
  if (b.arenas.some(a => x - 570 < a.rect.x + a.rect.w + 120 && x + 265 > a.rect.x - 120)) return false;
  if (b.doors.some(d => Math.abs(d.x - x) < 440 && d.y <= G * TILE)) return false;
  if (b.props.some(p => Math.abs(p.x - x) < 120 && p.y <= G * TILE)) return false;
  if (b.decos.some(d => ['jHut', 'villageHome', 'shopFront', 'kiosk'].includes(d.kind)
    && d.x > x - 620 && d.x < x + 310)) return false;
  if (b.checkpoints.some(c => Math.abs(c.x - x) < 100)) return false;
  if (b.civilians.some(c => c.x > x - 610 && c.x < x + 235)) return false;
  // O volume completo deve estar em terra firme: a pintura não fecha lagos nem abismos.
  for (let c = col - 18; c <= col + 8; c++) {
    if (L.get(c, G) !== T.SOLID) return false;
    for (let r = 0; r < G; r++) if (L.get(c, r) === T.SOLID) return false;
  }
  for (let c = col - 3; c <= col + 3; c++) {
    if (L.get(c, G) !== T.SOLID) return false;
    for (let r = G - 5; r < G; r++) if (L.get(c, r) !== T.EMPTY) return false;
  }
  return true;
}

function roomFree(b: LevelBuilder, col: number) {
  const x = col * TILE;
  if (b.rooms.some(r => x < r.x + r.w + TILE && x + WIDTH * TILE > r.x - TILE)) return false;
  if (b.secretRooms.some(r => x < r.rect.x + r.rect.w + TILE && x + WIDTH * TILE > r.rect.x - TILE)) return false;
  if (b.water.some(w => x < w.x + w.w && x + WIDTH * TILE > w.x)) return false;
  for (let c = col - 1; c <= col + WIDTH; c++) for (let r = TOP - 1; r <= FLOOR; r++) {
    if (b.level.get(c, r) !== T.SOLID) return false;
  }
  return true;
}

/** Portais no pé do morro, jamais dentro do volume sólido ou em cima de uma água. */
export function addSecretPassages(b: LevelBuilder) {
  const forest = b.stage === 2;
  const specs = forest ? [
    { near: 584, style: 0, id: 'jungle:lost-time', title: 'RELÓGIO DA MATA', clue: 'O relógio parou. A floresta continuou crescendo.' },
    { near: 1360, style: 1, id: 'jungle:root-vault', title: 'REFÚGIO DAS RAÍZES', clue: 'Alguém deixou sementes para quem encontrar este lugar.' },
  ] : [
    { near: 88, style: 2, id: 'city:old-station', title: 'ESTAÇÃO ESQUECIDA', clue: 'O último trem levou a pressa. As moedas ficaram.' },
    { near: 310, style: 3, id: 'city:roof-garden', title: 'JARDIM DA RESISTÊNCIA', clue: 'Mesmo durante o ataque, alguém cuida das plantas.' },
  ];
  for (const spec of specs) {
    let entry = -1;
    // Distância crescente: não muda arbitrariamente de bairro entre builds.
    for (let d = 0; d < 125 && entry < 0; d++) for (const c of d ? [spec.near + d, spec.near - d] : [spec.near]) {
      if (c > (forest ? 168 : 20) && c < b.level.w - 40 && entryFree(b, c)) { entry = c; break; }
    }
    let room = -1;
    for (let c = forest ? 155 : 24; c < b.level.w - WIDTH - 2 && room < 0; c++) if (roomFree(b, c)) room = c;
    if (entry < 0 || room < 0) throw new Error(`Sem lugar seguro para a passagem ${spec.id}`);
    const x = b.px(entry), y = G * TILE;
    b.level.mounds.push({ x, y, forest });
    // Entidades antigas conservam IDs, assentadas sobre a nova superfície em vez de enterradas.
    for (const s of [...b.props, ...b.enemies, ...b.pickups]) {
      if (s.x < x - 550 || s.x > x + 175 || s.y < y - 64 || s.y > y + 1) continue;
      // Patrulhas em plataformas mantêm seu apoio; só reposiciona quem pisava na trilha.
      if (b.enemies.includes(s as typeof b.enemies[number])
        && Math.abs(s.y - (b.level.reliefSurface(s.x) ?? y)) > 10) continue;
      const surface = b.level.moundSurface(s.x);
      if (surface !== null) s.y += surface - (b.level.reliefSurface(s.x) ?? y);
    }
    for (const d of b.decos) {
      if (!['jFern', 'jBush', 'jRock', 'plant', 'streetTree'].includes(d.kind)
        || d.x < x - 550 || d.x > x + 175 || d.y < y - 64 || d.y > y + 1) continue;
      const surface = b.level.moundSurface(d.x);
      if (surface !== null) d.y += surface - (b.level.reliefSurface(d.x) ?? y);
    }
    if (forest) b.level.scenicGroves.push({ x0: x - 650, x1: x + 450 });
    // Pequena soleira nivelada, ligada à trilha por uma transição suave.
    for (let c = entry - 4; c <= entry + 5; c++) {
      const distance = Math.abs(c - entry - .5);
      b.level.relief[c] *= Math.min(1, Math.max(0, (distance - 2.5) / 2));
    }
    b.clear(room, TOP, WIDTH, FLOOR - TOP);
    const zone = { x: room * TILE, y: TOP * TILE, w: WIDTH * TILE, h: (FLOOR - TOP) * TILE,
      kind: 'passage' as const, passage: { id: spec.id, title: spec.title, clue: spec.clue, style: spec.style } };
    b.rooms.push(zone);
    b.camZones.unshift({ rect: { ...zone }, zoom: .95 });
    b.secretRoom(spec.id, room, TOP, WIDTH, FLOOR - TOP);
    b.door(entry, G, room + 3, FLOOR, 'in');
    // Retorno na própria entrada e saída no fundo: explorar nunca prende o jogador.
    b.door(room + 3, FLOOR, entry, G, 'out');
    b.door(room + WIDTH - 3, FLOOR, entry, G, 'out');
    b.tokens(room + 7, FLOOR - 1, 12);
    b.decos.push({ kind: 'passageMound', x, y, layer: 'back', variant: spec.style });
    b.decos.push({ kind: 'passageRoom', x: zone.x, y: FLOOR * TILE, layer: 'back', variant: spec.style });
    b.decos.push({ kind: 'passageExit', x: b.px(room + 3), y: FLOOR * TILE, layer: 'back', variant: spec.style });
    b.decos.push({ kind: 'passageExit', x: b.px(room + WIDTH - 3), y: FLOOR * TILE, layer: 'back', variant: spec.style });
    // Clareira em torno do portal; não remove construções, habitantes ou decoração distante.
    b.decos = b.decos.filter(d => d.kind.startsWith('passage') || d.y > y + TILE
      || Math.abs(d.x - x) > 210 || !['facade', 'crateStack', 'jTree', 'jBush', 'jRock', 'jFern', 'streetTree', 'plant'].includes(d.kind));
    if (forest) {
      b.decos.push({ kind: 'jFern', x: x - 98, y, layer: 'front', scale: .6 });
      b.decos.push({ kind: 'jFern', x: x + 108, y, layer: 'front', scale: .7 });
    } else {
      b.decos.push({ kind: 'plant', x: x + 120, y, layer: 'back', scale: .75 });
      b.decos.push({ kind: 'bench', x: x + 235, y, layer: 'back' });
    }
    // Pista discreta levando até a abertura, independente dos desafios da rota principal.
    for (const dx of [-3, -2, 2, 3]) b.pickup('token', entry + dx, G - 1);
  }
}
