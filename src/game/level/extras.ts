import { T } from '../level';
import type { LevelBuilder } from './builder';

/**
 * Suprimentos espalhados pela fase: CORAÇÕES (vida) bem visíveis, caixas de munição e
 * cápsulas de arma no caminho. Cada item é posto sobre a superfície mais próxima abaixo de `from`.
 */
export function addSupplies(b: LevelBuilder) {
  const L = b.level;
  const surf = (x: number, from: number): number | null => {
    for (let y = from; y < L.h; y++) {
      const t = L.get(x, y);
      if (t === T.SOLID || t === T.ONEWAY) return y;
    }
    return null;
  };
  const put = (kind: 'health' | 'healthBig' | 'ammo' | 'nade' | 'launcher' | 'energy', x: number, from: number) => {
    const s = surf(x, x >= 1176 && from === 26 ? 8 : from); // telhado final fica bem mais alto
    if (s === null) return;
    b.pickup(kind, x, s - 1);
  };

  // Vida com critério: poucos corações fixos (recompensa/alívio após combates duros),
  // o resto vem de caixas sorteadas e de drops adaptativos (mais vida quando o jogador está ferido).
  for (const x of [118, 232, 336, 480, 592, 690, 802, 925, 1076]) put('health', x, 26);
  // corações grandes (+80): só perto de checkpoints
  for (const x of [217, 415, 598, 786, 1001, 1098]) put('healthBig', x, 26);
  // elevados (recompensa por explorar)
  put('health', 262, 20);
  put('health', 636, 22);
  put('health', 1134, 19);
  put('health', 1166, 15);
  put('health', 1128, 34); // no chão de segurança da torre (presente para quem cai)
  // telhado final: preparo para o chefe
  put('health', 1204, 8);
  put('healthBig', 1183, 8);

  // munição para TODAS as armas
  for (const x of [60, 130, 200, 260, 320, 382, 490, 566, 620, 680, 730, 790, 850, 900, 990, 1082, 1200, 1250]) put('ammo', x, 26);
  put('ammo', 1140, 34);
  // granadas
  for (const x of [250, 380, 660, 940, 1100]) put('nade', x, 26);
  // armas raras em cápsulas visíveis, no caminho
  put('launcher', 422, 26);
  put('energy', 903, 26);
}
