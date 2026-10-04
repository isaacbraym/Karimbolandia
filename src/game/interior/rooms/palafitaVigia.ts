/**
 * PALAFITA DO VIGIA (fase 2). Furtividade cômica: o Cabo Ronco, de folga, dorme na rede com o
 * chapéu no rosto. Tábuas rangem, o rádio ligado abafa os passos, cadarços amarrados o fazem
 * tropeçar na perseguição. Cada coisa tem uma piada e quase todas têm consequência.
 */
import type { FurnitureDef, PrankDef, RoomDef, VerbDef } from '../types';
import type { InteriorSim } from '../sim';
import { makeSleeper } from '../brains/sleeper';

const cabo = (s: InteriorSim) => s.npc('cabo');
const caboHere = (s: InteriorSim) => !s.has('caboGone');
const caboAsleep = (s: InteriorSim) => { const n = cabo(s); return !!n && !n.away && (n.state === 'asleep' || n.state === 'stirring'); };

const shout = (s: InteriorSim, f: FurnitureDef, text: string) => (text.length > 110 ? s.read(f.name, text) : s.say(text));
const examine = (text: string | ((s: InteriorSim) => string)): VerbDef => ({
  id: 'examine', label: 'Examinar', noise: 0, time: 0.5, pose: 'idle',
  run: (s, f) => shout(s, f, typeof text === 'string' ? text : text(s)),
});

/** Gaveta/baú do modal antigo: abre primeiro, depois recolhe a reserva (a economia é a mesma de Exploration). */
function reserve(obj: 'drawer' | 'chest', openNoise: number, flavor: string): FurnitureDef['verbs'] {
  return (s) => {
    const open = s.host.legacy(obj, 'open'), done = s.host.legacy(obj, 'done');
    if (!open) return [{ id: 'open', label: obj === 'drawer' ? 'Abrir gaveta' : 'Abrir baú', noise: openNoise, time: 0.8, pose: 'take', run: (ss, f) => {
      ss.legacy(obj); ss.pop(obj === 'drawer' ? 'RÁÁNC!' : 'BLONG!', f.gx + f.w / 2, f.gy + f.h / 2); ss.sfx('creak', 0.6); ss.fx('dust', f.gx + f.w / 2, f.gy + f.h / 2, 4);
    } }];
    if (!done) return [{ id: 'rummage', label: 'Fuçar', noise: 8, time: 1, pose: 'take', run: (ss, f) => { ss.legacy(obj); ss.fx('crumbs', f.gx + f.w / 2, f.gy + f.h / 2, 3); } }];
    return [examine(flavor)];
  };
}

const RADIO = [
  'Rádio: "Atenção, tropa: o plano de saúde cobre apenas a parte saudável."',
  'Rádio: "Operação Panela Fria suspensa por falta de talheres."',
  'Rádio: "Três nós vermelhos na ponte... repito, três nós vermelhos."',
  'Rádio: "A previsão é de chuva, sereno e burocracia. Boa noite, tropa."',
];

