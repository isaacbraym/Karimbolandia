import { describe, expect, it } from 'vitest';
import { barmanPose, BAR_CYCLE } from '../src/art/clubBar';
import { figureLook, newPose, handPos, type FigureLook, type FigurePose } from '../src/art/figure';
import type { Sprite } from '../src/art/kit';

const face = { joy: { id: 'joy' } as unknown as Sprite, talk: { id: 'talk' } as unknown as Sprite };
const look: FigureLook = figureLook({
  skin: '#8a5a3a', top: '#f1ede4', top2: '#c4202e', sleeve: 0.5, bottom: '#1d1b2a', bottomKind: 'pants', shoe: '#0c0c10',
  limb: 4.2, thigh: 9.4, shin: 8.8, torso: 12.8, shoulder: 15, hip: 11.5, arm: 6.7, fore: 6.5, headScale: 1.1, belly: 0.6, apron: '#2a2233',
});

/** roda o ciclo do barman quadro a quadro e anota o que ele usa em cada instante */
function cycle(seconds = BAR_CYCLE * 2) {
  const P: FigurePose = newPose(face.joy);
  const seen = { shaker: 0, glass: 0, stream: 0, cloth: 0, held: 0, bottle: 0, shot: 0, talk: 0 };
  let maxJump = 0;
  let last: [number, number] | null = null;
  for (let i = 0; i < seconds * 60; i++) {
    const t = i / 60;
    const pr = barmanPose(look, P, face, t, (t * 2.5) % 1);
    for (const k of Object.keys(seen) as (keyof typeof seen)[]) if (k !== 'talk' && pr[k]) seen[k]++;
    if (P.head === face.talk) seen.talk++;
    const h = handPos(look, P, true);
    if (last) maxJump = Math.max(maxJump, Math.hypot(h.x - last[0], h.y - last[1]));
    last = [h.x, h.y];
    // a mão nunca vai além do alcance do braço a partir do ombro (sem braço de borracha)
    const sx = P.hipX + Math.sin(P.lean) * look.torso;
    const sy = -(look.thigh + look.shin) + 0.6 + P.hipDrop - Math.cos(P.lean) * look.torso;
    for (const front of [true, false]) {
      const q = handPos(look, P, front);
      expect(Math.hypot(q.x - sx, q.y - sy)).toBeLessThanOrEqual(look.arm + look.fore + 1e-6);
    }
  }
  return { seen, maxJump };
}

describe('barman da balada: o ciclo de 9 s mostra o trabalho de um bar de verdade', () => {
  it('usa a coqueteleira, serve o líquido, enfeita, seca um copo e faz o malabarismo com a garrafa e a dose', () => {
    const { seen } = cycle();
    for (const k of ['shaker', 'glass', 'stream', 'cloth', 'held', 'bottle', 'shot', 'talk'] as const) expect(seen[k], k).toBeGreaterThan(10);
  });

  it('os movimentos são contínuos (a mão nunca teletransporta entre quadros)', () => {
    const { maxJump } = cycle();
    expect(maxJump).toBeLessThan(3.2); // unidades locais por quadro de 1/60 s
  });

  it('cada ciclo muda a cor do drinque', () => {
    const P: FigurePose = newPose(face.joy);
    const colors = new Set<string>();
    for (let c = 0; c < 4; c++) { const pr = barmanPose(look, P, face, c * BAR_CYCLE + 3.0, 0.3); if (pr.glass) colors.add(pr.glass.color); }
    expect(colors.size).toBe(4);
  });

  it('o copo do drinque enche durante o serviço e desliza para fora no fim', () => {
    const P: FigurePose = newPose(face.joy);
    const fill = (t: number) => barmanPose(look, P, face, t, 0.2).glass!.fill;
    expect(fill(2.0)).toBe(0);
    expect(fill(3.4)).toBeGreaterThan(0.7);
    const x = (t: number) => barmanPose(look, P, face, t, 0.2).glass!.x;
    expect(x(5.1)).toBeGreaterThan(x(4.2) + 12);
  });
});
