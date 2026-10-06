/** Rua larga integrada à cidade: pintura assada, becos recuados e escombros próximos. */
import { Level, TILE, T, THEME } from '../game/level';
import { Rng } from '../core/math';
import { makeCanvas, softDot } from './kit';
import { windAt } from './wind';

const SPAN = 512, TOP = 480, HEIGHT = 720, DENSITY = 1.25;
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
    // Fachadas de dois planos, com intervalos irregulares e becos em perspectiva.
    for (let cell = Math.floor(wx / 256) - 2; cell <= Math.ceil((wx + SPAN) / 256) + 1; cell++) {
      if (cell * 256 < 0 || cell * 256 >= L.scenicStreet!.x1) continue;
      const r = new Rng(cell * 7919 + 771), bx = cell * 256 + r.range(-25, 20);
      const foot = base - r.range(83, 115), bw = r.range(170, 218), bh = r.range(225, 355);
      this.building(g, bx + 75, foot - 38, bw * .8, bh + 35, r, true);
      this.building(g, bx, foot, bw, bh, r, false);
      // Becos apontam para dentro do quarteirão, e não para uma parede plana.
      g.fillStyle = '#211d38'; g.beginPath();
      g.moveTo(bx + bw - 8, foot - 110); g.lineTo(bx + bw + 26, foot - 138);
      g.lineTo(bx + bw + 26, base - 30); g.lineTo(bx + bw + 94, base + 25);
      g.lineTo(bx + bw - 12, base + 35); g.closePath(); g.fill();
      g.strokeStyle = '#787184'; g.lineWidth = 2; g.beginPath();
      g.moveTo(bx + bw + 26, foot - 5); g.lineTo(bx + bw + 94, base + 25); g.stroke();
    }
    // Paredes recuadas sustentam os patamares existentes: lajes ligadas à arquitetura,
    // mantendo exatamente os mesmos tiles de mão única e a rua livre na frente.
    for (let row = L.reliefRow - 8; row < L.reliefRow - 1; row++) {
      for (let col = Math.max(0, wx / TILE - 32); col < (wx + SPAN) / TILE; col++) {
        if (col * TILE >= L.scenicStreet!.x1 || L.get(col, row) !== T.ONEWAY || L.get(col - 1, row) === T.ONEWAY) continue;
        let end = col + 1; while (end < L.w && L.get(end, row) === T.ONEWAY) end++;
        if (end - col < 3 || end * TILE < wx) continue;
        const foot = base - 38, top = row * TILE + 6;
        if (foot - top > 40) this.building(g, col * TILE, foot, (end - col) * TILE - 18, foot - top, new Rng(col * 977 + row), false);
      }
    }
    // Mascara só o piso: um fosso continua aberto, mesmo com prédios atrás.
    g.save(); f.save(); const mask = new Path2D();
    for (let col = wx / TILE; col < (wx + SPAN) / TILE; col++) {
      if (!cityGround(L, col, L.reliefRow)) continue;
      const x = col * TILE;
      mask.rect(x, base - 64, TILE + .3, 304);
    }
    g.clip(mask); f.clip(mask);
    const road = g.createLinearGradient(0, base - 64, 0, base + 230);
    road.addColorStop(0, '#777081'); road.addColorStop(.26, '#585469');
    road.addColorStop(.65, '#434052'); road.addColorStop(1, '#292637');
    g.fillStyle = road; g.fillRect(wx, base - 64, SPAN, 304);
    // A cobertura próxima da rua oculta a face do teto da balada vista do exterior.
    // Começa abaixo dos pés; o mundo suprime esse passe ao entrar no interior.
    f.fillStyle = road; f.fillRect(wx, base + 24, SPAN, 216);
    // Calçada recuada, sem riscar uma linha contínua na posição dos pés.
    g.fillStyle = '#979091'; g.beginPath(); g.moveTo(wx, base - 64);
    g.lineTo(wx + SPAN, base - 64);
    for (let x = wx + SPAN; x >= wx; x -= 8) g.lineTo(x, base - 44 + Math.sin(x * .006) * 12);
    g.closePath(); g.fill();
    for (let cell = Math.floor(wx / 128) - 1; cell <= Math.ceil((wx + SPAN) / 128); cell++) {
      const r = new Rng(cell * 8191 + 937), x = cell * 128;
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
      // Restos do ataque no plano próximo, longe do corpo e da mira.
      for (let k = 0; k < 4; k++) {
        const px = x + r.range(0, 128), py = base + r.range(125, 204), size = r.range(6, 17);
        f.fillStyle = '#222030'; f.beginPath(); f.ellipse(px, py + 4, size * 1.8, 5, -.2, 0, Math.PI * 2); f.fill();
        f.fillStyle = ['#46404c', '#65545a', '#565567'][k % 3]; f.beginPath();
        f.moveTo(px - size, py); f.lineTo(px - 5, py - size * .7); f.lineTo(px + size, py - size * .25); f.lineTo(px + size * .6, py + 4); f.closePath(); f.fill();
        f.strokeStyle = '#817078'; f.lineWidth = 1; f.stroke();
      }
    }
    g.restore(); f.restore();
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
    for (let cell = Math.max(0, Math.floor((x - 180) / 768)); cell * 768 < Math.min(x + w + 180, range.x1); cell++) {
      const bx = cell * 768 + 330, wind = windAt(bx, t);
      for (let i = 0; i < 4; i++) {
        const ph = (t * .16 + i / 4 + cell * .17) % 1, size = 30 + ph * 68;
        g.globalAlpha = .23 * (1 - ph);
        g.drawImage(smoke.c, bx - size / 2 + wind * ph * 110, base - 140 - ph * 210, size, size * 1.3);
      }
      g.globalAlpha = 1;
      // Tecidos suspensos: fio firme, pontas soltas sob a mesma rajada.
      g.strokeStyle = '#292235'; g.lineWidth = 1.4; g.beginPath();
      g.moveTo(bx - 110, base - 218); g.quadraticCurveTo(bx, base - 181, bx + 108, base - 235); g.stroke();
      for (let k = 0; k < 5; k++) {
        const u = (k + 1) / 6, v = u + .085;
        const px = bx - 110 * (1 - u) ** 2 + 108 * u * u;
        const py = base - 218 * (1 - u) ** 2 - 362 * u * (1 - u) - 235 * u * u;
        const rightY = base - 218 * (1 - v) ** 2 - 362 * v * (1 - v) - 235 * v * v;
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