const furniture: FurnitureDef[] = [
  {
    id: 'armeiro', name: 'Armeiro e manutenção', paint: 'weaponRack', gx: 0, gy: 0, w: 2, h: 1, tall: true, height: 58,
    verbs: () => [
      examine('Armas limpas, coronhas remendadas e um aviso: "Não apontar para colegas sem preencher formulário". Um caderno ensina a contar cartuchos antes de recarregar. A última página diz: "a oficina do Sivirino cobra, mas pelo menos entrega".'),
      { id: 'take', label: 'Pegar arma', noise: 6, time: 0.7, pose: 'take', run: (s, f) => { s.pop('CLANK!', f.gx + 1, f.gy + 0.5, '#bfe8ff'); s.say(s.line('rack', ['Presa com corrente. Até a corrente deles é burocrática.', 'Cadeado, corrente e um formulário. Melhor não.']), 'karimbo', 2.6); s.sfx('spark', 0.5); } },
    ],
  },
  {
    id: 'portrait', name: 'Retrato do capitão', paint: 'portrait', gx: 3, gy: 0, w: 1, h: 1, solid: false, wall: { side: 'right', z: 44, w: 44, h: 52 },
    look: (s) => (s.has('mustache') ? 'mustache' : ''),
    verbs: (s) => {
      const v: VerbDef[] = [{ id: 'examine', label: 'Examinar', noise: 0, time: 0.6, pose: 'idle', run: (ss) => ss.legacy('portrait') }];
      if (!s.has('mustache')) v.push({ id: 'prank', label: 'Desenhar bigode', noise: 3, time: 1.3, pose: 'poke', run: (ss, f) => {
        ss.set('mustache'); ss.pop('RABISCO!', f.gx + 0.5, 0.5, '#ffd24a'); ss.fx('sparkle', f.gx + 0.5, 0.8, 5);
        ss.say('Agora ele parece um capitão de confiança.', 'karimbo', 2.8); ss.sfx('pickup', 0.45);
      } });
      return v;
    },
  },
  {
    id: 'window', name: 'Janela do pântano', paint: 'window', gx: 5, gy: 0, w: 1, h: 1, solid: false, wall: { side: 'right', z: 34, w: 50, h: 52 },
    verbs: () => [examine('Vagalumes e a água preta lá embaixo. Lá fora a selva sussurra; aqui dentro, alguém ronca em dó menor.')],
  },
  {
    id: 'lantern', name: 'Lampião de querosene', paint: 'lantern', gx: 0, gy: 2, w: 1, h: 1, solid: false, wall: { side: 'left', z: 56, w: 22, h: 34 },
    verbs: () => [examine('Lampião a querosene. Ou a única fonte de esperança desta palafita.')],
  },
  {
    id: 'map', name: 'Mapa rabiscado', paint: 'map', gx: 0, gy: 1, w: 1, h: 1, solid: false, wall: { side: 'left', z: 48, w: 40, h: 40 },
    verbs: () => [examine('Cada bandeirinha marca uma casa "a ocupar". Alguém desenhou um sol sorrindo em cima do rio. A caneta é a mesma da ordem de queima.')],
  },
  {
    id: 'doormat', name: 'Tapete da porta', paint: 'doormat', gx: 0, gy: 4, w: 1, h: 1, solid: false, height: 2,
    verbs: () => [],
  },
  {
    id: 'drawer', name: 'Mesa com gaveta', paint: 'desk', gx: 3, gy: 2, w: 2, h: 1, height: 26,
    look: (s) => (s.host.legacy('drawer', 'done') ? 'done' : s.host.legacy('drawer', 'open') ? 'open' : ''),
    verbs: reserve('drawer', 10, 'Só sobraram o barbante e a burocracia.'),
  },
  {
    id: 'radio', name: 'Radinho de campanha', paint: 'radio', gx: 4, gy: 2, w: 1, h: 1, solid: false, lift: 26, height: 22,
    look: (s) => (s.rt.radio ? 'on' : ''),
    verbs: (s) => [
      { id: 'use', label: s.rt.radio ? 'Desligar' : 'Ligar rádio', noise: s.rt.radio ? 2 : 10, time: 0.6, pose: 'take', run: (ss) => {
        ss.rt.radio = ss.rt.radio ? 0 : 1; ss.sfx('spark', 0.45);
        if (ss.rt.radio) ss.say(ss.line('radio', RADIO), 'karimbo', 3.6); else ss.say('Silêncio. Quase se ouve a selva pensar.', 'karimbo', 2);
        if (ss.rt.radio && !ss.rt.radioHint) { ss.rt.radioHint = 1; ss.banner('DICA DE FURTIVIDADE', 'Com o rádio ligado, os passos perto dele fazem metade do barulho.'); }
      } },
      examine('"Atenção, tropa: o plano de saúde cobre apenas a parte saudável." Depois, uma voz baixa avisa: três nós vermelhos na ponte. O rádio chia como se tivesse vergonha.'),
    ],
  },
  {
    id: 'bottle', name: 'Coragem Líquida', paint: 'bottle', gx: 3, gy: 2, w: 1, h: 1, solid: false, lift: 26, height: 20,
    look: (s) => (s.has('bottle') ? 'broken' : ''),
    verbs: (s) => (s.has('bottle')
      ? [examine('Cacos. Sem coragem, sem líquido, sem escapatória.')]
      : [examine('"Coragem Líquida — 70% álcool, 30% arrependimento." O rótulo recomenda consumir depois da missão. A garrafa está vazia antes dela.'),
        { id: 'smash', label: 'Derrubar', noise: 45, time: 0.9, pose: 'kick', run: (ss) => {
          ss.set('bottle'); ss.decal('glass', 3.5, 3.5); ss.grid.setSqueak(3, 3);
          ss.pop('CRASH!', 3.5, 3.2, '#ff7a5a'); ss.fx('crash', 3.5, 3.2, 10); ss.shake(4, 0.3); ss.sfx('debris', 1);
          ss.say('Coragem derramada. Cacos no chão: devo pisar com cuidado.', 'karimbo', 3);
        } }]),
  },
  {
    id: 'hammock', name: 'Rede do Cabo Ronco', paint: 'hammock', gx: 5, gy: 1, w: 3, h: 1, height: 26,
    verbs: (s) => (caboHere(s)
      ? [examine(() => (caboAsleep(s) ? 'Ele ronca em dó menor. O chapéu sobe e desce a cada suspiro.' : 'O Cabo Ronco, sentido de sentinela: olhos abertos e cabelo para todo lado.')),
        { id: 'swing', label: 'Balançar a rede', noise: 22, time: 0.8, pose: 'poke', run: (ss, f) => { ss.pop('RÁNG!', f.gx + 1.5, f.gy + 0.5, '#ffd24a'); ss.sfx('creak', 0.8); } }]
      : [examine('Rede vazia, ainda morna. O dono saiu com muita pressa.')]),
  },
  {
    id: 'boots', name: 'Botas do Cabo', paint: 'boots', gx: 5, gy: 2, w: 1, h: 1, height: 16,
    look: (s) => (s.has('laces') ? 'tied' : ''),
    verbs: (s) => (caboHere(s)
      ? [examine('Botas de camurça... de lama. Cadarços compridos, convidativos e completamente desatentos.'),
        ...(s.has('laces') ? [] : [{ id: 'prank' as const, label: 'Amarrar cadarços', noise: 3, time: 1.7, pose: 'poke' as const, run: (ss: InteriorSim, f: FurnitureDef) => {
          ss.set('laces'); ss.pop('NÓ!', f.gx + 0.5, f.gy + 0.5, '#ffd24a'); ss.fx('sparkle', f.gx + 0.5, f.gy + 0.5, 4);
          ss.say('Nó cego, nó duplo e um nó diabólico. A bota esquerda agora é irmã da direita.', 'karimbo', 3.4); ss.sfx('pickup', 0.45);
        } }])]
      : [examine('Só restou o cheiro. Até ele fugiu.')]),
  },
  {
    id: 'coffee', name: 'Mesinha de centro', paint: 'lowTable', gx: 3, gy: 4, w: 2, h: 1, height: 18,
    verbs: () => [examine('Uma mesinha que já viu três planos de ataque e nenhum de sobremesa.')],
  },
  {
    id: 'letter', name: 'Carta sob a caneca', paint: 'letter', gx: 3, gy: 4, w: 1, h: 1, solid: false, lift: 18, height: 12,
    verbs: () => [{ id: 'examine', label: 'Ler a carta', noise: 0, time: 0.8, pose: 'take', run: (s) => s.legacy('letter') }],
  },
  {
    id: 'magazine', name: 'Revista de carreira', paint: 'magazine', gx: 4, gy: 4, w: 1, h: 1, solid: false, lift: 18, height: 10,
    verbs: () => [examine('MERCENÁRIO DO MÊS: "Como terceirizar a culpa em cinco passos". Na seção de empregos: exige experiência, oferece lápide corporativa. Alguém resolveu as palavras cruzadas com NÃO.')],
  },
  {
    id: 'ammo', name: 'Caixa de munição', paint: 'ammoBox', gx: 7, gy: 2, w: 1, h: 1, height: 22,
    look: (s) => (s.has('caixa') ? 'open' : ''),
    verbs: (s) => (s.has('caixa')
      ? [examine('Vazia. Sobrou uma etiqueta: "conferir estoque antes de gastar".')]
      : [{ id: 'open', label: 'Abrir caixa', noise: 12, time: 0.9, pose: 'take', run: (ss, f) => {
        ss.set('caixa'); ss.pop('TÁC!', f.gx + 0.5, f.gy + 0.5); ss.fx('dust', f.gx + 0.5, f.gy + 0.5, 4); ss.sfx('creak', 0.6);
        ss.grenade(1); ss.say('Uma granada de reserva, embrulhada num formulário de "uso responsável".', 'karimbo', 3);
      } }]),
  },
  {
    id: 'panela', name: 'Panela de barro apreendida', paint: 'pot', gx: 7, gy: 2, w: 1, h: 1, solid: false, lift: 22, height: 18,
    look: (s) => (s.has('panela') ? 'gone' : ''),
    verbs: (s) => (s.has('panela') ? [] : [
      examine('Uma panela de barro com etiqueta: "EQUIPAMENTO DE RÁDIO INIMIGO — apreendido em Entre-Raízes". Ainda cheira a feijão. A Operação Panela Fria terminou aqui.'),
      { id: 'take', label: 'Pegar a panela', noise: 4, time: 0.8, pose: 'take', run: (ss, f) => {
        ss.set('panela'); ss.pop('PEGUEI!', f.gx + 0.5, f.gy + 0.5, '#9fffbf'); ss.fx('sparkle', f.gx + 0.5, f.gy + 0.5, 8); ss.sfx('pickup', 0.8);
        ss.say('A panela é da Dona Benedita. Hora de devolver.', 'karimbo', 3.2);
        ss.banner('PANELA RECUPERADA', 'Devolva à Dona Benedita, na primeira casa da aldeia.');
      } },
    ]),
  },
  {
    id: 'chest', name: 'Baú de emergência', paint: 'chest', gx: 7, gy: 3, w: 1, h: 2, height: 24,
    look: (s) => (s.host.legacy('chest', 'done') ? 'done' : s.host.legacy('chest', 'open') ? 'open' : ''),
    verbs: reserve('chest', 14, 'Só meias com patente maior que o dono. Estar aqui já conta.'),
  },
  {
    id: 'tin', name: 'Lata do soldo', paint: 'tin', gx: 6, gy: 5, w: 1, h: 1, height: 14,
    verbs: (s) => (s.has('cofre')
      ? [examine('Vazia. O soldo de um mês virou conversa fiada.')]
      : [examine('Uma lata marcada "SOLDO". O mês acabou há três semanas; a lata continua otimista.'),
        { id: 'take', label: 'Pegar moedas', noise: 5, time: 0.7, pose: 'take', run: (ss, f) => {
          ss.set('cofre'); ss.coins(25); ss.pop('TLIM!', f.gx + 0.5, f.gy + 0.5, '#ffd95a'); ss.fx('coins', f.gx + 0.5, f.gy + 0.5, 5); ss.say('Soldo atrasado. Eu cobro por eles.', 'karimbo', 2.6);
        } }]),
  },
];

