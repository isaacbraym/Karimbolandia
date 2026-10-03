/** Small, curated cast: one model per habitat, no world searches or spawn churn in the frame loop. */
import type { LevelData } from './level';
import type { World } from './world';
import type { Rect } from '../core/math';
import { drawHabitat, drawCrocodile } from '../art/wildlife';
import { drawCityAnimal, type CityAnimal } from '../art/cityFauna';
import { AmbientReaction, wildlifeNoiseRadius } from './ambientReaction';
import type { SfxName } from '../core/audio';

export const CROCODILE_DAMAGE = 36; // Enemy shotgun volley: 5 × 6.
export type HabitatKind = 'eggs' | 'bird' | 'hive' | 'snake' | 'marmoset' | 'capuchin';
export interface Habitat { kind: HabitatKind; x: number; y: number; side: number; reaction?:AmbientReaction }

/** SAT: actual rotated upper jaw, rather than a tall damage box above the entire animal. */
function touchesJaw(h: Rect, c: Crocodile) {
  const angle = -c.open * 0.92, cos = Math.cos(angle), sin = Math.sin(angle);
  const x = c.x + c.facing * (15 + 49 * cos + 4.5 * sin);
  const y = c.y - 13 + 49 * sin - 4.5 * cos;
  const dx = h.x + h.w / 2 - x, dy = h.y + h.h / 2 - y;
  const ux = c.facing * cos, uy = sin, vx = -c.facing * sin, vy = cos;
  const hw = h.w / 2, hh = h.h / 2;
  return Math.abs(dx) <= hw + Math.abs(ux) * 55 + Math.abs(vx) * 18
    && Math.abs(dy) <= hh + Math.abs(uy) * 55 + Math.abs(vy) * 18
    && Math.abs(dx * ux + dy * uy) <= 55 + hw * Math.abs(ux) + hh * Math.abs(uy)
    && Math.abs(dx * vx + dy * vy) <= 18 + hw * Math.abs(vx) + hh * Math.abs(vy);
}

export class Crocodile {
  open = 0;
  bite = 0;
  cooldown = 0;
  facing = 1;
  constructor(readonly x: number, readonly y: number) {}
  reset() { this.open = this.bite = this.cooldown = 0; this.facing = 1; }
  update(w: World, dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.bite = Math.max(0, this.bite - dt);
    const p = w.player;
    const dx = p.x - this.x;
    // Deliberately no vertical range limit: a vine or a very high jump still attracts it.
    const above = Math.abs(dx) < 122 && p.feetY <= this.y + 20 && p.targetable;
    if (this.bite === 0 && Math.abs(dx) > 24) this.facing = dx < 0 ? -1 : 1;
    const target = this.bite > 0 ? 0 : above && this.cooldown === 0 ? 1 : 0;
    this.open += Math.max(-dt * 5, Math.min(dt * 3.5, target - this.open));
    if (!p.targetable || p.isDashing || p.invuln > 0 || this.cooldown > 0) return;
    const h = p.hitbox;
    // Physical body and jaws only. Passing far above never causes remote damage.
    const bodyContact = h.x + h.w >= this.x - 112 && h.x <= this.x + 112 && h.y + h.h >= this.y - 23 && h.y <= this.y + 22;
    if (!bodyContact && !touchesJaw(h, this)) return;
    this.bite = 0.26;
    this.cooldown = 2.1;
    p.hit(w, CROCODILE_DAMAGE, Math.sign(dx) || this.facing, { kx: 225, ky: -300 });
    w.fx.popup(p.x, p.y - 65, 'MORDIDA!', '#f7cc7f', 10);
    w.audio('crocBite', 0.65, this.x);
  }
}

