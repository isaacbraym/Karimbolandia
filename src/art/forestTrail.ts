/** Clareira lateral: o contato físico fica DENTRO do piso, não na borda de uma faixa. */
import { Level, TILE, T, THEME } from '../game/level';
import { Rng } from '../core/math';
import { makeCanvas } from './kit';

const SPAN = 512, TOP = 180, HEIGHT = 520, DENSITY = 1.5;
interface Patch { back: HTMLCanvasElement; front: HTMLCanvasElement }

/** Só o chão seco da amostra. Plataformas, água, poços e o templo conservam sua arte. */
export function scenicGround(level: Level, tx: number, ty: number) {
  const range = level.scenicTrail;
  return !!range && tx * TILE >= range.x0 && tx * TILE < range.x1
    && ty >= level.reliefRow - 1 && level.get(tx, level.reliefRow) === T.SOLID
    && level.themeAt(tx, level.reliefRow) === THEME.EARTH;
}

export class ForestTrail {
  private readonly patches = new Map<number, Patch>();
  private revision = -1;
  constructor(private readonly level: Level) {}

  draw(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, front = false) {
    const L = this.level, range = L.scenicTrail;
    if (!range || y + h < L.reliefRow * TILE - TOP || y > L.reliefRow * TILE + HEIGHT - TOP) return;
    if (this.revision !== L.rev) { this.patches.clear(); this.revision = L.rev; }
    const a = Math.max(Math.floor(range.x0 / SPAN), Math.floor(x / SPAN));
    const b = Math.min(Math.floor((range.x1 - 1) / SPAN), Math.floor((x + w) / SPAN));
    // No máximo dois preparos por quadro; os passes reutilizam as mesmas imagens.
    let made = 0;
    for (let i = a; i <= b; i++) {
      let patch = this.patches.get(i);
      if (!patch && !front && made < 2) { patch = this.paint(i); this.patches.set(i, patch); made++; }
      if (patch) g.drawImage(front ? patch.front : patch.back, i * SPAN, L.reliefRow * TILE - TOP, SPAN, HEIGHT);
      else if (!front) {
        // Um viewport muito largo nunca fica sem chão enquanto o próximo bake espera.
        g.fillStyle = '#4b693e';
        for (let col = i * SPAN / TILE; col < (i + 1) * SPAN / TILE; col++) {
          if (!scenicGround(L, col, L.reliefRow)) continue;
          const top = this.surface(col * TILE + 16) - 50;
          g.fillRect(col * TILE, top, TILE + .5, L.reliefRow * TILE + HEIGHT - TOP - top);
        }
      }
    }
  }

  private surface(x: number) {
    const L = this.level;
    return L.reliefSurface(x) ?? L.groundBelow(x, (L.reliefRow - 2) * TILE) ?? L.reliefRow * TILE;
  }

