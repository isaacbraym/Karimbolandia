import type { SaveState } from './save';

export const STAGES = [
  { id: 1, name: 'Cidade Neon', theme: 'city', tag: 'FUTURISTA', description: 'Ruínas, robôs e guerra nas ruas.' },
  { id: 2, name: 'Selva Ancestral', theme: 'jungle', tag: 'TRIBAL / SELVA', description: 'Cipós, pântanos e templos esquecidos.' },
] as const;
export type StageId = (typeof STAGES)[number]['id'];

/** Real snapshots only; never fabricate inventory or progression for a checkpoint. */
export function stageCheckpoints(stage: StageId, current: SaveState | null, copies: readonly SaveState[]): SaveState[] {
  const saves = [...copies].sort((a, b) => b.savedAt - a.savedAt);
  if (current) saves.unshift(current);
  const seen = new Set<number>();
  return saves.filter(save => {
    if (save.stage !== stage || seen.has(save.checkpointIdx)) return false;
    seen.add(save.checkpointIdx);
    return true;
  });
}
