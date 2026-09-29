/** Visualizador de arte (dev): abra /?debug=sprites */
import { loadPhotos, bakeKarimboHeads } from '../art/photo';
import { bakeKarimbo, drawKarimbo, type KState } from '../art/karimbo';
import type { WeaponId } from '../game/weapons';
import { bakeNomad, drawNomad } from '../art/nomad';
import { bakeFelipao, drawFelipao } from '../art/felipao';
import { bakeSoldier, drawSoldier, type SoldierStyle } from '../art/soldiers';
import { bakeRobots, drawDrone, drawTurret, drawHeavy, drawSpider, drawMiniMech } from '../art/robots';

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
  const view = q.get('view');
  if (view) {
    const nomad = bakeNomad(photos);
    const feli = bakeFelipao(photos);
    const styles: SoldierStyle[] = ['rifle', 'shotgun', 'shield', 'jetpack', 'sniper'];
    const soldiers = styles.map((st) => bakeSoldier(st));
    const robots = bakeRobots();
    const loop2 = () => {
      t += 0.016;
      g.fillStyle = '#2a1d56';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#3b2a6b';
      g.fillRect(0, 700, W, 100);
      if (view === 'nomad') {
        g.save();
        g.translate(300, 700);
        g.scale(6, 6);
        drawNomad(g, nomad, art.heads, 0, 0, { facing: 1, roll: t * 3, tilt: Math.sin(t) * 0.3, aim: 0, recoil: (Math.sin(t * 4) + 1) / 2, flash: false, t, vx: 200, vy: 0, onGround: true, dashing: 0, alpha: 1, hp01: 1, pilot: true, earFlap: 0.8, ready: true });
        g.restore();
        g.save();
        g.translate(800, 700);
        g.scale(6, 6);
        drawNomad(g, nomad, art.heads, 0, 0, { facing: -1, roll: t * 3, tilt: 0.2, aim: Math.PI, recoil: 0, flash: false, t, vx: -600, vy: 0, onGround: true, dashing: 1, alpha: 1, hp01: 1, pilot: true, earFlap: 1, ready: true });
        g.restore();
      } else if (view === 'feli') {
        for (let i = 0; i < 3; i++) {
          g.save();
          g.translate(220 + i * 420, 720);
          g.scale(2.6, 2.6);
          drawFelipao(g, feli, 0, 0, { facing: i === 1 ? -1 : 1, t, flash: false, alpha: 1, lean: 0, squashY: 1, aimL: -0.4, aimR: -0.4, charge: i === 1 ? 1 : 0, reactor: 0.5, phase: (i + 1) as 1 | 2 | 3, thrust: 0.4, rackOpen: i === 2 ? 1 : 0, hover: 10, taunt: 0, shake: 0, hp01: 1, kickL: 0, kickR: 0, faceX: i === 1 ? -1 : 1, walk: t * 6, walking: 1 });
          g.restore();
        }
      } else if (view === 'foes') {
        soldiers.forEach((a, i) => {
          g.save();
          g.translate(90 + i * 140, 430);
          g.scale(3.2, 3.2);
          drawSoldier(g, a, 0, 0, { facing: 1, state: i === 3 ? 'fly' : 'run', t, runPhase: t * 10, aim: 0, aiming: true, flash: false, alpha: 1, kick: 0, charge: (Math.sin(t * 3) + 1) / 2, style: styles[i], jet: 1 });
          g.restore();
        });
        const base = { facing: 1 as const, t, flash: false, alpha: 1, aim: 0, charge: 0.5, kick: 0, phase: t * 8, moving: true, extra: 0, hp01: 1 };
        g.save(); g.translate(90, 740); g.scale(3, 3); drawDrone(g, robots, 0, -30, base); g.restore();
        g.save(); g.translate(260, 740); g.scale(3, 3); drawTurret(g, robots, 0, 0, base, false, 0); g.restore();
        g.save(); g.translate(470, 740); g.scale(2.2, 2.2); drawHeavy(g, robots, 0, 0, base); g.restore();
        g.save(); g.translate(720, 740); g.scale(3, 3); drawSpider(g, robots, 0, 0, base); g.restore();
        g.save(); g.translate(950, 740); g.scale(2.6, 2.6); drawMiniMech(g, robots, 0, 0, base); g.restore();
      }
      requestAnimationFrame(loop2);
    };
    loop2();
    return;
  }
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