  private paint(index: number): Patch {
    const L = this.level, worldX = index * SPAN, base = L.reliefRow * TILE;
    const back = makeCanvas(SPAN * DENSITY, HEIGHT * DENSITY), front = makeCanvas(SPAN * DENSITY, HEIGHT * DENSITY);
    const g = back.getContext('2d')!, f = front.getContext('2d')!;
    for (const ctx of [g, f]) { ctx.scale(DENSITY, DENSITY); ctx.translate(-worldX, TOP - base); ctx.lineCap = 'round'; }
    // Máscara segue a topologia: nenhuma clareira pinta água ou cobre um abismo.
    const mask = new Path2D();
    for (let col = Math.floor(worldX / TILE); col < Math.ceil((worldX + SPAN) / TILE); col++) {
      if (!scenicGround(L, col, L.reliefRow)) continue;
      const x = col * TILE;
      const backSurface = (xx: number) => {
        // A margem distante é uma colina contínua mesmo onde a rota tem um degrau.
        const col = Math.floor(xx / TILE - .5), blend = xx / TILE - .5 - col;
        return this.surface((col + .5) * TILE) * (1 - blend) + this.surface((col + 1.5) * TILE) * blend;
      };
      const a = backSurface(x + .01), b = backSurface(x + TILE - .01);
      const fringe = (xx: number) => 84 + Math.sin(xx * .011) * 17 + Math.sin(xx * .027) * 7;
      mask.moveTo(x, a - fringe(x)); mask.lineTo(x + TILE + .5, b - fringe(x + TILE));
      mask.lineTo(x + TILE + .5, base + HEIGHT - TOP); mask.lineTo(x, base + HEIGHT - TOP); mask.closePath();
    }
    g.clip(mask); f.clip(mask);
    const field = g.createLinearGradient(0, base - 120, 0, base + 280);
    field.addColorStop(0, '#526d40'); field.addColorStop(.28, '#61814a');
    field.addColorStop(.55, '#405a32'); field.addColorStop(1, '#142e26');
    g.fillStyle = field; g.fillRect(worldX, base - TOP, SPAN, HEIGHT);
    // Ondas de musgo em escala de paisagem, em vez de juntas de ladrilhos.
    for (let cell = Math.floor(worldX / 128) - 1; cell <= Math.ceil((worldX + SPAN) / 128); cell++) {
      const r = new Rng(cell * 7919 + 413);
      for (let i = 0; i < 24; i++) {
        const x = cell * 128 + r.range(0, 128), y = this.surface(x) + r.range(-65, 230);
        const light = r.chance(.36);
        g.fillStyle = light ? 'rgba(156,180,77,.11)' : 'rgba(14,41,29,.13)';
        g.beginPath(); g.ellipse(x, y, r.range(24, 105), r.range(5, 23), r.range(-.15, .15), 0, Math.PI * 2); g.fill();
      }
    }
    // Trilha de terra com bordas macias e curvas que atravessam a clareira.
    for (let stroke = 4; stroke >= 0; stroke--) {
      g.strokeStyle = ['rgba(173,154,99,.42)', 'rgba(132,122,73,.26)', 'rgba(109,109,62,.20)', 'rgba(110,117,63,.12)', 'rgba(123,133,67,.08)'][stroke];
      g.lineWidth = 22 + stroke * 11; g.beginPath();
      for (let x = worldX - 40; x <= worldX + SPAN + 40; x += 8) {
        const y = this.surface(x) + 7 + Math.sin(x * .0039) * 13;
        if (x === worldX - 40) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    // Pequenas pinceladas, sem padrões quadrados; tudo é assado uma vez.
    for (let cell = Math.floor(worldX / 128) - 1; cell <= Math.ceil((worldX + SPAN) / 128); cell++) {
      const r = new Rng(cell * 4621 + 91);
      for (let i = 0; i < 475; i++) {
        const x = cell * 128 + r.range(0, 128), y = this.surface(x) + r.range(-76, 280);
        const shade = r.int(0, 4);
        g.strokeStyle = ['rgba(184,192,103,.22)', 'rgba(109,155,74,.30)', 'rgba(32,64,34,.25)', 'rgba(142,158,89,.18)', 'rgba(195,181,125,.16)'][shade];
        g.lineWidth = r.range(.5, 2); g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + 2, y - r.range(1, 4), x + r.range(2, 9), y - r.range(0, 3)); g.stroke();
      }
    }
    // Raízes largas avançam do plano de trás e desaparecem no musgo.
    for (let cell = Math.floor(worldX / 256) - 1; cell <= Math.ceil((worldX + SPAN) / 256); cell++) {
      const r = new Rng(cell * 6841 + 819);
      const x = cell * 256 + r.range(0, 256), y = this.surface(x) - 52;
      for (let j = 0; j < 2; j++) {
        const end = x + r.range(-100, 100), ey = y + r.range(44, 92);
        g.fillStyle = 'rgba(43,57,32,.38)';
        g.beginPath();g.moveTo(x - 8, y);g.bezierCurveTo(x - 12,y + 27,end - 22,ey - 6,end,ey);
        g.bezierCurveTo(end - 13,ey + 2,x + 5,y + 35,x + 7,y);g.closePath();g.fill();
        g.strokeStyle = 'rgba(133,141,74,.30)'; g.lineWidth = 1.4;
        g.beginPath();g.moveTo(x,y + 4);g.bezierCurveTo(x - 5,y + 33,end - 22,ey - 3,end - 4,ey - 1);g.stroke();
      }
      this.bank(g, x, y + 28, r, .65);
    }
    // Pedras baixas e maciços escuros perto da câmera, longe do corpo e da mira.
    for (let cell = Math.floor(worldX / 128) - 1; cell <= Math.ceil((worldX + SPAN) / 128); cell++) {
      const r = new Rng(cell * 8713 + 933);
      for (let i = 0; i < 3; i++) {
        const x = cell * 128 + r.range(0, 128), y = this.surface(x) + r.range(80, 245);
        this.bank(g, x, y, r, r.range(.4, 1.1));
        if (i % 3 === 0) this.fern(f, x, y + 18, r.range(.55, 1.2), r);
      }
    }
    return { back, front };
  }

  private bank(g: CanvasRenderingContext2D, x: number, y: number, r: Rng, scale: number) {
    g.save(); g.translate(x, y); g.scale(scale, scale);
    g.fillStyle = 'rgba(10,30,22,.27)'; g.beginPath(); g.ellipse(3, 6, 51, 10, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 18; i++) {
      const px = r.range(-37, 37), py = r.range(-13, 4), size = r.range(5, 17);
      g.fillStyle = ['#3d5e32', '#527744', '#718944', '#8a9a50'][i % 4];
      g.beginPath(); g.ellipse(px, py, size, size * .4, -.3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(188,198,102,.23)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(px - size * .6, py - 1); g.quadraticCurveTo(px, py - size * .4, px + size * .6, py - 2); g.stroke();
    }
    g.restore();
  }

  private fern(g: CanvasRenderingContext2D, x: number, y: number, size: number, r: Rng) {
    g.save(); g.translate(x, y); g.scale(size, size);
    for (let stem = -2; stem <= 2; stem++) {
      const reach = stem * 15, high = 35 + r.range(0, 18) - Math.abs(stem) * 6;
      g.strokeStyle = '#244c39'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(reach * .25, -high, reach, -high); g.stroke();
      for (let leaf = 1; leaf < 9; leaf++) {
        const t = leaf / 9, px = reach * t * t, py = -high * (2 * t - t * t), wide = (1 - t) * 13 + 2;
        g.fillStyle = leaf % 2 ? '#305e40' : '#416f45';
        for (const dir of [-1, 1]) { g.beginPath(); g.ellipse(px + dir * wide * .45, py + 3, wide, 2.5, dir * .42, 0, Math.PI * 2); g.fill(); }
      }
    }
    g.restore();
  }
}

/** Lajes à frente da fachada. O topo coincide exatamente com a plataforma física. */
export function drawVillageRoofs(g: CanvasRenderingContext2D, level: Level, x: number, w: number) {
  for (const roof of level.roofs) {
    if (roof.x + roof.w + roof.depth < x || roof.x > x + w) continue;
    const left = roof.x, right = left + roof.w, y = roof.y, d = roof.depth;
    g.fillStyle = roof.color; g.beginPath(); g.moveTo(left, y); g.lineTo(right, y);
    g.lineTo(right + d, y - d * .52); g.lineTo(left + d, y - d * .52); g.closePath(); g.fill();
    g.fillStyle = '#614a32'; g.fillRect(left, y, roof.w, 7);
    g.strokeStyle = '#e4c88e'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(left, y); g.lineTo(right, y); g.stroke();
    g.strokeStyle = 'rgba(62,40,24,.3)'; g.lineWidth = 1;
    for (let xx = left + 12; xx < right; xx += roof.awning ? 12 : 18) {
      g.beginPath(); g.moveTo(xx, y); g.lineTo(xx + d, y - d * .52); g.stroke();
    }
    // Mãos francesas ligam a marquise à fachada.
    if (roof.awning) {
      g.strokeStyle = '#705740'; g.lineWidth = 4;
      for (const xx of [left + 9, right - 9]) { g.beginPath(); g.moveTo(xx, y + 6); g.lineTo(xx + 13, y + 22); g.stroke(); }
    }
  }
}
