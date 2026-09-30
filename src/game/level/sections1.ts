import { THEME } from '../level';
import { G, type LevelBuilder } from './builder';

/** SEÇÃO 1 — ENTRADA NA CIDADE (0–96): tutorial natural de movimento, tiro e pulo. */
export function section1(b: LevelBuilder) {
  b.setTheme(THEME.STREET);
  b.ground(0, 96);
  b.playerStart = { x: b.px(4), y: b.py(G) };
  b.section('Entrada na cidade', 4, G);
  b.atmos(0, 0.0, 0);
  b.dress(0, 96, G, { seed: 1 });
  b.deco('arrow', 12, G);
  b.deco('banner', 62, G);
  b.deco('wreckCar', 74, G);
  b.deco('hologram', 50, G);
  b.deco('fireBarrel', 44, G);

  // dicas contextuais (aparecem uma vez e somem sozinhas)
  b.trigger('hint:move', 6, 0, 3, 46);
  b.trigger('hint:shoot', 26, 0, 3, 46);
  b.trigger('hint:jump', 46, 0, 3, 46);
  b.trigger('hint:swap', 96, 0, 3, 46);

  b.tokens(14, G - 1, 8);
  b.crate(30, G, 'tokens');
  b.crate(31, G, 'none');
  // alvo parado: primeiro tiro
  b.enemy('rifle', 40, G, { idle: true, facing: -1 });
  // primeiro salto: buraco pequeno + degraus
  b.pit(52, 55);
  b.tokenArc(51, G - 1, 56, G - 4, 7);
  b.plat(58, 30, 3);
  b.plat(62, 28, 3);
  b.tokens(58, 29, 3);
  b.tokens(62, 27, 3);
  // soldado patrulhando + caixa de vida + barricada
  b.enemy('rifle', 68, G, { patrol: 60 });
  b.crate(72, G, 'health');
  b.prop('barricade', 82, G);
  b.enemy('rifle', 85, G, { facing: -1, idle: true });
  b.tokens(88, G - 1, 4);
}

/** SEÇÃO 2 — PRIMEIROS SOLDADOS (96–224): combates pequenos, cobertura, primeiros itens. */
export function section2(b: LevelBuilder) {
  b.setTheme(THEME.STREET);
  b.ground(96, 224);
  b.section('Primeiros soldados', 100, G);
  b.atmos(96, 0.05, 0);
  b.dress(96, 224, G, { seed: 2 });

  // grupo A
  b.prop('container', 112, G);
  b.crate(118, G, 'ammo');
  b.enemy('rifle', 122, G, { patrol: 40, facing: -1 });
  b.enemy('rifle', 127, G, { facing: -1 });
  b.tokens(104, G - 1, 5);
  // grupo B
  b.prop('barricade', 134, G);
  b.prop('barricade', 141, G);
  b.enemy('rifle', 137, G, { idle: true, facing: -1 });
  b.enemy('shotgun', 147, G, { patrol: 30, facing: -1 });
  b.crate(144, G, 'random');
  b.pickup('health', 150, G - 1);
  // grupo C: cobertura alta
  b.prop('container', 160, G);
  b.enemy('rifle', 160, 30, { idle: true, facing: -1 }); // em cima do container
  b.enemy('rifle', 168, G, { patrol: 30 });
  b.plat(168, 29, 6);
  b.crate(171, 29, 'rifle'); // caixa da arma (rifle) em cima da plataforma
  b.tokens(169, 28, 4);
  b.emblem(2, 174, 28); // emblema visível em cima da plataforma
  b.enemy('shotgun', 176, G, { patrol: 30, facing: -1 });
  // rota alta opcional pelos telhados (grupos B–C): moedas, caixa e dois atiradores
  b.plat(146, 30, 3);
  b.plat(150, 28, 4);
  b.plat(156, 26, 14);
  b.plat(172, 26, 6);
  b.tokens(157, 25, 12);
  b.crate(160, 26, 'random');
  b.enemy('rifle', 164, 26, { patrol: 30, facing: -1 });
  b.enemy('rifle', 174, 26, { facing: -1, idle: true });
  b.deco('neonSign', 168, 24);
  // grupo D
  b.prop('barricade', 184, G);
  b.prop('barricade', 192, G);
  b.prop('barricade', 199, G);
  b.enemy('rifle', 187, G, { facing: -1 });
  b.enemy('rifle', 195, G, { facing: -1 });
  b.enemy('rifle', 202, G, { patrol: 30 });
  b.enemy('drone', 197, G - 6, { patrol: 80 });
  b.crate(190, G, 'nade');
  b.crate(206, G, 'health');
  b.tokenArc(209, G - 1, 216, G - 4, 8);
  // calmaria e checkpoint
  b.checkpoint('Rua principal', 219, G);
  b.crate(214, G, 'ammo');
}

