/** Rua larga integrada à cidade: pintura assada, becos recuados e escombros próximos. */
import { Level, TILE, T, THEME } from '../game/level';
import { Rng } from '../core/math';
import { makeCanvas, softDot } from './kit';
import { windAt } from './wind';
import { CITY_BLOCKS, CITY_GARDENS } from '../game/level/cityScenery';

const SPAN = 512, TOP = 350, HEIGHT = 590, DENSITY = 1.25;
interface Patch { back: HTMLCanvasElement; front: HTMLCanvasElement }

/** Somente a rua base; degraus altos, plataformas e fossos continuam explícitos. */
export function cityGround(L: Level, tx: number, ty: number) {
  const r = L.scenicStreet;
  return !!r && tx * TILE >= r.x0 && tx * TILE < r.x1 && ty >= L.reliefRow && ty < L.reliefRow + 7
    && L.get(tx, L.reliefRow) === T.SOLID && L.get(tx, L.reliefRow - 1) !== T.SOLID
    && L.themeAt(tx, L.reliefRow) <= THEME.STEEL && L.themeAt(tx, ty) <= THEME.STEEL;
}

export class CityStreet {
  private patches = new Map<number, Patch>();
  private revision = -1;
  constructor(private readonly level: Level) {}

  draw(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, front = false) {
    const L = this.level, range = L.scenicStreet, base = L.reliefRow * TILE;
    if (!range || y + h < base - TOP || y > base + HEIGHT - TOP) return;
    if (this.revision !== L.rev) { this.patches.clear(); this.revision = L.rev; }
    const a = Math.max(Math.floor(range.x0 / SPAN), Math.floor(x / SPAN));
    const b = Math.min(Math.floor((range.x1 - 1) / SPAN), Math.floor((x + w) / SPAN));
    let made = 0;
    for (let i = a; i <= b; i++) {
      let p = this.patches.get(i);
      if (!p && !front && made < 2) { p = this.paint(i); this.patches.set(i, p); made++; }
      if (p) g.drawImage(front ? p.front : p.back, i * SPAN, base - TOP, SPAN, HEIGHT);
      else if (!front) {
        g.fillStyle = '#403c58';
        for (let c = i * 16; c < (i + 1) * 16; c++) if (cityGround(L, c, L.reliefRow)) g.fillRect(c * TILE, base - 60, TILE + .5, 300);
      }
    }
    if (!front) this.air(g, x, w, t);
  }