const pranks: PrankDef[] = [
  { id: 'panela', label: 'Recuperar a panela apreendida', done: (s) => s.has('panela') },
  { id: 'laces', label: 'Amarrar os cadarços do Cabo', done: (s) => s.has('laces') },
  { id: 'mustache', label: 'Desenhar um bigode no capitão', done: (s) => s.has('mustache') },
  { id: 'loot', label: 'Abrir a gaveta e o baú', done: (s) => s.host.legacy('drawer', 'open') && s.host.legacy('chest', 'open') },
  { id: 'letter', label: 'Ler a carta sob a caneca', done: (s) => s.host.legacy('letter', 'done') },
  { id: 'clean', label: 'Terminar sem acordar o Cabo', bonus: true, earn: (s) => !s.rt.woke, done: (s) => s.has('clean') },
];

const room: RoomDef = {
  id: 'palafita', title: 'Palafita do vigia', subtitle: 'O brejo guarda mais que pegadas.', theme: 'stilt',
  rows: [
    '........',
    '........',
    '........',
    '....s.s.',
    '........',
    '..s.....',
  ].map((r) => r),
  door: { x: 0, y: 4 }, spawn: { x: 1, y: 4 },
  furniture, pranks,
  npcs: [{
    id: 'cabo', name: 'Cabo Ronco', gx: 6, gy: 1, dx: -0.71, dy: 0.71, state: 'asleep', meter: 100,
    brain: makeSleeper({
      stirring: ['Mmm... só mais cinco minutinhos...', 'Rrrr... pzzz... não é minha vez...', 'Hmm... quem mexeu na minha rede?'],
      half: ['Hm?... mãe?...', 'Quem tá aí?... Capitão?...', 'Foi o vento... foi o vento...'],
      alert: ['EI! QUEM TÁ AÍ?!', 'LADRÃO NA PALAFITA!', 'ISSO É UMA EMBOSCADA... DO KARIMBO?!'],
      tripped: ['AAAH! Cadarço!', 'QUEM AMARROU... AAAH!', 'ISSO É SABOTAGEM DE SAPATO!'],
      caught: ['Peguei! Fora daqui!', 'Visita sem convite leva coronhada!'],
      settle: ['Zzz... foi sonho...', 'Pronto... voltou o silêncio...'],
    }, { tripFlag: 'laces', goneFlag: 'caboGone', tripAfter: 0.9 }),
  }],
  lights: [
    { gx: 0.2, gy: 2.5, z: 66, r: 120, color: '#ffc864', flicker: 0.22 },
    { gx: 5.5, gy: 0.1, z: 58, r: 140, color: '#7fb8ff', flicker: 0.05 },
  ],
  pocket: (s) => (s.has('panela') && !s.store.has('benedita', 'panela') ? [{ id: 'panela', label: 'Panela de barro' }] : []),
  onEnter(s) {
    const n = cabo(s);
    if (s.has('caboGone') && n) { n.away = true; n.state = 'gone'; }
    if (s.has('bottle')) { s.decal('glass', 3.5, 3.5); s.grid.setSqueak(3, 3); }
    if (!s.has('visited') && n && !n.away) s.say('Shhh... ele está dormindo. Pés leves.', 'karimbo', 3.4);
  },
};

export default room;
