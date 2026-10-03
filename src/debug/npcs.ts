/** Vitrine dos NPCs (dev): /?debug=npcs — civis, moradores, crianças e o jacaré dançante. */
import { buildLevel } from '../game/level/index';
import { bakeCivilians, civArtFor, drawCivilian, type CivPoseSrc } from '../art/civilians';
import type { CivAct } from '../game/civilians';
import { bakeVillagers, drawResident, type ResidentPose, type ResidentRole } from '../art/village';
import { drawDancingAlligator } from '../art/dancingAlligator';

export function runNpcDebug() {
  const cv = document.getElementById('game') as HTMLCanvasElement;
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;background:#2b3a2a';
  const g = cv.getContext('2d')!;
  const W = (cv.width = 1600);
  const H = (cv.height = 900);
  const civs = buildLevel().civilians;
  bakeCivilians(civs.map((c) => c.look));
  bakeVillagers();
  const acts: CivAct[] = ['idle', 'help', 'cheer', 'run', 'cower', 'idle', 'help', 'idle'];
  const roles: ResidentRole[] = ['resident', 'farmer', 'washer', 'weaver', 'carrier', 'carpenter', 'resident', 'farmer'];
  const q = new URLSearchParams(location.search);
  const zoom = Number(q.get('zoom') ?? 2);
  const only = q.get('only');
  const from = Number(q.get('from') ?? 0);
  const gap = 48 * zoom;
  const draw = (t: number) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#37305a';
    g.fillRect(0, 0, W, H / 3);
    g.fillStyle = '#4f6b3c';
    g.fillRect(0, H / 3, W, H);
    g.fillStyle = '#211a33';
    g.fillRect(0, 250, W, 6);
    // civis da cidade
    if (only === 'gator') {
      g.save();
      g.translate(W / 2, 800);
      g.scale(zoom, zoom);
      drawDancingAlligator(g, 0, 0, t);
      g.restore();
      return;
    }
    if (only !== 'village') civs.slice(from, from + 16).forEach((c, i) => {
      const art = civArtFor(c.look);
      if (!art) return;
      const src: CivPoseSrc = { facing: i % 2 ? -1 : 1, act: acts[i % acts.length], t: t + i, hop: acts[i % acts.length] === 'cheer' ? Math.max(0, Math.sin(t * 6 + i)) * 10 : 0, crouch: acts[i % acts.length] === 'cower' ? 1 : 0, runPhase: t * 12, phase: i * 0.13 };
      g.save();
      g.translate(40 + gap / 2 + i * gap, only === 'civ' ? 700 : 250);
      g.scale(zoom * 0.6, zoom * 0.6);
      drawCivilian(g, art, 0, 0, src, i === 5);
      g.restore();
    });
    // moradores da aldeia e crianças
    if (only !== 'civ') for (let i = from; i < 16; i++) {
      const child = i >= 10;
      const p: ResidentPose = { x: 0, y: 0, id: i, facing: i % 2 ? -1 : 1, walk: roles[i % 8] === 'carrier' ? t * 6 : 0, gesture: i === 0 ? 1 : 0, role: child ? 'child' : roles[i % 8], work: (Math.sin(t * 3 + i) + 1) / 2 };
      g.save();
      g.translate(40 + gap / 2 + (i - from) * gap, only === 'village' ? 700 : 560);
      g.scale(zoom * 0.75, zoom * 0.75);
      drawResident(g, p, t, i === 2);
      g.restore();
    }
    if (only) return;
    g.save();
    g.translate(W / 2, 860);
    g.scale(zoom * 0.75, zoom * 0.75);
    drawDancingAlligator(g, 0, 0, t);
    g.restore();
  };
  (window as unknown as { __npc: (t: number) => void }).__npc = draw;
  let t = 0;
  const loop = () => {
    t += 1 / 60;
    draw(t);
    requestAnimationFrame(loop);
  };
  draw(0.3);
  requestAnimationFrame(loop);
}
