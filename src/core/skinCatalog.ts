export const SKINS = [
  { id: 'classic', name: 'Clássico', price: 0, color: '#d2b892', description: 'A camiseta bege e a papete de sempre.' },
  { id: 'explorer', name: 'Explorador', price: 100, color: '#96b561', description: 'Colete de expedição, bolsos e botas para encarar a selva.' },
  { id: 'neon', name: 'Neon', price: 250, color: '#39f0ff', description: 'Jaqueta escura, faixas ciano e detalhes em violeta.' },
] as const;
export type SkinId = typeof SKINS[number]['id'];
export const isSkinId = (v: unknown): v is SkinId => SKINS.some(s => s.id === v);
const prices = Object.fromEntries(SKINS.map(s => [s.id, s.price])) as Record<SkinId, number>;
export const skinPrice = (id: SkinId) => prices[id];
