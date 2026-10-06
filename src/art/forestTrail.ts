/** Clareira lateral: o contato físico fica DENTRO do piso, não na borda de uma faixa. */
import { Level, TILE, T, THEME } from '../game/level';
import { Rng } from '../core/math';
import { makeCanvas } from './kit';
import { windTip } from './wind';

const SPAN = 512, TOP = 180, HEIGHT = 520, DENSITY = 1.5;
interface Fern { x: number; y: number; size: number; variant: number }
interface Patch { back: HTMLCanvasElement; plants: Fern[] }

/** Só o chão seco da amostra. Plataformas, água, poços e o templo conservam sua arte. */
export function scenicGround(level: Level, tx: number, ty: number) {
  const range = level.scenicTrail;
  return ((!!range && tx * TILE >= range.x0 && tx * TILE < range.x1)
    || level.scenicGroves.some(r => tx * TILE >= r.x0 && tx * TILE < r.x1))
    && ty >= level.reliefRow - 1 && level.get(tx, level.reliefRow) === T.SOLID
    && (level.themeAt(tx, level.reliefRow) === THEME.EARTH
      || (level.themeAt(tx, level.reliefRow) === THEME.TEMPLE
        && level.scenicGroves.some(r => tx * TILE >= r.x0 && tx * TILE < r.x1)));
}

/** Perfil global suave: a curva e a largura não reiniciam nas bordas dos patches. */
export function trailProfile(level: Level, x: number) {
  const col = Math.floor(x / TILE), t = x / TILE - col;
  const value = (c: number) => level.relief[Math.max(0, Math.min(level.w, c))];
  const a = value(col - 1), b = value(col), c = value(col + 1), d = value(col + 2);
  const rise = .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  return { y: level.reliefRow * TILE - Math.max(0, rise) + 7 + Math.sin(x * .0039) * 13,
    width: 22 + Math.sin(x * .0157) * 5 + Math.sin(x * .0271 + 1.2) * 3 };
}

export class ForestTrail {
  private readonly patches = new Map<number, Patch>();
  private revision = -1;
  private readonly fernSprites: HTMLCanvasElement[] = [];
  constructor(private readonly level: Level) {}

  draw(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, front = false, time = 0) {
    const L = this.level, range = L.scenicTrail;
    if ((!range && !L.scenicGroves.length) || y + h < L.reliefRow * TILE - TOP || y > L.reliefRow * TILE + HEIGHT - TOP) return;
    if (this.revision !== L.rev) { this.patches.clear(); this.revision = L.rev; }
    const a = Math.max(0, Math.floor(x / SPAN));
    const b = Math.min(Math.ceil(L.pxW / SPAN) - 1, Math.floor((x + w) / SPAN));
    // No máximo dois preparos por quadro; os passes reutilizam as mesmas imagens.
    let made = 0;
    for (let i = a; i <= b; i++) {
      const start = i * SPAN, end = start + SPAN;
      if (!(range && range.x0 < end && range.x1 > start)
        && !L.scenicGroves.some(r => r.x0 < end && r.x1 > start)) continue;
      let patch = this.patches.get(i);
      if (!patch && !front && made < 2) { patch = this.paint(i); this.patches.set(i, patch); made++; }
      if (patch && !front) g.drawImage(patch.back, i * SPAN, L.reliefRow * TILE - TOP, SPAN, HEIGHT);
      else if (patch && front) {
        // Células vizinhas repetem os mesmos exemplares; recorte mantém continuidade entre patches.
        g.save(); g.beginPath(); g.rect(i * SPAN, L.reliefRow * TILE - TOP, SPAN, HEIGHT); g.clip();
        for (const plant of patch.plants) {
          if (!scenicGround(L, Math.floor(plant.x / TILE), L.reliefRow)) continue;
          g.save(); g.translate(plant.x, plant.y); g.scale(plant.size, plant.size);
          // Raiz fixa em y=0; imagem pequena pronta, sem novo bake na animação.
          g.transform(1, 0, -windTip('jFern', plant.x, time) / 70, 1, 0, 0);
          g.drawImage(this.fernSprites[plant.variant], -60, -78, 120, 84); g.restore();
        }
        g.restore();
      }
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
    const back = makeCanvas(SPAN * DENSITY, HEIGHT * DENSITY), plants: Fern[] = [];
    const g = back.getContext('2d')!;
    g.scale(DENSITY, DENSITY); g.translate(-worldX, TOP - base); g.lineCap = 'round';
    if (!this.fernSprites.length) for (let v = 0; v < 4; v++) {
      const image = makeCanvas(120 * DENSITY, 84 * DENSITY), ctx = image.getContext('2d')!;
      ctx.scale(DENSITY, DENSITY); this.fern(ctx, 60, 78, 1, new Rng(v * 977 + 13)); this.fernSprites.push(image);
    }
    // Máscara segue a topologia: nenhuma clareira pinta água ou cobre um abismo.
    const mask = new Path2D();
    for (let col = Math.floor(worldX / TILE); col < Math.ceil((worldX + SPAN) / TILE); col++) {
      if (!scenicGround(L, col, L.reliefRow)) continue;
      const x = col * TILE;
      const backSurface = (xx: number) => {
        const p = trailProfile(L, xx);
        return p.y - 7 - Math.sin(xx * .0039) * 13;
      };
      const fringe = (xx: number) => 84 + Math.sin(xx * .011) * 17 + Math.sin(xx * .027) * 7;
      mask.moveTo(x, backSurface(x) - fringe(x));
      for (let xx = x + 4; xx <= x + TILE; xx += 4) mask.lineTo(xx, backSurface(xx) - fringe(xx));
      mask.lineTo(x + TILE + .5, backSurface(x + TILE + .5) - fringe(x + TILE + .5));
      mask.lineTo(x + TILE + .5, base + HEIGHT - TOP); mask.lineTo(x, base + HEIGHT - TOP); mask.closePath();
    }
    g.clip(mask);
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
    for (let band = 4; band >= 0; band--) {
      g.fillStyle = ['rgba(173,154,99,.42)', 'rgba(132,122,73,.26)', 'rgba(109,109,62,.20)', 'rgba(110,117,63,.12)', 'rgba(123,133,67,.08)'][band];
      const left = worldX - 96, right = worldX + SPAN + 96, step = 8;
      g.beginPath();
      for (let side = -1; side <= 1; side += 2) {
        const from = side < 0 ? left : right, to = side < 0 ? right : left;
        for (let x = from; side < 0 ? x <= to : x >= to; x -= side * step) {
          const p = trailProfile(L, x), y = p.y + side * (p.width + band * 11) / 2;
          if (side < 0 && x === from) g.moveTo(x, y); else g.lineTo(x, y);
        }
      }
      g.closePath(); g.fill();
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
        if (i % 3 === 0) {
          plants.push({ x, y: y + 18, size: r.range(.55, 1.2), variant: Math.abs(cell) % 4 });
          for (let stem = 0; stem < 5; stem++) r.range(0, 18);
        }
      }
    }
    return { back, plants };
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
