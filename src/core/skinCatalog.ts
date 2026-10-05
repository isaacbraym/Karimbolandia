/** Trajes do Karimbo. `shop` diz onde se consegue; `perk` é o atributo especial (vazio = só visual). */
export const SKINS = [
  { id: 'classic', name: 'Clássico', price: 0, color: '#d2b892', shop: 'skins', perk: '', description: 'A camiseta bege e a papete de sempre.' },
  { id: 'explorer', name: 'Explorador', price: 100, color: '#96b561', shop: 'skins', perk: '', description: 'Colete de expedição, bolsos e botas para encarar a selva.' },
  { id: 'neon', name: 'Neon', price: 250, color: '#39f0ff', shop: 'skins', perk: '', description: 'Jaqueta escura, faixas ciano e detalhes em violeta.' },
  { id: 'diver', name: 'Traje de mergulho', price: 480, color: '#2b7bb9', shop: 'sivirino', perk: "Respira debaixo d'água", description: 'Neoprene, nadadeiras e capacete com ar comprimido. Só o Sivirino vende.' },
  { id: 'atlante', name: 'Atlante', price: 0, color: '#3fd6c0', shop: 'relics', perk: "Respira debaixo d'água e nada 30% mais rápido", description: 'Armadura de escamas de Atlântida. Só veste quem junta as 5 relíquias das ruínas.' },
  { id: 'jacare', name: 'Jacaré', price: 0, color: '#5f8a45', shop: 'boxing', perk: 'Fôlego +30%, nado +40% e vida +10%', description: 'Macacão de escamas, barriga listrada, rabo e o chapéu de caça: uma cabeça de jacaré usada de fantasia. Só veste quem vence o jacaré no boxe.' },
] as const;
export type SkinId = typeof SKINS[number]['id'];
export type SkinShop = typeof SKINS[number]['shop'];
export const isSkinId = (v: unknown): v is SkinId => SKINS.some(s => s.id === v);
const prices = Object.fromEntries(SKINS.map(s => [s.id, s.price])) as Record<SkinId, number>;
export const skinPrice = (id: SkinId) => prices[id];
export const skinInfo = (id: SkinId) => SKINS.find(s => s.id === id)!;
/**
 * Multiplicadores por traje. Fonte única: o Player não testa ids de skin espalhados.
 * `air` = fôlego (sem traje que respira), `swim` = velocidade de nado, `hp` = vida máxima.
 */
export const SKIN_PERKS: Record<SkinId, { air: number; swim: number; hp: number }> = {
  classic: { air: 1, swim: 1, hp: 1 }, explorer: { air: 1, swim: 1, hp: 1 }, neon: { air: 1, swim: 1, hp: 1 },
  diver: { air: 1, swim: 1, hp: 1 }, atlante: { air: 1, swim: 1.3, hp: 1 }, jacare: { air: 1.3, swim: 1.4, hp: 1.1 },
};
/**
 * Trajes que clientes antigos (em cache) não conhecem: nunca vão para o perfil principal nem para
 * o espelho da carteira (um cliente antigo invalidaria o perfil inteiro por causa deles); ficam
 * numa chave própria (storage.ts, `karimbolandia.rewards.v1`). Toda skin nova entra FORA desta lista.
 */
export const LEGACY_SKIN_IDS: readonly SkinId[] = ['classic', 'explorer', 'neon', 'diver', 'atlante'];
export const isLegacySkin = (id: SkinId) => LEGACY_SKIN_IDS.includes(id);
/** Trajes que deixam o Karimbo respirar debaixo d'água (sem barra de oxigênio). */
export const breathesUnderwater = (id: SkinId) => id === 'diver' || id === 'atlante';
