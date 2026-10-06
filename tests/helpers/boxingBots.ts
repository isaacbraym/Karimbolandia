/**
 * Jogadores sintéticos do boxe (os mesmos dos testes de equilíbrio e das varreduras de calibragem).
 * Jogam pela interface pública da simulação: leem `m.g`/`m.k` como um jogador lê a tela.
 */
import { BoxingMatch } from '../../src/game/minigames/boxing/sim/match';
import { ATTACKS, PUNCH_BUTTONS, type Punch } from '../../src/game/minigames/boxing/sim/rules';
import { MINI_BUTTONS, type MiniButton, type MiniPad } from '../../src/core/input';
import type { DifficultyId } from '../../src/core/difficulty';

const DT = 1 / 60;
export function pad(pressed: MiniButton[] = [], held: MiniButton[] = []): MiniPad {
  return Object.fromEntries(MINI_BUTTONS.map((b) => [b, { held: held.includes(b) || pressed.includes(b), pressed: pressed.includes(b), released: false }])) as MiniPad;
}
export type Bot = (m: BoxingMatch, t: number) => MiniPad;

/** Leitor (jogador bom): defende pela COR, pune as aberturas, varia os socos e dá o golpe final. */
export function reader(reaction = 0.16): Bot {
  let lastKey = '';
  let held: MiniButton[] = [];
  let n = 0;
  const cycle: Punch[] = ['direto', 'cruzD', 'jab', 'ganchoD', 'cruzE', 'ganchoE'];
  return (m) => {
    const g = m.g, k = m.k;
    // o golpe final sempre; a carregada só com as 3 estrelas (um jogador esperto junta antes de gastar)
    if (m.specialKind === 'finale' || (m.specialKind === 'carga' && m.stars >= 3)) return pad(['especial']);
    if (m.flow === 'kdK') return pad(['jab']);
    if (m.flow !== 'fight') { held = []; return pad(); }
    if (g.mode === 'tele') {
      const key = `${g.attackCount}:${g.hitIdx}`;
      if (g.tele <= reaction && key !== lastKey) {
        lastKey = key;
        const def = ATTACKS[g.attack!];
        if (def.color === 'laranja') return pad(['abaixar'], ['abaixar']);
        if (def.color === 'amarelo') { held = ['guarda']; return pad(['guarda'], ['guarda']); }
        const side = def.sides?.[g.hitIdx] ?? 0;
        return pad([side === 0 || side === 1 ? 'esqE' : 'esqD']);
      }
      if (k.action === 'duck') return pad([], ['abaixar']);
      return pad([], held);
    }
    held = [];
    if (k.action !== 'idle' && k.action !== 'guard') return pad();
    if (g.mode === 'cover' || g.mode === 'down' || g.mode === 'ko') return pad();
    // ainda dá tempo de terminar o soco antes do próximo bote?
    const ok = g.mode !== 'recover' || g.recoverT > 0.2;
    if (!ok) return pad();
    let p: Punch;
    if (g.guard === 'alta') p = n++ % 2 ? 'ganchoD' : 'ganchoE';
    else p = cycle[n++ % cycle.length];
    return pad([p]);
  };
}
/** Martelador: nunca defende, só dá socos (cicla os seis). */
export const hammer: Bot = (m, t) => (m.specialKind ? pad(['especial']) : m.flow === 'kdK' ? pad(['jab']) : pad([PUNCH_BUTTONS[Math.floor(t * 8) % 6]]));
/** Esquivador: só se esquiva (nunca soca). */
export const dodgerOnly: Bot = (m) => {
  const g = m.g;
  if (g.mode === 'tele' && g.tele <= 0.16 && m.k.dodgeCd <= 0) { const side = ATTACKS[g.attack!].sides?.[g.hitIdx] ?? 0; return pad([side === 1 ? 'esqE' : 'esqD']); }
  return pad();
};
/** Só segura a guarda. */
export const guarderOnly: Bot = () => pad([], ['guarda']);

export function play(bot: Bot, difficulty: DifficultyId = 'normal', maxSeconds = 600, opts: ConstructorParameters<typeof BoxingMatch>[2] = {}) {
  const m = new BoxingMatch(difficulty, 1337, opts);
  let t = 0;
  while (!m.over && t < maxSeconds) { m.step(DT, bot(m, t)); t += DT; m.events.length = 0; }
  return { m, t };
}

