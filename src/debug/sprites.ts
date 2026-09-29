/** Visualizador de arte (dev): abra /?debug=sprites */
import { loadPhotos, bakeKarimboHeads } from '../art/photo';
import { bakeKarimbo, drawKarimbo, type KState } from '../art/karimbo';
import type { WeaponId } from '../game/weapons';

export async function runSpriteDebug(base: string) {
  document.body.style.background = '#20143d';
  const cv = document.getElementById('game') as HTMLCanvasElement;
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;background:#20143d';
  const photos = await loadPhotos(base);
  const heads = bakeKarimboHeads(photos, 3);
  const art = bakeKarimbo(heads);
  const g = cv.getContext('2d')!;
  const W = (cv.width = 1400);
  const H = (cv.height = 800);
  const states: KState[] = ['idle', 'run', 'jump', 'fall', 'glide', 'crouch', 'hurt'];
  const weapons: WeaponId[] = ['pistol', 'rifle', 'shotgun', 'launcher', 'energy'];
  let t = 0;
  const q = new URLSearchParams(location.search);
  const single = q.get('single');
  const loop = () => {
    t += 0.016;
    if (single) {
      g.fillStyle = '#20143d';
      g.fillRect(0, 0, W, H);
      const st = single as KState;
      g.save();
      g.translate(W / 2, H - 60);
      g.scale(11, 11);
      drawKarimbo(g, art, 0, 0, {
        facing: 1, state: st, t: q.has('freeze') ? 0.3 : t, runPhase: t * 12, speed01: 1, aim: 0, weapon: 'pistol', kick: 0,
        flash: false, earGlide: st === 'glide' ? 1 : 0, vy: 60, alpha: 1, hasGun: true, scarf: t * 8,
      });
      g.restore();
      requestAnimationFrame(loop);
      return;
    }
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#20143d';
    g.fillRect(0, 0, W, H);
    // linha de chão
    g.fillStyle = '#3b2a6b';
    g.fillRect(0, 380, W, 8);
    const sc = 4;
    states.forEach((st, i) => {
      g.save();
      g.translate(90 + i * 190, 380);
      g.scale(sc, sc);
      drawKarimbo(g, art, 0, 0, {
        facing: 1, state: st, t, runPhase: t * 12, speed01: 1, aim: 0, weapon: weapons[i % 5], kick: (Math.sin(t * 8) + 1) / 2,
        flash: false, earGlide: st === 'glide' ? 1 : 0, vy: 50, alpha: 1, hasGun: true, scarf: t * 8,
      });
      g.restore();
    });
    // facing left + mira pra cima
    g.save();
    g.translate(150, 760);
    g.scale(sc, sc);
    drawKarimbo(g, art, 0, 0, {
      facing: -1, state: 'idle', t, runPhase: 0, speed01: 0, aim: -Math.PI / 2 - 0.4, weapon: 'rifle', kick: 0,
      flash: false, earGlide: 0, vy: 0, alpha: 1, hasGun: true, scarf: t * 4,
    });
    g.restore();
    // glide crescendo
    for (let i = 0; i < 5; i++) {
      g.save();
      g.translate(420 + i * 170, 760);
      g.scale(sc, sc);
      drawKarimbo(g, art, 0, 0, {
        facing: 1, state: 'glide', t, runPhase: 0, speed01: 0, aim: 0, weapon: 'pistol', kick: 0,
        flash: false, earGlide: i / 4, vy: 60, alpha: 1, hasGun: true, scarf: t * 8,
      });
      g.restore();
    }
    // cabeça grande (frontal e perspectiva)
    g.drawImage(art.heads.front.c, 1150, 400, art.heads.front.c.width / 1.2, art.heads.front.c.height / 1.2);
    g.drawImage(art.heads.right.c, 1150 + 260, 400, art.heads.right.c.width / 1.2, art.heads.right.c.height / 1.2);
    g.drawImage(art.heads.portrait.c, 1250, 700);
    requestAnimationFrame(loop);
  };
  loop();
}