export class JungleWildlife {
  readonly habitats: Habitat[] = [];
  readonly cityAnimals: CityAnimal[] = [];
  readonly crocodile: Crocodile | null;
  constructor(data: LevelData) {
    if (data.stage !== 2) {
      this.crocodile = null;
      const roofs = data.decos.filter(d => d.kind === 'facade').sort((a,b) => a.x-b.x);
      let lastX = -Infinity;
      const kinds: CityAnimal['kind'][] = ['cat', 'owl', 'courier'];
      for (const roof of roofs) {
        if (roof.x < data.playerStart.x + 1200 || roof.x - lastX < 2800 || this.cityAnimals.length >= 9) continue;
        const kind=kinds[this.cityAnimals.length % 3];
        this.cityAnimals.push({ kind, x: roof.x + 18, y: roof.y - 192 * (roof.scale ?? 1) * 1.35, seed: Math.floor(roof.x), reaction:kind==='courier'?undefined:new AmbientReaction(kind) });
        lastX = roof.x;
      }
      return;
    }
    const swamp = data.water.find(z => z.kind === 'swamp');
    this.crocodile = swamp ? new Crocodile(swamp.x + swamp.w * 0.52, swamp.y - 7) : null;
    const trees = data.decos.filter(d => d.kind === 'jTree' && d.x >= data.playerStart.x);
    // Deliberately placed along the route, rather than stamped on every tree.
    const targets: [HabitatKind, number, number][] = [
      ['eggs', 450, 1], ['bird', 2350, -1], ['hive', 4750, 1],
      ['snake', 7200, -1], ['marmoset', 10400, 1], ['capuchin', 14300, -1],
    ];
    const used = new Set<number>();
    for (const [kind, offset, side] of targets) {
      let best = -1, dist = Infinity;
      for (let i = 0; i < trees.length; i++) {
        const d = Math.abs(trees[i].x - data.playerStart.x - offset);
        if (!used.has(i) && this.habitats.every(h => Math.abs(h.x - trees[i].x) >= 1500) && d < dist) { best = i; dist = d; }
      }
      if (best < 0) continue;
      used.add(best);
      const tree = trees[best];
      this.habitats.push({ kind, x: tree.x, y: tree.y - (kind === 'hive' ? 160 : 128), side, reaction:kind==='bird'?new AmbientReaction('bird'):undefined });
    }
  }
  reset() {
    this.crocodile?.reset();
    for(const a of this.cityAnimals)a.reaction?.reset();
    for(const h of this.habitats)h.reaction?.reset();
  }
  hear(name:SfxName,x:number,volume:number) {
    const radius=wildlifeNoiseRadius(name);
    if(!radius||!Number.isFinite(x)||!Number.isFinite(volume)||volume<=0)return;
    const range=radius*Math.min(1,volume);
    for(const a of this.cityAnimals)if(a.reaction&&Math.abs(a.x-x)<=range)a.reaction.trigger(x,a.x);
    for(const h of this.habitats)if(h.reaction){
      const home=h.x+77*h.side;
      if(Math.abs(home-x)<=range)h.reaction.trigger(x,home);
    }
  }
  update(w: World, dt: number) {
    for(const a of this.cityAnimals)a.reaction?.update(dt);
    for(const h of this.habitats)h.reaction?.update(dt);
    const c = this.crocodile;
    if (c && Math.abs(w.player.x - c.x) < 1500) c.update(w, dt);
  }
  drawTrees(g: CanvasRenderingContext2D, w: World) {
    for (const a of this.cityAnimals) if (w.camera.visible(a.x+(a.reaction?.dx??0), a.y+(a.reaction?.dy??0), 100)) drawCityAnimal(g, a, w.time);
    for (const h of this.habitats) {
      if (w.camera.visible(h.x, h.y, 280)) drawHabitat(g, h, w.time);
    }
  }
  drawCroc(g: CanvasRenderingContext2D, w: World) {
    const c = this.crocodile;
    if (c && w.camera.visible(c.x, c.y, 150)) drawCrocodile(g, c, w.time);
  }
}
