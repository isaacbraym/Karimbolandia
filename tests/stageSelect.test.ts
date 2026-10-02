import { describe, expect, it } from 'vitest';
import { freshSave } from '../src/game/save';
import { stageCheckpoints } from '../src/game/stageSelect';

describe('Checkpoints na seleção de fases', () => {
  it('oferece apenas snapshots da fase escolhida, preservando inventário e vidas', () => {
    const jungle = { ...freshSave(2), checkpointIdx: 3, cpName: 'Templo', tokens: 149, lives: 5, weapons: [['pistol', -1], ['shotgun', 27]] as [string, number][], cur: 'shotgun' };
    const city = { ...freshSave(1), checkpointIdx: 1, cpName: 'Distrito' };
    expect(stageCheckpoints(2, jungle, [city])).toEqual([jungle]);
    expect(stageCheckpoints(1, jungle, [city])).toEqual([city]);
    expect(stageCheckpoints(1, null, [])).toEqual([]);
  });

  it('mantém o progresso atual como padrão quando outra cópia tem o mesmo checkpoint', () => {
    const current = { ...freshSave(1), checkpointIdx: 2, tokens: 40, savedAt: 10 };
    const other = { ...current, tokens: 90, savedAt: 30 };
    expect(stageCheckpoints(1, current, [other])).toEqual([current]);
  });

  it('escolhe a cópia mais recente de cada checkpoint sem inventar pontos intermediários nem alterar as fontes', () => {
    const old = { ...freshSave(2), checkpointIdx: 5, savedAt: 10 };
    const recent = { ...old, tokens: 99, savedAt: 20 };
    const start = { ...freshSave(2), savedAt: 5 };
    const copies = [old, start, recent];
    expect(stageCheckpoints(2, null, copies)).toEqual([recent, start]);
    expect(copies).toEqual([old, start, recent]);
  });
});
