/** Morros e passagens: pintura preparada no cache de decorações, sem bakes na animação. */
import { Rng } from '../core/math';
import { foliage, JUNGLE_LEAVES, CITY_LEAVES } from './foliage';
import { moundRise } from '../game/level';

export const PASSAGE_BOUNDS: Record<string, [number, number, number, number]> = {
  passageMound: [-570, -330, 265, 22],
  passageRoom: [0, -288, 832, 140],
  passageExit: [-45, -125, 45, 2],
};

/** Ruínas em um plano recuado, com alturas e silhuetas diferentes. */
export function paintTempleRuins(g: CanvasRenderingContext2D, seed: number) {
  const r = new Rng(seed + 719);
  g.save(); g.globalAlpha = .65;
  for (const [x, height, width] of [[-143, 219, 62], [-20, 302, 75], [142, 254, 65]]) {
    const stone = g.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
    stone.addColorStop(0, '#3e6662'); stone.addColorStop(.5, '#7e9980'); stone.addColorStop(1, '#496c63');
    g.fillStyle = stone; g.beginPath(); g.moveTo(x - width / 2, 0); g.lineTo(x - width * .43, -height + 30);
    g.lineTo(x - 17, -height + 28); g.lineTo(x - 12, -height + 7); g.lineTo(x - 1, -height + 14);
    g.lineTo(x + 8, -height); g.lineTo(x + 19, -height + 24); g.lineTo(x + width * .4, -height + 34);
    g.lineTo(x + width / 2, 0); g.closePath(); g.fill();
    g.strokeStyle = '#9bb29a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - width * .43, -height + 35); g.lineTo(x + width * .4, -height + 36); g.stroke();
    for (let y = -height + 68; y < -10; y += 26) {
      g.strokeStyle = '#40645b'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - width * .43, y); g.lineTo(x + width * .44, y); g.stroke();
    }
    arch(g, x, -height + 129, 27, 58); g.fillStyle = '#264f50'; g.fill();
    g.strokeStyle = '#94ab88'; g.lineWidth = 3; g.stroke();
  }
  arch(g, 65, 0, 153, 166); g.strokeStyle = '#6f8e7c'; g.lineWidth = 15; g.stroke();
  g.strokeStyle = '#8da188'; g.lineWidth = 3; g.stroke();
  for (let i = 0; i < 130; i++) {
    g.fillStyle = '#50745e'; g.globalAlpha = r.range(.2, .6);
    g.beginPath(); g.ellipse(r.range(-175, 170), r.range(-200, -24), r.range(1, 4), r.range(1, 3), 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function arch(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - h + w / 2);
  g.arc(x, y - h + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w / 2, y); g.closePath();
}

function masonryArch(g: CanvasRenderingContext2D, forest: boolean) {
  arch(g, 0, 1, 126, 176); g.fillStyle = forest ? '#47685a' : '#61576c'; g.fill();
  g.strokeStyle = forest ? '#83a385' : '#ad998e'; g.lineWidth = 5; g.stroke();
  arch(g, 0, 1, 90, 151); g.fillStyle = '#12212b'; g.fill();
  g.strokeStyle = forest ? '#243c37' : '#292538'; g.lineWidth = 4; g.stroke();
  // Pedras do arco seguem a curva; lados assentados no chão.
  const cy = -113;
  g.strokeStyle = forest ? '#253e38' : '#393440'; g.lineWidth = 2;
  for (let i = 0; i <= 9; i++) {
    const a = Math.PI + i / 9 * Math.PI;
    g.beginPath(); g.moveTo(Math.cos(a) * 47, cy + Math.sin(a) * 47);
    g.lineTo(Math.cos(a) * 62, cy + Math.sin(a) * 62); g.stroke();
  }
  for (const side of [-1, 1]) for (let y = -97; y < 0; y += 23) {
    g.beginPath(); g.moveTo(side * 46, y); g.lineTo(side * 63, y - 2); g.stroke();
  }
  const deep = g.createLinearGradient(-36, 0, 40, -140);
  deep.addColorStop(0, forest ? '#255344' : '#324555'); deep.addColorStop(.4, '#10282b'); deep.addColorStop(1, '#070f19');
  arch(g, 0, 0, 78, 142); g.fillStyle = deep; g.fill();
  // Caminho que entra em perspectiva em vez de uma porta colada à fachada.
  g.fillStyle = forest ? '#667851' : '#55556a';
  g.beginPath(); g.moveTo(-43, 0); g.lineTo(42, 0); g.lineTo(15, -23); g.lineTo(-7, -23); g.closePath(); g.fill();
  g.strokeStyle = '#829889'; g.globalAlpha = .4; g.beginPath(); g.moveTo(-32, -4); g.lineTo(29, -4); g.stroke(); g.globalAlpha = 1;
}

function clock(g: CanvasRenderingContext2D, x: number, y: number, forest: boolean) {
  g.save(); g.translate(x, y); g.fillStyle = '#232b32'; g.beginPath(); g.arc(0, 0, 27, 0, Math.PI * 2); g.fill();
  g.strokeStyle = forest ? '#9ca67b' : '#a38b73'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#d9d3ac'; g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#445654'; g.lineWidth = 2;
  for (let i = 0; i < 12; i++) { const a = i / 6 * Math.PI; g.beginPath(); g.moveTo(Math.sin(a) * 16, Math.cos(a) * 16); g.lineTo(Math.sin(a) * 19, Math.cos(a) * 19); g.stroke(); }
  g.lineWidth = 3; g.beginPath(); g.moveTo(-9, -7); g.lineTo(0, 0); g.lineTo(3, -14); g.stroke();
  // Uma rachadura e ponteiros parados são a referência discreta ao tempo perdido.
  g.strokeStyle = '#8b917e'; g.lineWidth = 1; g.beginPath(); g.moveTo(13, -16); g.lineTo(8, -6); g.lineTo(13, 4); g.stroke(); g.restore();
}

function mound(g: CanvasRenderingContext2D, style: number, r: Rng) {
  const forest = style < 2, pal = forest ? JUNGLE_LEAVES : CITY_LEAVES;
  const crest = (x: number) => -moundRise(x, forest);
  g.save();
  // Assimetria: subida longa à esquerda, aba de pedra sobre a entrada no pé à direita.
  g.beginPath(); g.moveTo(-550, 7);
  for (let x = -550; x <= 174; x += 4) g.lineTo(x, crest(x));
  g.bezierCurveTo(197, -145, 233, -122, 211, -73);
  g.bezierCurveTo(187, -53, 228, -32, 220, 15);
  g.lineTo(-550, 18); g.closePath();
  const earth = g.createLinearGradient(0, -295, 0, 16);
  earth.addColorStop(0, forest ? '#648357' : '#46705b'); earth.addColorStop(.48, forest ? '#3f5c43' : '#344956');
  earth.addColorStop(1, forest ? '#243b30' : '#242d3d'); g.fillStyle = earth; g.fill(); g.clip();
  // Rochas irregulares recuadas, fendas, líquen e capim quebram a silhueta lisa.
  for (let i = 0; i < 35; i++) {
    const x = r.range(-470, 220), y = r.range(-208, 28), w = r.range(20, 84), h = r.range(25, 85);
    g.fillStyle = r.pick(forest ? ['#53634c', '#3b5042', '#718064', '#304537'] : ['#444556', '#54576a', '#37464f']);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * .15, y - h); g.lineTo(x + w * .73, y - h * .92);
    g.lineTo(x + w, y - h * .4); g.lineTo(x + w * .86, y + 6); g.closePath(); g.fill();
    g.strokeStyle = forest ? '#213f32' : '#29303b'; g.lineWidth = 2; g.stroke();
    g.strokeStyle = forest ? '#849371' : '#6d6878'; g.beginPath(); g.moveTo(x + w * .15, y - h); g.lineTo(x + w * .73, y - h * .92); g.stroke();
  }
  for (let i = 0; i < 4500; i++) {
    const x = r.range(-550, 235), y = r.range(-280, 22);
    const nearTop = y < crest(x) + 50;
    g.fillStyle = nearTop ? r.pick(['#86a263', '#63834f', '#adc580', '#526f44']) : r.pick(['#385541', '#4b684b', '#738263', '#2d493c']);
    g.globalAlpha = r.range(.1, .35); g.beginPath(); g.ellipse(x, y, r.range(1, 6), r.range(.7, 2.5), r.range(-1, 1), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  // Alvenaria antiga aparece por baixo do jardim urbano.
  if (!forest) {
    g.strokeStyle = '#817375'; g.lineWidth = 1; g.globalAlpha = .35;
    for (let y = -150; y < 2; y += 20) {
      g.beginPath(); g.moveTo(-210, y); g.lineTo(150, y); g.stroke();
      for (let x = -200 + (y % 40 ? 20 : 0); x < 150; x += 42) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 20); g.stroke(); }
    }
    g.globalAlpha = 1;
  }
  g.restore();
  // Capim em tufos acompanha a silhueta curva.
  g.strokeStyle = forest ? '#739659' : '#6ca883'; g.lineWidth = 1.5;
  for (let x = -546; x < 176; x += r.range(2, 5)) {
    const y = crest(x); g.beginPath(); g.moveTo(x, y + 4); g.quadraticCurveTo(x - 2, y - 7, x + r.range(-5, 6), y - r.range(5, 15)); g.stroke();
  }
  for (const [x, y, s] of [[-364, -178, .45], [-223, -239, .4], [145, -149, .45], [210, -85, .3]]) {
    foliage(g, r, x, y, 45 * s, pal);
  }
  // Musgo em cascata: áreas orgânicas opacas cobrem parte das pedras, com bordas irregulares.
  if (forest) {
    for (let x = -445; x < 175; x += r.range(24, 42)) {
      const top = crest(x) + 18, length = r.range(38, 115);
      g.fillStyle = r.pick(['#435f3c', '#4d6f42', '#3b5937']);
      g.beginPath(); g.moveTo(x - 22, top - 12); g.quadraticCurveTo(x + 22, top - 25, x + 30, top + 10);
      g.bezierCurveTo(x + 14, top + length, x - 7, top + length + 12, x - 17, top + 25); g.closePath(); g.fill();
      for (let i = 0; i < 35; i++) {
        const yy = r.range(top, top + length), xx = x + r.range(-10, 14);
        g.fillStyle = r.pick(['#6b854e', '#779658', '#567447']); g.globalAlpha = .5;
        g.beginPath(); g.ellipse(xx, yy, r.range(1, 5), r.range(1, 3), 0, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    }
  }
  // Raízes abraçam a abertura e deixam o limiar visível.
  if (forest) {
    for (const side of [-1, 1]) {
      g.strokeStyle = '#273c2c'; g.lineWidth = 15; g.lineCap = 'round';
      g.beginPath(); g.moveTo(side * 106, -224); g.bezierCurveTo(side * 92, -146, side * 152, -63, side * 115, 0); g.stroke();
      g.strokeStyle = '#75865a'; g.lineWidth = 3; g.stroke();
      for (let i = 0; i < 7; i++) {
        const y = -175 + i * 24, x = side * (108 + Math.sin(i) * 10);
        foliage(g, r, x, y, 16, pal);
      }
    }
  }
  // Cavidade mais larga que o arco: sombra e recuo tornam a entrada legível.
  arch(g, 0, 5, 172, 205); g.fillStyle = forest ? '#1a3027' : '#212b38'; g.fill();
  masonryArch(g, forest);
  if (style === 0 || style === 2) clock(g, -8, -212, forest);
  else {
    g.strokeStyle = '#8caf8c'; g.lineWidth = 2; g.beginPath(); g.moveTo(-13, -196); g.quadraticCurveTo(3, -221, 16, -198); g.stroke();
    foliage(g, r, 0, -211, 10, pal);
  }
  // Pontos luminosos discretos na abertura escura.
  for (let i = 0; i < 8; i++) { g.fillStyle = forest ? '#c6cf7e' : '#c3b49c'; g.globalAlpha = .25; g.fillRect(r.range(-25, 25), r.range(-100, -28), 2, 2); }
  g.globalAlpha = 1;
  for (const side of [-1, 1]) foliage(g, r, side * 112, -3, 31, pal);
}

function room(g: CanvasRenderingContext2D, style: number, r: Rng) {
  const forest = style < 2;
  const wall = g.createLinearGradient(0, -288, 0, 0);
  wall.addColorStop(0, forest ? '#112a2b' : '#202435'); wall.addColorStop(.65, forest ? '#234138' : '#3b3849'); wall.addColorStop(1, '#1a252b');
  g.fillStyle = wall; g.fillRect(0, -288, 832, 288);
  for (let y = -280; y < -10; y += 32) for (let x = (y % 64 ? -30 : 0); x < 832; x += 64) {
    g.fillStyle = r.pick(forest ? ['#2e4940', '#324d42', '#29453f'] : ['#484253', '#403d4e', '#504659']);
    g.globalAlpha = .4; g.fillRect(x + 2, y + 2, 60, 28);
  }
  g.globalAlpha = 1;
  for (const x of [228, 424, 622]) {
    arch(g, x, -34, 148, 222); g.fillStyle = '#142c2d'; g.fill(); g.strokeStyle = forest ? '#526f58' : '#6e6370'; g.lineWidth = 6; g.stroke();
    arch(g, x, -36, 124, 205); g.fillStyle = '#0d1e28'; g.fill();
    const glow = g.createRadialGradient(x, -123, 0, x, -123, 150);
    glow.addColorStop(0, forest ? '#7e996259' : '#efbb7244'); glow.addColorStop(1, '#789a6a00'); g.fillStyle = glow; g.fillRect(x - 150, -280, 300, 270);
  }
  // Objetos diferentes em cada descoberta, todos sobre o piso.
  clock(g, 423, -208, forest);
  if (style === 0 || style === 2) {
    g.fillStyle = forest ? '#475f49' : '#6e5463'; g.fillRect(379, -120, 90, 16); g.fillRect(388, -104, 8, 100); g.fillRect(452, -104, 8, 100);
    g.fillStyle = '#c8b48c'; g.fillRect(390, -133, 44, 11); g.fillStyle = '#6c9993'; g.fillRect(432, -142, 13, 23);
    g.fillStyle = '#cfbf97'; g.fillRect(501, -180, 101, 46); g.fillStyle = '#46575b'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center';
    g.fillText(style === 0 ? 'O TEMPO FICOU AQUI' : 'ÚLTIMO TREM: ONTEM', 551, -161); g.fillText('SEM PRESSA', 551, -145);
  } else {
    for (const x of [270, 385, 495, 610]) {
      g.fillStyle = '#8b6658'; g.beginPath(); g.moveTo(x - 20, -32); g.lineTo(x + 20, -32); g.lineTo(x + 13, -2); g.lineTo(x - 13, -2); g.closePath(); g.fill();
      foliage(g, r, x, -47, 28, forest ? JUNGLE_LEAVES : CITY_LEAVES);
    }
    g.fillStyle = '#b3a782'; g.fillRect(335, -130, 178, 42); g.fillStyle = '#324e47'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center';
    g.fillText(style === 1 ? 'GUARDE SEMENTES' : 'PLANTAR É RESISTIR', 424, -105);
  }
  // Bordas com raízes, folhagens e profundidade; centro livre para andar e ler as pistas.
  if (forest) for (const x of [16, 805]) {
    g.strokeStyle = '#61744b'; g.lineWidth = 9; g.beginPath(); g.moveTo(x, -288); g.bezierCurveTo(x + 60, -212, x - 35, -130, x + 15, -7); g.stroke();
    for (let y = -265; y < -40; y += 48) foliage(g, r, x + 12, y, 25, JUNGLE_LEAVES);
  }
  g.fillStyle = forest ? '#607355' : '#5c596b'; g.fillRect(0, -17, 832, 17);
  const soil = g.createLinearGradient(0, 0, 0, 140);
  soil.addColorStop(0, forest ? '#3b5140' : '#343544'); soil.addColorStop(1, '#101d26');
  g.fillStyle = soil; g.fillRect(0, 0, 832, 140);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = forest ? '#678168' : '#747082'; g.globalAlpha = .15;
    g.beginPath(); g.ellipse(r.range(0, 832), r.range(8, 110), r.range(1, 5), r.range(1, 3), 0, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = forest ? '#81946b' : '#8b8390'; g.lineWidth = 1;
  for (let x = 0; x < 832; x += 48) { g.beginPath(); g.moveTo(x, -17); g.lineTo(x - 8, 0); g.stroke(); }
}

export function paintPassage(g: CanvasRenderingContext2D, kind: string, style: number) {
  if (!PASSAGE_BOUNDS[kind]) return false;
  const r = new Rng(style * 7919 + 421);
  if (kind === 'passageMound') mound(g, style, r);
  else if (kind === 'passageRoom') room(g, style, r);
  else {
    arch(g, 0, 0, 76, 120); g.fillStyle = '#647d70'; g.fill();
    arch(g, 0, 0, 56, 104); g.fillStyle = '#0b252b'; g.fill();
    g.fillStyle = '#d8d9b5'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText('↑ VOLTAR', 0, -75);
  }
  return true;
}
