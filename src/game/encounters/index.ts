import type { World } from '../world';
import { collectCoin } from '../../core/skins';
import { drawTrail } from '../../art/encounters';
import { encounterCatalog } from './catalog';
import { TRAIL, TrailChallenge } from './challenge';
import type { LevelData } from '../level';

/** Adapter: pure challenges own their rules; World only delegates lifecycle calls. */
export class Encounters {
  readonly trails: TrailChallenge[];
  readonly completed = new Set<string>();
  constructor(data: LevelData) { this.trails = encounterCatalog(data).map(def => new TrailChallenge(def)); }
  reset(fresh = false) {
    if (fresh) this.completed.clear();
    for (const trail of this.trails) trail.reset(this.completed.has(trail.def.id));
  }
  get active() { return this.trails.find(t => t.status === 'active'); }
  update(w: World, dt: number) {
    const p = w.player;
    const eligible = p.mode === 'foot' && !p.lockInput && !w.director.cine && !w.inRoom() && !w.finished;
    for (const trail of this.trails) {
      if (!eligible) { trail.suspend(); continue; }
      if (trail.status === 'complete') continue;
      if (trail.def.points[0].x < w.blockX) {
        if (trail.status !== 'ready') trail.reset();
        trail.suspend();
        continue;
      }
      if (trail.status === 'ready' && Math.abs(p.x - trail.def.points[0].x) > 900) { trail.suspend(); continue; }
      const flags = trail.update(dt, p.x, p.y);
      trail.animate(dt);
      if (flags & TRAIL.START) w.hooks.onBanner?.(trail.def.title, `Atravesse os ${trail.def.points.length} aros • ${trail.def.coins} moedas`, 2);
      if (flags & TRAIL.HIT) {
        w.audio('coin', .65, p.x);
        w.fx.sparks(p.x, p.y, 8, trail.def.theme === 'delivery' ? '#90eeff' : '#c3ff92', 120);
      }
      if (flags & TRAIL.COMPLETE && !this.completed.has(trail.def.id)) {
        this.completed.add(trail.def.id);
        for (let i = 0; i < trail.def.coins; i++) collectCoin();
        w.tokens += trail.def.coins;
        w.score += 250 + trail.def.coins * 10;
        w.audio('secret', .75, p.x);
        w.fx.popup(p.x, p.y - 54, `+${trail.def.coins} MOEDAS!`, '#ffe27a', 12);
        w.hooks.onBanner?.('DESAFIO CONCLUÍDO!', trail.def.title, 2.3);
        w.hooks.onProgress?.();
      }
      if (flags & TRAIL.EXPIRED) w.hooks.onBanner?.('O TEMPO ACABOU', 'Volte ao primeiro aro para tentar de novo', 2.4);
    }
  }
  draw(g: CanvasRenderingContext2D, w: World) {
    if (w.inRoom()) return;
    for (const trail of this.trails) {
      if (trail.status === 'complete' || trail.def.points[0].x < w.blockX) continue;
      drawTrail(g, trail, w.time, (x, y) => w.camera.visible(x, y, 120));
    }
  }
}
