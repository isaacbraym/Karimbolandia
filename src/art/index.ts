/** Registro central de arte: constrói (uma vez) todos os sprites do jogo. */
import { loadPhotos, bakeKarimboHeads, type Photos } from './photo';
import { bakeKarimbo, type KarimboArt } from './karimbo';
import { bakeNomad, type NomadArt } from './nomad';
import { bakeFelipao, type FelipaoArt } from './felipao';
import { bakeSoldier, type SoldierArt, type SoldierStyle } from './soldiers';
import { bakeRobots, type RobotArt } from './robots';
import { bakeTiles, type TileArt } from './tiles';
import { bakeProps, bakePickups } from './props';
import { Background } from './background';
import { getJungle } from './jungle';
import type { JungleBackground } from './jungleBg';
import { setArtScale, whiteOf, glowSprite, softDot, type Sprite } from './kit';
import type { PropKind, PickupKind } from '../game/level';

export interface Art {
  photos: Photos;
  karimbo: KarimboArt;
  nomad: NomadArt;
  felipao: FelipaoArt;
  soldiers: Record<SoldierStyle, SoldierArt>;
  robots: RobotArt;
  tiles: TileArt;
  props: Record<PropKind, Sprite>;
  pickups: Record<PickupKind, Sprite>;
  bg: Background;
}

let art: Art | null = null;

/** Gera a máscara branca de todo sprite de um grupo de arte (objetos com c/w/h/ox/oy). */
function warmWhites(group: unknown) {
  if (!group || typeof group !== 'object') return;
  for (const [k, v] of Object.entries(group as Record<string, unknown>)) {
    if (k === 'body' || k === 'wreck') continue; // foto inteira legada / carcaça: nunca piscam
    const sp = v as Partial<Sprite> | null;
    if (sp && typeof sp === 'object' && sp.c instanceof HTMLCanvasElement && typeof sp.ox === 'number') whiteOf(sp as Sprite);
  }
}

export function getArt(): Art {
  if (!art) throw new Error('Arte ainda não carregada');
  return art;
}
export const artReady = () => art !== null;

/** Fase em jogo: a selva (2) troca o fundo e veste os inimigos humanos como bandidos. */
let artStage = 1;
export function setArtStage(s: number) {
  artStage = s;
}
export function soldierSet(variant = 0): Record<SoldierStyle, SoldierArt> {
  const j = artStage === 2 ? getJungle() : null;
  return j ? j.banditVariants[Math.abs(variant) % j.banditVariants.length] : getArt().soldiers;
}
export function stageBg(): Background | JungleBackground {
  const j = artStage === 2 ? getJungle() : null;
  return j ? j.bg : getArt().bg;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export type Quality = 'low' | 'medium' | 'high';

/** Baixa as fotos e "asa" todos os sprites, cedendo ao navegador entre etapas (barra de carregamento). */
export async function buildArt(base: string, quality: Quality, onProgress: (p: number, label: string) => void): Promise<Art> {
  if (art) return art;
  const scale = quality === 'high' ? 3 : quality === 'medium' ? 2 : 2;
  setArtScale(scale);
  onProgress(0.02, 'Baixando personagens...');
  const photos = await loadPhotos(base, (p) => onProgress(0.02 + p * 0.28, 'Baixando personagens...'));
  const steps: [string, () => void][] = [];
  const out: Partial<Art> = { photos };
  steps.push(['Montando Karimbo...', () => {
    const heads = bakeKarimboHeads(photos, quality === 'low' ? 2 : 3);
    out.karimbo = bakeKarimbo(heads);
  }]);
  steps.push(['Preparando os trajes...', () => {
    const classic = out.karimbo!;
    classic.variants = { classic, explorer: bakeKarimbo(classic.heads, 'explorer', classic), neon: bakeKarimbo(classic.heads, 'neon', classic),
      diver: bakeKarimbo(classic.heads, 'diver', classic), atlante: bakeKarimbo(classic.heads, 'atlante', classic),
      jacare: bakeKarimbo(classic.heads, 'jacare', classic) };
    for (const variant of Object.values(classic.variants)) warmWhites(variant);
    warmWhites(classic.heads);
    warmWhites(classic.weapons);
  }]);
  steps.push(['Ligando o Nômad...', () => { out.nomad = bakeNomad(photos); }]);
  steps.push(['Equipando o Felipão...', () => { out.felipao = bakeFelipao(photos); }]);
  steps.push(['Convocando a Legião...', () => {
    out.soldiers = { rifle: bakeSoldier('rifle'), shotgun: bakeSoldier('shotgun'), shield: bakeSoldier('shield'), jetpack: bakeSoldier('jetpack'), sniper: bakeSoldier('sniper') };
    out.robots = bakeRobots();
  }]);
  steps.push(['Construindo a cidade...', () => { out.tiles = bakeTiles(); }]);
  steps.push(['Espalhando caixas e tesouros...', () => { out.props = bakeProps(); out.pickups = bakePickups(); }]);
  steps.push(['Pintando o horizonte...', () => { out.bg = new Background(quality === 'high' ? 1.5 : quality === 'medium' ? 1.25 : 1); }]);
  // máscaras brancas do "pisca" ao levar dano e brilhos mais usados: prontos antes de jogar
  // (gerar na hora o branco dos sprites grandes do Felipão/Nômad dava um engasgo no primeiro tiro)
  steps.push(['Aquecendo os efeitos...', () => {
    for (const group of [out.felipao, out.nomad, out.robots, ...Object.values(out.soldiers ?? {})]) warmWhites(group);
    for (const c of ['#ffffff', '#ffd27a', '#ffb347', '#ff7a1a', '#ff8a3a', '#ff3a2a', '#39f0ff', '#7ff9ff', '#ffe27a', '#ff9a4a', '#ffb060', '#ff4a4a']) glowSprite(c, 32);
    for (const c of ['#000000', '#ffffff', '#b9b0c8', '#ffd27a', '#ff7a1a']) softDot(c, 16);
  }]);
  for (let i = 0; i < steps.length; i++) {
    onProgress(0.3 + (i / steps.length) * 0.7, steps[i][0]);
    await tick();
    steps[i][1]();
  }
  onProgress(1, 'Pronto!');
  art = out as Art;
  return art;
}
