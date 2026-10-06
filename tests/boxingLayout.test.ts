import { describe, expect, it } from 'vitest';
import { boxLayout, intersects, spotBox } from '../src/art/minigames/boxing/layout';

/** Formatos de tela dos minijogos (sempre paisagem): celulares estreitos e largos, tablet e computador. */
const SCREENS: [number, number][] = [[667, 320], [844, 390], [932, 430], [1024, 768], [1280, 720], [1920, 1080], [2340, 1080]];

describe('layout do boxe: a torcida nunca entra na área da luta', () => {
  for (const [W, H] of SCREENS) {
    it(`${W}×${H}: nenhuma criança toca a área protegida nem fica entre os lutadores`, () => {
      const L = boxLayout(W, H);
      expect(L.spots.length).toBeGreaterThanOrEqual(18);
      for (const sp of L.spots) {
        expect(intersects(spotBox(sp), L.protect), `${sp.band} ${sp.side} em x=${sp.x.toFixed(0)}`).toBe(false);
      }
      // jacaré e Karimbo ficam dentro da área da luta
      expect(L.gator.x).toBeGreaterThan(L.protect.x);
      expect(L.gator.x).toBeLessThan(L.protect.x + L.protect.w);
      expect(L.karimbo.x).toBeGreaterThan(L.protect.x - L.W * 0.1);
      // a torcida se divide nos dois lados (em U) e tem o juiz
      expect(L.spots.filter((s) => s.side < 0).length).toBeGreaterThanOrEqual(9);
      expect(L.spots.filter((s) => s.side > 0).length).toBeGreaterThanOrEqual(9);
      expect(L.spots.some((s) => s.band === 'judge')).toBe(true);
    });
  }

  it('as crianças mais perto da câmera são maiores e ficam mais embaixo (perspectiva)', () => {
    const L = boxLayout(844, 390);
    const left = L.spots.filter((s) => s.side < 0 && s.band !== 'judge').sort((a, b) => a.y - b.y);
    for (let i = 1; i < left.length; i++) expect(left[i].s).toBeGreaterThanOrEqual(left[i - 1].s * 0.99);
  });

  it('o alvo dos socos está sobre o peito do jacaré, e o Karimbo fica à esquerda dele', () => {
    const L = boxLayout(1280, 720);
    expect(L.karimbo.x).toBeLessThan(L.gator.x);
    expect(L.target.y).toBeLessThan(L.gator.feetY);
    expect(Math.abs(L.target.x - L.gator.x)).toBeLessThan(L.W * 0.05);
  });
});