  private paint(index: number): Patch {
    const L = this.level, wx = index * SPAN, base = L.reliefRow * TILE;
    const back = makeCanvas(SPAN * DENSITY, HEIGHT * DENSITY), front = makeCanvas(SPAN * DENSITY, HEIGHT * DENSITY);
    const g = back.getContext('2d')!, f = front.getContext('2d')!;
    for (const c of [g, f]) { c.scale(DENSITY, DENSITY); c.translate(-wx, TOP - base); }
    // Mascara só o piso: um fosso continua aberto, mesmo com prédios atrás.
    g.save(); f.save(); const mask = new Path2D();
    for (let col = wx / TILE; col < (wx + SPAN) / TILE; col++) {
      if (!cityGround(L, col, L.reliefRow)) continue;
      const x = col * TILE;
      mask.rect(x, base - 128, TILE + .3, 368);
    }
    g.clip(mask); f.clip(mask);
    const road = g.createLinearGradient(0, base - 128, 0, base + 230);
    road.addColorStop(0, '#777c88'); road.addColorStop(.35, '#4b505c');
    road.addColorStop(.65, '#343945'); road.addColorStop(1, '#232835');
    g.fillStyle = road; g.fillRect(wx, base - 128, SPAN, 368);
    // A cobertura próxima da rua oculta a face do teto da balada vista do exterior.
    // Começa abaixo dos pés; o mundo suprime esse passe ao entrar no interior.
    f.fillStyle = road; f.fillRect(wx, base + 24, SPAN, 216);
    // Calçada larga, meio-fio em volume e sarjeta separada da faixa de caminhada.
    g.fillStyle = '#a5a8ad'; g.fillRect(wx, base - 128, SPAN, 107);
    g.fillStyle = '#646a75'; g.fillRect(wx, base - 21, SPAN, 8);
    g.fillStyle = '#d7d3ca'; g.fillRect(wx, base - 23, SPAN, 3);
    g.fillStyle = '#232936'; g.fillRect(wx, base - 12, SPAN, 4);
    g.strokeStyle = '#808691'; g.lineWidth = .8;
    for (let x = Math.floor(wx / 64) * 64; x < wx + SPAN; x += 64) {
      g.beginPath(); g.moveTo(x, base - 126); g.lineTo(x + 25, base - 24); g.stroke();
    }
    for (let cell = Math.floor(wx / 128) - 1; cell <= Math.ceil((wx + SPAN) / 128); cell++) {
      const r = new Rng(cell * 8191 + 937), x = cell * 128;
      g.fillStyle = '#c1b78b'; g.fillRect(x + 15, base + 80, 56, 3);
      if (cell % 4 === 2) { // bocas de lobo
        g.fillStyle = '#222b37'; g.fillRect(x + 35, base - 10, 35, 6);
        g.fillStyle = '#727e88'; for (let k = 0; k < 7; k++) g.fillRect(x + 37 + k * 5, base - 10, 1.5, 5);
      }
      for (let k = 0; k < 38; k++) {
        const px = x + r.range(0, 128), py = base + r.range(-34, 218);
        g.fillStyle = k % 2 ? 'rgba(221,207,187,.07)' : 'rgba(10,7,23,.12)';
        g.beginPath(); g.ellipse(px, py, r.range(1, 8), r.range(.4, 2), -.2, 0, Math.PI * 2); g.fill();
      }
      // Fissuras e reflexos fragmentados atravessam o asfalto.
      g.strokeStyle = 'rgba(18,15,30,.38)'; g.lineWidth = 1.3; g.beginPath();
      const crackY = base + r.range(28, 120);
      g.moveTo(x - r.range(0, 23), crackY); g.lineTo(x + r.range(10, 30), crackY - r.range(8, 24));
      g.lineTo(x + r.range(40, 65), crackY + r.range(0, 18)); g.lineTo(x + r.range(80, 110), crackY - r.range(12, 40)); g.stroke();
      if (cell % 3 === 1) {
        g.fillStyle = 'rgba(150,169,183,.13)'; g.beginPath();
        g.ellipse(x + 45, base + 68, 54, 8, -.08, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,197,123,.12)'; g.fillRect(x + 15, base + 63, 47, 1.5);
      }
    }
    // Reutiliza o asfalto texturizado no passe próximo, sem tapar os pés.
    f.drawImage(back, 0, (TOP + 24) * DENSITY, back.width, 216 * DENSITY, wx, base + 24, SPAN, 216);
    g.restore(); f.restore();
    // Pilares apoiados na calçada sustentam as lajes existentes, sem novas fachadas.
    for (let row = L.reliefRow - 8; row < L.reliefRow - 1; row++) {
      for (let col = Math.max(0, wx / TILE - 32); col < (wx + SPAN) / TILE; col++) {
        if (col * TILE >= L.scenicStreet!.x1 || L.get(col, row) !== T.ONEWAY || L.get(col - 1, row) === T.ONEWAY) continue;
        let end = col + 1; while (end < L.w && L.get(end, row) === T.ONEWAY) end++;
        if (end - col < 3 || end * TILE < wx) continue;
        const foot = base - 38, top = row * TILE + 6;
        for (const pole of [col + 0.4, end - 0.8]) {
          if (!cityGround(L, Math.floor(pole), L.reliefRow)) continue;
          g.fillStyle = '#555160'; g.fillRect(pole * TILE, top, 14, foot - top);
          g.fillStyle = '#b2b0ac'; g.fillRect(pole * TILE - 4, foot - 4, 22, 5);
        }
      }
    }
    // Construções vêm DEPOIS da calçada: suas bases nunca são apagadas pelo piso.
    for (const block of CITY_BLOCKS) {
      if (block.x + block.w + 30 < wx || block.x > wx + SPAN
        || !cityGround(L, Math.floor(Math.max(0, block.x) / TILE), L.reliefRow)
        || !cityGround(L, Math.floor((block.x + block.w) / TILE), L.reliefRow)) continue;
      this.building(g, block.x, base - 58, block.w, block.h, new Rng(block.x * 977 + 71), false);
      g.fillStyle = '#bbb7ae'; g.fillRect(block.x - 5, base - 58, block.w + 10, 5);
      g.fillStyle = 'rgba(18,21,31,.22)'; g.beginPath();
      g.ellipse(block.x + block.w / 2, base - 49, block.w * .58, 9, 0, 0, Math.PI * 2); g.fill();
    }
    // Canteiros em ilhas na calçada; árvores e bancos usam as mesmas posições no mapa.
    for (const x of CITY_GARDENS) {
      if (x + 75 < wx || x - 65 > wx + SPAN || !cityGround(L, Math.floor((x - 58) / TILE), L.reliefRow)
        || !cityGround(L, Math.floor((x + 59) / TILE), L.reliefRow)) continue;
      g.fillStyle = '#575f66'; g.beginPath(); g.roundRect(x - 58, base - 43, 118, 22, 8); g.fill();
      g.fillStyle = '#b4bbaf'; g.beginPath(); g.roundRect(x - 59, base - 48, 118, 12, 7); g.fill();
      g.fillStyle = '#425e46'; g.beginPath(); g.ellipse(x, base - 43, 50, 5, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 10; i++) {
        g.fillStyle = i % 2 ? '#769a62' : '#55784f'; g.beginPath();
        g.ellipse(x - 42 + i * 9, base - 42, 10, 7, 0, 0, Math.PI * 2); g.fill();
      }
    }
    // Lábios dos buracos continuam legíveis: não esconder perigo com arte de piso.
    for (let col = wx / TILE; col < (wx + SPAN) / TILE; col++) {
      if (!cityGround(L, col, L.reliefRow)) continue;
      for (const dir of [-1, 1]) if (L.get(col + dir, L.reliefRow) === T.EMPTY) {
        const edge = (col + (dir > 0 ? 1 : 0)) * TILE;
        g.fillStyle = '#aea19a'; g.fillRect(edge - (dir > 0 ? 9 : 0), base - 11, 9, 13);
        g.fillStyle = '#252133'; g.fillRect(edge - (dir > 0 ? 7 : 0), base + 2, 7, 67);
      }
    }
    return { back, front };
  }

