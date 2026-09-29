/** Mapa da fase inteira (dev): abra /?debug=map */
import { buildLevel } from '../game/level/index';
import { T, TILE } from '../game/level';

export function runLevelMap() {
  const d = buildLevel();
  const L = d.level;
  const cv = document.getElementById('game') as HTMLCanvasElement;
  const S = 3;
  const PER = 226;
  const rows = Math.ceil(L.w / PER);
  const H = L.h * S + 14;
  cv.width = PER * S;
  cv.height = rows * H;
  cv.style.cssText = 'position:absolute;left:0;top:0;width:auto;height:auto;image-rendering:pixelated;max-width:none;max-height:none';
  document.body.style.overflow = 'auto';
  document.documentElement.style.overflow = 'auto';
  document.body.style.touchAction = 'auto';
  const g = cv.getContext('2d')!;
  g.fillStyle = '#0d0724';
  g.fillRect(0, 0, cv.width, cv.height);
  const colors: Record<string, string> = {
    rifle: '#ff5a5a', shotgun: '#ff9a3a', shield: '#4aa8ff', jetpack: '#ffe94a', sniper: '#ff3aff', drone: '#3affea', turret: '#aaaaaa',
    heavy: '#ff0000', spider: '#a04aff', minimech: '#ff7a00', boss: '#ffffff',
  };
  for (let r = 0; r < rows; r++) {
    const x0 = r * PER;
    const oy = r * H + 12;
    g.fillStyle = '#9fa4d8';
    g.font = '9px monospace';
    g.fillText(`x ${x0}..${x0 + PER}`, 2, oy - 3);
    for (let ty = 0; ty < L.h; ty++) {
      for (let tx = 0; tx < PER; tx++) {
        const t = L.get(x0 + tx, ty);
        if (t === T.EMPTY) continue;
        g.fillStyle = t === T.SOLID ? '#5a5f96' : t === T.ONEWAY ? '#ffd23a' : '#ff3a3a';
        if (t === T.ONEWAY) g.fillRect(tx * S, oy + ty * S, S, 1.5);
        else g.fillRect(tx * S, oy + ty * S, S, S);
      }
    }
    const inRow = (px: number) => px / TILE >= x0 && px / TILE < x0 + PER;
    const dot = (px: number, py: number, c: string, s = 3) => {
      g.fillStyle = c;
      g.fillRect((px / TILE - x0) * S - 1, oy + (py / TILE) * S - s, s, s);
    };
    for (const e of d.enemies) if (inRow(e.x)) dot(e.x, e.y, colors[e.type] ?? '#fff', e.arena ? 2 : 4);
    for (const p of d.props) if (inRow(p.x)) dot(p.x, p.y, p.kind === 'wall' ? '#ff7ac0' : '#a0703a', 3);
    for (const p of d.pickups) if (inRow(p.x)) dot(p.x, p.y, p.kind === 'emblem' ? '#00ff88' : p.kind === 'secret' ? '#00ffff' : p.kind === 'token' ? '#886600' : '#ffffff', p.kind === 'emblem' || p.kind === 'secret' ? 6 : 2);
    for (const c of d.checkpoints) if (inRow(c.x)) {
      g.fillStyle = '#00ff00';
      g.fillRect((c.x / TILE - x0) * S, oy, 1, L.h * S);
    }
    for (const a of d.arenas) {
      g.strokeStyle = '#ff00ff';
      g.lineWidth = 1;
      const ax = a.rect.x / TILE - x0;
      g.strokeRect(ax * S, oy + (a.rect.y / TILE) * S, (a.rect.w / TILE) * S, (a.rect.h / TILE) * S);
    }
    for (const t of d.triggers) if (inRow(t.rect.x) && !t.id.startsWith('hint')) {
      g.fillStyle = '#ffff00';
      g.fillRect((t.rect.x / TILE - x0) * S, oy, 2, 10);
      g.fillText(t.id, (t.rect.x / TILE - x0) * S + 3, oy + 9);
    }
    g.fillStyle = '#00ffff';
    if (inRow(d.nomadSpawn.x)) g.fillRect((d.nomadSpawn.x / TILE - x0) * S - 3, oy + (d.nomadSpawn.y / TILE) * S - 14, 8, 14);
  }
}
