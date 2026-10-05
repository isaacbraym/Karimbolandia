/** Identidade autorada: a mesma variante define fachada, porta e planta; não depende do relevo. */
export const HOME_NAMES = ['Dona Benedita', 'Seu Damião', 'Luzia', 'Tiago', 'Dona Celina', 'Bento',
  'Rosa', 'Jandira', 'Zeca', 'Marina', 'Dona Iara', 'Tonho', 'Nair', 'Chico', 'Dona Lídia',
  'Bia', 'Raul', 'Dona Olívia', 'Neco', 'Lena', 'Seu Abel', 'Dora', 'Raimundo', 'Cida',
  'Dona Amélia', 'Vicente', 'Lia', 'Seu Jonas', 'Nina', 'Dona Aurora'] as const;
export const HOME_TRADES = ['Tecelagem', 'Cerâmica', 'Horta e sementes', 'Marcenaria', 'Pesca', 'Música'] as const;
export function buildingStyle(index: number, mercenary = false) {
  const floors = index > 0 && index % 3 === 1 ? 2 : 1;
  const cols = mercenary ? 8 + index * 2 : 6 + index % 5;
  const rows = mercenary ? 6 + index : 5 + Math.floor(index / 5);
  return { index, floors, cols, rows, width: mercenary ? 112 + index * 24 : 108 + index % 5 * 16,
    wall: 78 + (floors - 1) * 76, depth: 32 + index % 4 * 7,
    door: -16 + index % 5 * 8, roof: index % 3,
    color: ['#b79a68', '#b57656', '#8faaa0', '#d0bc87', '#879ab1', '#c69c8f'][index % 6],
    accent: ['#3e7c78', '#944b47', '#597438', '#416e99', '#a2683e', '#775789'][index % 6] };
}
