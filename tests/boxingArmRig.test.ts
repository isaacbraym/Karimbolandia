import { describe, expect, it } from 'vitest';
import { newArm, solveArm, unproject, depthScale } from '../src/art/minigames/boxing/armRig';
import { armPoseForTest, type BackPose } from '../src/art/minigames/boxing/karimboBack';
import { PUNCHES, type PunchTier } from '../src/game/minigames/boxing/sim/rules';

const len = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('rig de braço 2.5D: o solucionador', () => {
  it('mantém o comprimento dos ossos quando o alvo está ao alcance', () => {
    const o = newArm();
    for (const [tx, ty, tz] of [[60, -80, 100], [-40, 20, 140], [10, 90, 20], [90, 30, 130]]) {
      solveArm(o, 90, 38, 0, tx, ty, tz, 118, 112, 0.3, 1, 0.2, 2);
      expect(o.stretch).toBe(1);
      expect(len([90, 38, 0], [o.ex, o.ey, o.ez])).toBeCloseTo(118, 3);
      expect(len([o.ex, o.ey, o.ez], [o.wx, o.wy, o.wz])).toBeCloseTo(112, 3);
      expect([o.wx, o.wy, o.wz]).toEqual([tx, ty, tz]);
    }
  });

  it('alvo longe: os dois ossos esticam juntos (nunca só um) e o punho continua preso ao ombro', () => {
    const o = newArm();
    solveArm(o, 0, 0, 0, 300, 0, 0, 100, 100, 0, 1, 0, 2);
    expect(o.stretch).toBeGreaterThan(1.4);
    expect(len([0, 0, 0], [o.ex, o.ey, o.ez])).toBeCloseTo(100 * o.stretch, 3);
    expect(len([o.ex, o.ey, o.ez], [o.wx, o.wy, o.wz])).toBeCloseTo(100 * o.stretch, 3);
    // além do alongamento máximo o punho é puxado, não o contrário
    solveArm(o, 0, 0, 0, 1000, 0, 0, 100, 100, 0, 1, 0, 2);
    expect(o.stretch).toBe(2);
    expect(Math.hypot(o.wx, o.wy, o.wz)).toBeLessThan(400);
    // e os ossos continuam com o comprimento esticado, sem se soltar um do outro
    expect(len([0, 0, 0], [o.ex, o.ey, o.ez])).toBeCloseTo(200, 3);
    expect(len([o.ex, o.ey, o.ez], [o.wx, o.wy, o.wz])).toBeCloseTo(200, 3);
  });

  it('o cotovelo vai para o lado do vetor-guia e não vira de lado quando o guia fica paralelo ao braço', () => {
    const o = newArm();
    solveArm(o, 0, 0, 0, 0, -90, 0, 80, 80, 1, 0, 0, 2);
    expect(o.ex).toBeGreaterThan(10); // guia para a direita → cotovelo para a direita
    solveArm(o, 0, 0, 0, 0, -90, 0, 80, 80, -1, 0, 0, 2);
    expect(o.ex).toBeLessThan(-10);
    // guia exatamente paralelo ao braço: cai no "para baixo", sem NaN
    solveArm(o, 0, 0, 0, 0, -90, 0, 80, 80, 0, -1, 0, 2);
    for (const v of [o.ex, o.ey, o.ez, o.wx, o.wy, o.wz]) expect(Number.isFinite(v)).toBe(true);
    // alvo em cima do ombro: sem NaN
    solveArm(o, 5, 5, 5, 5, 5, 5, 80, 80, 0, 1, 0, 2);
    for (const v of [o.ex, o.ey, o.ez]) expect(Number.isFinite(v)).toBe(true);
  });

  it('unproject: o ponto 3D se projeta exatamente na tela pedida; mais longe = menor', () => {
    const cam = { kx: 0.28, ky: -0.5, F: 520 };
    const p = { x: 0, y: 0, z: 0 };
    unproject(p, 40, -60, 120, cam);
    expect(p.x + cam.kx * p.z).toBeCloseTo(40, 6);
    expect(p.y + cam.ky * p.z).toBeCloseTo(-60, 6);
    expect(depthScale(200, 520)).toBeLessThan(depthScale(0, 520));
    expect(depthScale(-100, 300)).toBeGreaterThan(1);
  });
});

/** golpes do Karimbo, varridos quadro a quadro (1/120 s) por preparo, golpe e recuperação */
const TIERS: PunchTier[] = ['jab', 'direto', 'cruzado', 'gancho'];
const T = { x: 232, y: -150 };
const pose = (side: 'L' | 'R', tier: PunchTier, phase: 'wind' | 'active' | 'recover', k: number, guard = false): BackPose => ({
  dodge: 0, duck: 0, hurt: 0, guard, punch: { side, tier, phase, k }, spin: 0, ears: 1, fall: 0, getup: 0, fury: false, time: 0,
});
function sweep(side: 'L' | 'R', tier: PunchTier) {
  const out: ReturnType<typeof armPoseForTest>[] = [];
  const N = 40;
  for (const phase of ['wind', 'active', 'recover'] as const) {
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      const u = phase === 'wind' ? -0.2 * k : phase === 'active' ? 1 : 1 - k;
      out.push(armPoseForTest(side, pose(side, tier, phase, k), T, 1, Math.max(0, Math.min(1, u))));
    }
  }
  return out;
}