  private building(g: CanvasRenderingContext2D, x: number, bottom: number, w: number, h: number, r: Rng, far: boolean) {
    const color = far ? '#49465e' : r.pick(['#55506b', '#655365', '#4d5c66', '#735b69']);
    g.fillStyle = '#242137'; g.fillRect(x + 19, bottom - h - 17, w, h + 17);
    const paint = g.createLinearGradient(x, bottom - h, x + w, bottom);
    paint.addColorStop(0, color); paint.addColorStop(1, far ? '#38364d' : '#343044');
    g.fillStyle = paint; g.fillRect(x, bottom - h, w, h);
    g.fillStyle = '#92909c'; g.fillRect(x - 3, bottom - h, w + 6, 5);
    for (let y = bottom - h + 22; y < bottom - 63; y += 48) {
      g.fillStyle = 'rgba(18,14,29,.25)'; g.fillRect(x, y + 35, w, 4);
      for (let xx = x + 17; xx < x + w - 20; xx += 42) {
        g.fillStyle = '#211e34'; g.fillRect(xx - 2, y - 2, 27, 31);
        g.fillStyle = far ? '#747082' : r.chance(.28) ? '#d9a479' : '#676779'; g.fillRect(xx, y, 22, 25);
        g.fillStyle = '#373247'; g.fillRect(xx + 10, y, 2, 25); g.fillRect(xx, y + 12, 22, 2);
        g.fillStyle = '#a6a0a1'; g.fillRect(xx - 3, y + 28, 30, 3);
      }
    }
    if (!far) {
      g.fillStyle = '#211d2e'; g.fillRect(x + 12, bottom - 53, w - 24, 53);
      g.fillStyle = '#5d7778'; g.fillRect(x + 16, bottom - 49, w - 32, 33);
      g.fillStyle = '#252235'; for (let xx = x + 18; xx < x + w - 20; xx += 19) g.fillRect(xx, bottom - 48, 3, 48);
      g.fillStyle = '#908078'; g.fillRect(x + 7, bottom - 63, w - 14, 10);
      // Feridas do ataque, com manchas e buracos de reboco em vez de fachadas limpas.
      for (let i = 0; i < 12; i++) {
        const px = x + r.range(8, w - 8), py = bottom - r.range(65, h - 14);
        g.fillStyle = 'rgba(20,15,27,.23)'; g.beginPath(); g.ellipse(px, py, r.range(3, 15), r.range(4, 22), .3, 0, Math.PI * 2); g.fill();
      }
    }
  }

