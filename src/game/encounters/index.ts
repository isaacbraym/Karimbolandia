import type { World } from '../world';
import { collectCoin } from '../../core/skins';
import { drawTrail } from '../../art/encounters';
import { encounterCatalog, escortCatalog } from './catalog';
import { TRAIL, TrailChallenge } from './challenge';
import { DroneEscort, ESCORT } from './escort';
import { drawEscort, drawEscortPrompt } from '../../art/escort';
import type { LevelData } from '../level';

/** Adapter: pure challenges own their rules; World only delegates lifecycle calls. */
export class Encounters {
  readonly trails: TrailChallenge[];
  readonly escorts: DroneEscort[];
  readonly completed = new Set<string>();
  constructor(data: LevelData) {
    this.trails = encounterCatalog(data).map(def => new TrailChallenge(def));
    this.escorts = escortCatalog(data).map(def => new DroneEscort(def));
  }
  reset(fresh = false) {
    if (fresh) this.completed.clear();
    for (const trail of this.trails) trail.reset(this.completed.has(trail.def.id));
    for (const escort of this.escorts) escort.reset(this.completed.has(escort.def.id));
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
      if (flags & TRAIL.COMPLETE) this.reward(w, trail.def.id, trail.def.title, trail.def.coins);
      if (flags & TRAIL.EXPIRED) w.hooks.onBanner?.('O TEMPO ACABOU', 'Volte ao primeiro aro para tentar de novo', 2.4);
    }
    for (const e of this.escorts) {
      if (!eligible || e.def.start.x < w.blockX) { e.suspend(); continue; }
      if (e.status === 'ready' && Math.abs(p.x - e.def.start.x) > 900) { e.suspend(); continue; }
      const flags = e.update(dt, { x: p.x, feetY: p.feetY, grounded: p.body.onGround, speed: p.body.vx });
      if (flags & ESCORT.REPAIRED) {
        w.audio('checkpoint', .55, e.drone.x);
        w.hooks.onBanner?.('DRONE RECUPERADO!', `Acompanhe o voo até a base • +${e.def.coins} moedas`, 2.6);
      }
      if (flags & ESCORT.LOST) w.hooks.onBanner?.('O DRONE PERDEU O SINAL', 'Ele voltou ao ponto de reparo. Você pode tentar novamente.', 2.6);
      if (flags & ESCORT.COMPLETE) this.reward(w, e.def.id, 'CARGA DEVOLVIDA!', e.def.coins);
    }
  }
  private reward(w: World, id: string, title: string, coins: number) {
    if (this.completed.has(id)) return;
    this.completed.add(id);
    for (let i = 0; i < coins; i++) collectCoin();
    w.tokens += coins; w.score += 250 + coins * 10;
    w.audio('secret', .75, w.player.x);
    w.fx.popup(w.player.x, w.player.y - 54, `+${coins} MOEDAS!`, '#ffe27a', 12);
    w.hooks.onBanner?.('DESAFIO CONCLUÍDO!', title, 2.3);
    w.hooks.onProgress?.();
  }
  draw(g: CanvasRenderingContext2D, w: World) {
    if (w.inRoom()) return;
    for (const trail of this.trails) {
      if (trail.status === 'complete' || trail.def.points[0].x < w.blockX) continue;
      drawTrail(g, trail, w.time, (x, y) => w.camera.visible(x, y, 120));
    }
    for (const escort of this.escorts) {
      if (escort.def.start.x < w.blockX) continue;
      drawEscort(g, escort, w.time, (x, y) => w.camera.visible(x, y, 140));
    }
  }
  drawPrompts(g: CanvasRenderingContext2D, w: World) {
    if (w.inRoom() || w.player.mode !== 'foot' || w.player.lockInput || w.director.cine) return;
    for (const e of this.escorts) {
      if (e.def.start.x < w.blockX) continue;
      drawEscortPrompt(g, e, (x, y) => w.camera.visible(x, y, 140));
    }
  }
}
