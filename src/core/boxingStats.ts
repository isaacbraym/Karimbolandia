/**
 * Marcas do jogador no boxe do jacaré (chave própria no localStorage, nunca no perfil/backup do jogo): quantas
 * lutas e vitórias, a melhor nota (S–C), se já venceu sem cair e se já derrotou o Campeão. Alimentam a luta
 * guiada (só a primeira), a revanche e os enfeites (luvas de ouro com nota S, calção de onça, sino de ouro).
 * Leitura e escrita nunca lançam: sem armazenamento a luta funciona igual.
 */
import type { Grade } from '../game/minigames/boxing/sim/scoring';

export interface BoxingStats {
  fights: number;
  wins: number;
  best: Grade | null;
  /** venceu uma luta sem ir ao chão nenhuma vez */
  clean: boolean;
  /** derrotou o Jacaré Campeão da revanche */
  champion: boolean;
}

const KEY = 'karimbolandia.boxing.v1';
const RANK: Record<Grade, number> = { C: 0, B: 1, A: 2, S: 3 };
const empty = (): BoxingStats => ({ fights: 0, wins: 0, best: null, clean: false, champion: false });

const isGrade = (v: unknown): v is Grade => v === 'S' || v === 'A' || v === 'B' || v === 'C';
const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1e6 ? v : 0);

/** Lê as marcas (valida tudo: um valor estranho vira o padrão, nunca quebra a luta). */
export function readBoxingStats(): BoxingStats {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return empty();
    const v = JSON.parse(raw) as Record<string, unknown>;
    return { fights: count(v.fights), wins: count(v.wins), best: isGrade(v.best) ? v.best : null, clean: v.clean === true, champion: v.champion === true };
  } catch {
    return empty();
  }
}

function write(s: BoxingStats) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* modo privado / cheio: segue sem guardar */ }
}

/** Registra o fim de uma luta. `knockdowns`: quantas vezes o Karimbo foi ao chão. */
export function recordFight(r: { win: boolean; grade: Grade; knockdowns: number; champion: boolean }): BoxingStats {
  const s = readBoxingStats();
  s.fights++;
  if (r.win) {
    s.wins++;
    if (!s.best || RANK[r.grade] > RANK[s.best]) s.best = r.grade;
    if (r.knockdowns === 0) s.clean = true;
    if (r.champion) s.champion = true;
  }
  write(s);
  return s;
}

/** A primeira luta é guiada: dicas na tela e o round 1 mais brando, até a primeira vitória (ou 3 tentativas). */
export const isFirstFight = (s: BoxingStats = readBoxingStats()) => s.wins === 0 && s.fights < 3;
/** A revanche (Jacaré Campeão) só abre depois de vencer o jacaré uma vez. */
export const championUnlocked = (s: BoxingStats = readBoxingStats()) => s.wins > 0;
export interface BoxPerks { goldGloves: boolean; leopardCuffs: boolean; goldBell: boolean }
/** Luvas de ouro (nota S), punhos de onça (vitória sem cair) e sino de ouro (derrotou o Campeão). Só enfeites. */
export const boxingPerks = (s: BoxingStats = readBoxingStats()): BoxPerks => ({ goldGloves: s.best === 'S', leopardCuffs: s.clean, goldBell: s.champion });

// ───────────────────────── tutorial ─────────────────────────
const TUT_KEY = 'karimbolandia.boxing.tut.v1';
/** o tutorial aparece nas primeiras vezes e some (a qualquer hora dá para chamar com ?tut=1 em QA) */
export const TUTORIAL_SHOWS = 2;

/** Quantas vezes o tutorial já foi visto até o fim ou pulado. */
export function tutorialSeen(): number {
  try { return count(JSON.parse(localStorage.getItem(TUT_KEY) ?? '0')); } catch { return 0; }
}
export function markTutorialSeen(): void {
  try { localStorage.setItem(TUT_KEY, JSON.stringify(tutorialSeen() + 1)); } catch { /* sem armazenamento: aparece sempre */ }
}
export const shouldShowTutorial = () => tutorialSeen() < TUTORIAL_SHOWS;