  private air(g: CanvasRenderingContext2D, x: number, w: number, t: number) {
    const base = this.level.reliefRow * TILE, range = this.level.scenicStreet!;
    const smoke = softDot('#8f8799', 24);
    for (let cell = 0; cell < CITY_BLOCKS.length; cell++) {
      const block = CITY_BLOCKS[cell], bx = block.x + block.w / 2;
      if (bx + 180 < x || bx - 180 > x + w || bx >= range.x1
        || !cityGround(this.level, Math.floor(Math.max(0, block.x) / TILE), this.level.reliefRow)
        || !cityGround(this.level, Math.floor((block.x + block.w) / TILE), this.level.reliefRow)) continue;
      const wind = windAt(bx, t);
      for (let i = 0; i < 4; i++) {
        const ph = (t * .16 + i / 4 + cell * .17) % 1, size = 30 + ph * 68;
        g.globalAlpha = .23 * (1 - ph);
        g.drawImage(smoke.c, bx - size / 2 + wind * ph * 110, base - 58 - block.h - ph * 150, size, size * 1.3);
      }
      g.globalAlpha = 1;
      // Tecidos suspensos: fio firme, pontas soltas sob a mesma rajada.
      g.strokeStyle = '#292235'; g.lineWidth = 1.4; g.beginPath();
      const half = block.w / 2 - 15, wireY = base - 160;
      g.moveTo(bx - half, wireY); g.quadraticCurveTo(bx, wireY + 18, bx + half, wireY); g.stroke();
      for (let k = 0; k < 3; k++) {
        const u = (k + 1) / 4, v = u + .085;
        const px = bx - half + 2 * half * u;
        const py = wireY + 36 * u * (1 - u);
        const rightY = wireY + 36 * v * (1 - v);
        const flap = wind * 10 + Math.sin(t * 3.1 - k * .7 + cell) * 3;
        g.fillStyle = ['#887583', '#b59a82', '#6e8f95'][k % 3]; g.beginPath();
        g.moveTo(px, py); g.lineTo(px + 19, rightY); g.quadraticCurveTo(px + 23 + flap, py + 17, px + 18 + flap, py + 33);
        g.lineTo(px + flap, py + 30); g.quadraticCurveTo(px + flap * .4, py + 15, px, py); g.fill();
      }
      // Papéis leves atravessam o plano da rua; não afetam a simulação física.
      const ph = (t * .065 + cell * .23) % 1, px = bx - 180 + ph * 360 + wind * 18;
      g.save(); g.translate(px, base + 43 + Math.sin(t * 1.8 + cell) * 13);
      g.rotate(Math.sin(t * 2.2 + cell) * .45); g.fillStyle = '#b8a9a2'; g.fillRect(-4, -2, 8, 4); g.restore();
    }
  }
}
