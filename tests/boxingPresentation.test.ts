import { describe, expect, it } from 'vitest';
import { hapticFor, musicFor, sfxFor } from '../src/game/minigames/boxing/presentation';
import { ATTACKS, PUNCHES, type AttackKind } from '../src/game/minigames/boxing/sim/rules';
import { BoxFx } from '../src/art/minigames/boxing/fx';
import { MIX } from '../src/core/music';

const KINDS = Object.keys(ATTACKS) as AttackKind[];

describe('boxe: a luta nos sentidos', () => {
  it('cada ataque do jacaré tem um sinal sonoro DIFERENTE (dá para jogar de olhos fechados)', () => {
    const cues = KINDS.filter((k) => k !== 'contrape').map((k) => sfxFor({ type: 'gatorAttack', attack: k })[0][0]);
    expect(new Set(cues).size).toBe(cues.length);
  });

  it('o som e a vibração do golpe ficam mais pesados do jab ao gancho; bloqueado não faz baque de dano', () => {
    const hit = (p: keyof typeof PUNCHES) => sfxFor({ type: 'hit', punch: p, amount: PUNCHES[p].dmg })[0][0];
    expect(hit('jab')).toBe('jabHit');
    expect(hit('cruzD')).toBe('hookHit');
    expect(hit('ganchoE')).toBe('upperHit');
    const hap = (p: keyof typeof PUNCHES) => hapticFor({ type: 'hit', punch: p })!;
    expect(hap('jab').ms).toBeLessThan(hap('direto').ms);
    expect(hap('direto').ms).toBeLessThanOrEqual(hap('cruzD').ms);
    expect(hap('cruzD').s).toBeLessThanOrEqual(hap('ganchoD').s);
    expect(sfxFor({ type: 'hit', punch: 'direto' }, true)).toEqual([]);
    expect(hapticFor({ type: 'hit', punch: 'direto' }, true)).toBeNull();
    // a mordida e o impacto final são os mais fortes
    expect(hapticFor({ type: 'gatorHit', attack: 'mordidona' })!.ms).toBeGreaterThan(hapticFor({ type: 'gatorHit', attack: 'patada' })!.ms);
    expect(hapticFor({ type: 'impact' })!.ms).toBeGreaterThanOrEqual(150);
  });

  it('a parada de impacto cresce com o peso do golpe (2, 3, 5 e 7 quadros a 60 Hz)', () => {
    const f = (p: keyof typeof PUNCHES) => Math.round(PUNCHES[p].stop * 60);
    expect([f('jab'), f('direto'), f('cruzD'), f('ganchoD')]).toEqual([2, 3, 5, 7]);
  });

  it('a música cresce com os rounds, respira no intervalo e cala na ORELHADA', () => {
    expect(musicFor({ type: 'roundStart', n: 1 }, 1)).toBe('fight1');
    expect(musicFor({ type: 'roundStart', n: 3 }, 3)).toBe('fight3');
    expect(musicFor({ type: 'roundEnd', n: 1 }, 1)).toBe('fightBreak');
    expect(musicFor({ type: 'roundEnd', n: 3 }, 3)).toBe('silence');
    expect(musicFor({ type: 'kdG' }, 2)).toBe('fightBreak');
    expect(musicFor({ type: 'rise' }, 2)).toBe('fight2');
    expect(musicFor({ type: 'getup' }, 3)).toBe('fight3');
    expect(musicFor({ type: 'orelhada' }, 3)).toBe('silence');
    expect(musicFor({ type: 'hit' }, 1)).toBeNull();
    const layers = (m: Record<string, number | undefined>) => Object.values(m).filter((v) => (v ?? 0) > 0).length;
    expect(layers(MIX.fight1)).toBeLessThan(layers(MIX.fight2));
    expect(layers(MIX.fight2)).toBeLessThan(layers(MIX.fight3));
    expect(MIX.fight3.power).toBeGreaterThan(0);
    expect(MIX.fight1.power ?? 0).toBe(0);
  });
});

describe('efeitos de câmera do boxe', () => {
  it('o chute de câmera segue a direção do golpe e volta sozinho; zoom decai', () => {
    const fx = new BoxFx();
    fx.kick(12, -6);
    fx.punch(0.05);
    fx.update(1 / 60);
    expect(fx.sx).toBeGreaterThan(5);
    expect(fx.sy).toBeLessThan(-2);
    expect(fx.zoom).toBeGreaterThan(0.03);
    for (let i = 0; i < 90; i++) fx.update(1 / 60);
    expect(Math.abs(fx.sx)).toBeLessThan(0.05);
    expect(fx.zoom).toBeLessThan(0.001);
  });

  it('na parada de impacto as partículas e os letreiros esperam, mas a câmera continua', () => {
    const fx = new BoxFx();
    fx.burst(100, 100, 3, 0, '#fff', 100);
    fx.kick(10, 0);
    const before = fx.sx;
    for (let i = 0; i < 6; i++) fx.update(1 / 60, true);
    // as partículas não andaram (a vida delas não gastou)
    let alive = 0;
    fx.draw({ globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {}, fillRect() { alive++; }, beginPath() {}, fill() {}, arc() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {} } as unknown as CanvasRenderingContext2D);
    expect(alive).toBe(3);
    expect(fx.sx).not.toBe(before); // a câmera seguiu decaindo
  });
});