/** SEÇÃO 3 — VERTICALIDADE (224–352): rota alta/baixa, ponte, primeiro glide. */
export function section3(b: LevelBuilder) {
  b.setTheme(THEME.STEEL);
  b.section('Verticalidade', 226, G);
  b.atmos(224, 0.15, 0);
  b.ground(224, 296);
  b.dress(224, 352, G, { seed: 3, noFacade: false });

  // escada até a ponte (rota alta)
  b.plat(238, 30, 3);
  b.plat(243, 28, 3);
  b.plat(248, 26, 3);
  b.plat(253, 24, 28); // ponte
  b.plat(282, 26, 3);
  b.plat(286, 28, 3);
  b.plat(290, 30, 3);
  b.tokens(255, 23, 10);
  b.emblem(3, 279, 23); // recompensa da rota alta
  b.enemy('rifle', 262, 24, { patrol: 40 });
  b.enemy('rifle', 270, 24, { facing: -1 });
  b.enemy('drone', 266, 19, { patrol: 100 });
  b.crate(274, 24, 'random');
  // rota baixa
  b.prop('barrel', 246, G);
  b.prop('barrel', 247, G);
  b.enemy('rifle', 250, G, { patrol: 40, facing: -1 });
  b.enemy('shotgun', 260, G, { patrol: 30 });
  b.prop('barricade', 268, G);
  b.enemy('rifle', 272, G, { idle: true, facing: -1 });
  b.crate(278, G, 'ammo');
  b.tokens(230, G - 1, 6);

  // buraco do PLANEIO (Ear Glide): 8 tiles — a trajetória de moedas mostra o caminho
  b.pit(296, 304);
  b.trigger('hint:glide', 290, 0, 3, 46);
  b.trigger('hint:slam', 318, 0, 3, 46);
  b.trigger('hint:melee', 140, 0, 3, 46);
  b.tokenArc(295, G - 2, 305, G - 9, 10);
  b.ground(304, 352);
  b.dress(296, 352, G, { seed: 33 });
  // pós-buraco
  b.enemy('rifle', 312, G, { patrol: 30, facing: -1 });
  b.enemy('jetpack', 322, G - 5, {});
  b.prop('container', 330, G);
  b.enemy('rifle', 330, 30, { idle: true, facing: -1 });
  b.enemy('shotgun', 338, G, { patrol: 30 });
  b.enemy('drone', 344, G - 6, { patrol: 60 });
  b.crate(334, G, 'random');
  b.crate(348, G, 'health');
  b.tokens(316, G - 1, 5);
}

/** SEÇÃO 4 — PRIMEIRO SEGREDO (352–420): vale escondido, ninho de sniper, exploração. */
export function section4(b: LevelBuilder) {
  b.setTheme(THEME.RUINS);
  b.section('Primeiro segredo', 354, G);
  b.atmos(352, 0.2, 0.2);
  b.ground(352, 420);
  b.dress(352, 420, G, { seed: 4, ruin: true });

  // torre de escalada com ninho de sniper (emblema 0)
  b.plat(360, 30, 3);
  b.plat(364, 28, 3);
  b.plat(368, 26, 3);
  b.plat(372, 24, 3);
  b.block(376, 22, 8, 2);
  b.enemy('sniper', 381, 22, { facing: -1 });
  b.emblem(0, 378, 21);
  b.tokens(361, 29, 2);
  b.tokens(365, 27, 2);
  b.tokens(369, 25, 2);
  b.crate(377, 22, 'random');
  // K0 — ORELHA DOURADA: ilha vista do ninho do sniper, só alcançável planando
  b.plat(393, 22, 5);
  b.secret(0, 395, 21);
  b.tokens(386, 21, 5);

  // rua: spiders e torreta
  b.enemy('spider', 392, G, {});
  b.enemy('spider', 398, G, {});
  b.enemy('turret', 405, G, { facing: -1 });
  b.prop('barricade', 396, G);
  b.crate(388, G, 'ammo');
  b.enemy('rifle', 410, G, { patrol: 30 });

  // vale com parede rachada: câmara secreta com emblema 1 (quebre a parede a tiros)
  const ch = b.pocket(340, { id: 'secret1', w: 8, chamberW: 10 });
  void ch;
  b.emblem(1, 351, 35);
  b.tokens(346, 35, 3);
  b.deco('arrow', 343, G - 1);
  b.checkpoint('Ruínas', 416, G);
  b.crate(414, G, 'ammo');
}
