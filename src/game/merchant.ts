import type { LevelData, SecretRoom } from './level';
import type { World } from './world';
import { drawMerchant, type MerchantArt } from '../art/merchant';

/** Sivirino ocupa uma única oficina escondida, nunca o caminho dos checkpoints. */
export class Merchant {
  readonly spots: { x: number; y: number }[];
  readonly room: SecretRoom | undefined;
  private art: MerchantArt | undefined;

  constructor(data: LevelData) {
    this.room = data.secretRooms.find(r => r.id === (data.stage === 2 ? 'templo' : 'secret1'));
    const r = this.room?.rect;
    // Deixa livre a caixa e o ídolo do templo, à direita da oficina.
    const x = r ? r.x + r.w * (data.stage === 2 ? .3 : .45) : 0;
    const y = r ? data.level.groundBelow(x, r.y + r.h - 24) : null;
    this.spots = r && y != null ? [{ x, y }] : [];
  }

  near(w: World) {
    const r = this.room?.rect, p = w.player;
    return !!r && !p.mounted && !p.lockInput && p.mode === 'foot'
      && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
      && this.spots.some(s => Math.abs(s.x - p.x) < 100 && Math.abs(s.y - p.feetY) < 60);
  }

  draw(g: CanvasRenderingContext2D, w: World) {
    for (const spot of this.spots) {
      const interior = w.data.rooms.some(r => spot.x >= r.x && spot.x <= r.x + r.w && spot.y >= r.y && spot.y <= r.y + r.h);
      if (spot.x < w.blockX && !interior || !w.camera.visible(spot.x, spot.y - 45, 110)) continue;
      this.art = drawMerchant(g, this.art, spot.x, spot.y, w.time, this.near(w), w.data.stage === 2);
    }
  }
}