describe('braços do Karimbo em todos os golpes', () => {
  for (const side of ['L', 'R'] as const) for (const tier of TIERS) {
    const sgn = side === 'L' ? -1 : 1;
    it(`${side} ${tier}: luva presa ao braço, cotovelo sem pulos e sem cruzar o corpo`, () => {
      const seq = sweep(side, tier);
      let prev: ReturnType<typeof armPoseForTest> | null = null;
      for (const f of seq) {
        const a = f.arm;
        // a luva autorada e o punho do braço são o mesmo ponto na tela (o braço nunca solta a luva)
        const wx = a.wx, wy = a.wy;
        expect(Math.hypot(wx - f.glove.x, wy - f.glove.y)).toBeLessThan(2);
        // ossos esticam juntos e dentro do limite
        expect(a.stretch).toBeLessThanOrEqual(1.9 + 1e-9);
        // o cotovelo do braço esquerdo não passa da linha do meio das costas (e o direito idem)
        // (esticado em direção ao alvo, o braço cruza as costas por construção; o critério vale perto da guarda)
        if (f.u < 0.3) expect(a.ex * sgn).toBeGreaterThan(-30);
        // o cotovelo não sobe acima do topo da cabeça nem desce abaixo do tronco visível
        expect(a.ey).toBeGreaterThan(-260);
        expect(a.ey).toBeLessThan(200);
        if (prev) {
          // nada de inversão do cotovelo entre amostras (uma inversão salta ~2× o comprimento do osso; o arremesso é rápido, mas contínuo)
          expect(Math.hypot(a.ex - prev.arm.ex, a.ey - prev.arm.ey)).toBeLessThan(100);
          expect(Math.hypot(a.wx - prev.arm.wx, a.wy - prev.arm.wy)).toBeLessThan(120);
        }
        prev = f;
      }
    });
  }

  it('o golpe todo cobre o caminho da guarda ao alvo: o punho chega perto da cabeça do jacaré', () => {
    for (const tier of TIERS) {
      const seq = sweep('R', tier);
      const best = Math.min(...seq.map((f) => Math.hypot(f.arm.wx - T.x, f.arm.wy - T.y)));
      expect(best, tier).toBeLessThan(80);
    }
  });

  it('em guarda e em descanso os braços são simétricos o bastante e dobrados (sem esticar)', () => {
    for (const guard of [true, false]) {
      const base = { dodge: 0, duck: 0, hurt: 0, guard, punch: null, spin: 0, ears: 1, fall: 0, getup: 0, fury: false, time: 0 } as BackPose;
      const L = armPoseForTest('L', base, T), R = armPoseForTest('R', base, T);
      expect(L.stretch).toBe(1);
      expect(R.stretch).toBe(1);
      // cotovelos em lados opostos do corpo
      expect(L.arm.ex).toBeLessThan(0);
      expect(R.arm.ex).toBeGreaterThan(0);
      // cotovelo abaixo do punho: o antebraço sobe da junta para a luva
      expect(L.arm.ey).toBeGreaterThan(L.arm.wy);
      expect(R.arm.ey).toBeGreaterThan(R.arm.wy);
    }
  });

  it('as tabelas de golpes continuam mapeando lado e tipo (o rig depende disso)', () => {
    for (const d of Object.values(PUNCHES)) {
      expect(['L', 'R']).toContain(d.side);
      expect(TIERS).toContain(d.tier);
    }
  });
});

import { GATOR_GUARD, GATOR_MOUTH, gatorArmGeom } from '../src/art/minigames/boxing/gatorBoxer';

/** o segmento (a→b) passa pelo retângulo? (amostragem densa: suficiente para um teste de layout) */
const segHitsRect = (ax: number, ay: number, bx: number, by: number, r: { x0: number; x1: number; y0: number; y1: number }) => {
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return true;
  }
  return false;
};

describe('jacaré: as guardas nunca atravessam a própria boca', () => {
  const guards = (Object.keys(GATOR_GUARD) as (keyof typeof GATOR_GUARD)[]).filter((g) => g !== 'cobertura');
  for (const guard of guards) {
    it(`guarda ${guard}: luvas e braços fora da boca, braços sem esticar`, () => {
      for (const sd of [-1, 1] as const) {
        const [gx, gy, gsc] = GATOR_GUARD[guard][sd < 0 ? 0 : 1];
        const a = gatorArmGeom(sd, gx, gy, gsc);
        // corpo da luva (a elipse útil, menor que o quadro) acima da boca ou ao lado dela
        const glove = { x0: gx - 18 * gsc, x1: gx + 18 * gsc, y0: gy - 36 * gsc, y1: gy + 4 * gsc };
        const overlaps = glove.x1 > GATOR_MOUTH.x0 && glove.x0 < GATOR_MOUTH.x1 && glove.y1 > GATOR_MOUTH.y0 && glove.y0 < GATOR_MOUTH.y1;
        expect(overlaps, `luva ${sd}`).toBe(false);
        expect(segHitsRect(a.sx, a.sy, a.ex, a.ey, GATOR_MOUTH), `braço ${sd}`).toBe(false);
        expect(segHitsRect(a.ex, a.ey, a.wx, a.wy, GATOR_MOUTH), `antebraço ${sd}`).toBe(false);
        expect(a.stretch, 'alongamento').toBeLessThan(1.25);
        // o cotovelo do lado esquerdo fica à esquerda do ombro-punho e vice-versa (nada de braço cruzado)
        expect(a.ex * sd).toBeGreaterThan(10);
      }
    });
  }

  it('a cobertura é a única guarda que tapa o rosto, de propósito (luvas no meio da cabeça)', () => {
    const [gx, gy] = GATOR_GUARD.cobertura[0];
    expect(Math.abs(gx)).toBeLessThan(30);
    expect(gy).toBeGreaterThan(GATOR_MOUTH.y0 - 20);
  });
});
