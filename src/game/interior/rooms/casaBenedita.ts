/**
 * CASA DA DONA BENEDITA (primeira casa da aldeia). Visita, vergonha e afeto: a tecelã saiu para a
 * roça e volta no meio da bagunça. Comer o feijão, derrubar o filtro da mãe dela, roubar o
 * cofrinho... ou devolver a panela que os mercenários apreenderam e ser servido como hóspede.
 */
import type { FurnitureDef, PrankDef, RoomDef, VerbDef } from '../types';
import type { InteriorSim } from '../sim';
import { makeHost, type HostLines } from '../brains/host';

const ben = (s: InteriorSim) => s.npc('benedita')!;
const here = (s: InteriorSim) => !ben(s).away;
const shout = (s: InteriorSim, f: FurnitureDef, text: string) => (text.length > 110 ? s.read(f.name, text) : s.say(text));
const examine = (text: string | ((s: InteriorSim) => string)): VerbDef => ({
  id: 'examine', label: 'Examinar', noise: 0, time: 0.5, pose: 'idle',
  run: (s, f) => shout(s, f, typeof text === 'string' ? text : text(s)),
});
const cx = (f: FurnitureDef) => f.gx + f.w / 2, cy = (f: FurnitureDef) => f.gy + f.h / 2;
const feast = (s: InteriorSim) => s.has('panela');

const BEANS = ['bean1', 'bean2', 'bean3'];

const furniture: FurnitureDef[] = [
  {
    id: 'stove', name: 'Fogão a lenha', paint: 'stove', gx: 0, gy: 0, w: 2, h: 1, tall: true, height: 46,
    verbs: () => [
      examine('Fogão a lenha. A panela de feijão borbulha como se tivesse opinião.'),
      { id: 'use', label: 'Avivar o fogo', noise: 8, time: 0.8, pose: 'poke', run: (s, f) => { s.fx('steam', cx(f), cy(f), 4); s.sfx('servo', 0.3); s.say('Fogo vivo, feijão feliz.', 'karimbo', 2.2); } },
    ],
  },
  {
    id: 'beans', name: 'Panela de feijão', paint: 'beansPot', gx: 1, gy: 0, w: 1, h: 1, solid: false, lift: 34, height: 16,
    look: (s) => (s.has('bean3') ? 'empty' : s.has('bean2') ? 'low' : s.has('bean1') ? 'half' : ''),
    verbs: (s) => (s.has('bean3')
      ? [examine('Só raspa de panela. Respeito é isso.')]
      : [{ id: 'eat', label: 'Comer feijão', noise: 6, time: 1.1, pose: 'eat', irritation: 15, run: (ss, f) => {
        const k = BEANS.find((b) => !ss.has(b))!; ss.set(k);
        ss.heal(feast(ss) ? 22 : 12); ss.fx('crumbs', cx(f), cy(f) + 0.8, 6); ss.pop('NHAC!', cx(f), cy(f) + 0.6, '#ffd24a');
        ss.say(ss.line('beans', ['Hmm... tem gosto de domingo.', 'Feijão de panela de barro: ciência antiga.', 'Mais uma colherada e eu paro. Mentira.']), 'karimbo', 2.6);
        ss.trace('beans', 22, 'Cadê o meu feijão?! Alguém comeu na minha panela!');
        if (ss.has('bean3')) ss.decal('beans', cx(f) + 0.4, cy(f) + 1.2);
      } }, examine('Feijão preto, cheiro de louro. O estômago do Karimbo opina em voz alta.')]),
  },
  {
    id: 'filter', name: 'Filtro de barro', paint: 'filter', gx: 2, gy: 0, w: 1, h: 1, height: 40,
    look: (s) => (s.has('filter') ? 'broken' : ''),
    verbs: (s) => (s.has('filter')
      ? [examine('Era o filtro da mãe dela. Agora é uma poça e uma lição.')]
      : [examine('Filtro de barro: água fresca, geração após geração.'),
        { id: 'drink', label: 'Beber água', noise: 3, time: 1, pose: 'eat', irritation: 4, run: (ss) => { ss.heal(6); ss.fx('splash', 2.5, 1.6, 3); ss.say('Fresquinha. Pura filosofia líquida.', 'karimbo', 2.2); ss.sfx('splash', 0.3); } },
        { id: 'smash', label: 'Derrubar', noise: 55, time: 0.9, pose: 'kick', hostile: true, irritation: 70, run: (ss, f) => {
          ss.set('filter'); ss.addRep(-12); ss.decal('puddle', cx(f), cy(f) + 0.9);
          ss.pop('CRASH!', cx(f), cy(f), '#ff7a5a'); ss.fx('crash', cx(f), cy(f), 10); ss.fx('splash', cx(f), cy(f) + 0.5, 8); ss.shake(5, 0.35); ss.sfx('crateBreak', 1); ss.sfx('splash', 0.6);
          ss.say('Foi o vento... e o meu cotovelo.', 'karimbo', 2.8);
          ss.trace('filter', 70, 'O FILTRO DA MINHA MÃE!!');
        } }]),
  },
  {
    id: 'plant', name: 'Samambaia da janela', paint: 'plant', gx: 3, gy: 0, w: 1, h: 1, height: 34,
    look: (s) => (s.has('plant') ? 'happy' : ''),
    verbs: (s) => [examine('Uma samambaia que já viu coisa demais e continua verde.'),
      ...(s.has('plant') ? [] : [{ id: 'water' as const, label: 'Regar', noise: 2, time: 1.1, pose: 'take' as const, irritation: -10, run: (ss: InteriorSim, f: FurnitureDef) => {
        ss.set('plant'); ss.addRep(4); ss.fx('splash', cx(f), cy(f) + 0.4, 6); ss.fx('sparkle', cx(f), cy(f), 6); ss.pop('GLU GLU!', cx(f), cy(f), '#9fe8ff');
        ss.say('A samambaia agradeceu, em silêncio e com folhas.', 'karimbo', 2.8);
      } }])],
  },
  {
    id: 'calendar', name: 'Calendário de farmácia', paint: 'calendar', gx: 1, gy: 0, w: 1, h: 1, solid: false, wall: { side: 'right', z: 66, w: 30, h: 38 },
    verbs: () => [examine('Ainda em 2009. Ninguém teve coragem de virar a folha.')],
  },
  {
    id: 'window', name: 'Janela de venezianas', paint: 'houseWindow', gx: 4, gy: 0, w: 1, h: 1, solid: false, wall: { side: 'right', z: 36, w: 46, h: 56 },
    verbs: () => [examine('Venezianas verdes e o quintal ao sol. Uma galinha atravessa o mundo com muita pressa.')],
  },
  {
    id: 'bed', name: 'Cama de colcha de retalhos', paint: 'bed', gx: 5, gy: 0, w: 2, h: 2, height: 24,
    verbs: () => [
      examine('Colcha de retalhos: cada pedaço lembra uma blusa, um vestido ou um domingo.'),
      { id: 'rummage', label: 'Olhar embaixo', noise: 3, time: 0.9, pose: 'poke', run: (s) => s.say('Um penico. Melhor não.', 'karimbo', 2.4) },
      { id: 'lie', label: 'Deitar na cama', noise: 4, time: 3, pose: 'lie', hostile: true, irritation: 45, run: (s, f) => {
        s.settle(f.id, 'lie'); s.fx('zzz', cx(f), cy(f), 1); s.say('Que colchão... que luta moral.', 'karimbo', 2.6);
        s.trace('bed', 30, 'Quem deitou na minha cama?!');
      } },
    ],
  },
  {
    id: 'dresser', name: 'Cômoda de três gavetas', paint: 'dresser', gx: 7, gy: 0, w: 1, h: 1, height: 34,
    look: (s) => (s.has('dresser') ? 'open' : ''),
    verbs: (s) => (s.has('dresser')
      ? [examine('Meias, cartas e a saudade de alguém. Já fucei tudo, que feio.')]
      : [{ id: 'rummage', label: 'Fuçar gavetas', noise: 8, time: 1.2, pose: 'take', hostile: true, irritation: 12, run: (ss, f) => {
        ss.set('dresser'); ss.fx('dust', cx(f), cy(f) + 0.7, 4);
        ss.read('Cartas guardadas', 'Entre meias dobradas, um maço de cartas amarradas com fita azul: "Quando o rio levou a estrada, a gente se escreveu pela água. Cada carta chegou molhada e inteira."\nNo fundo da gaveta, uma foto da praça: todo mundo na roda, rindo, antes de qualquer contrato.');
        ss.trace('dresser', 12, 'Quem mexeu na minha cômoda?');
      } }, examine('Uma cômoda antiga, com gavetas que rangem baixinho para não incomodar.')]),
  },
  {
    id: 'piggy', name: 'Porquinho cofrinho', paint: 'piggy', gx: 7, gy: 0, w: 1, h: 1, solid: false, lift: 34, height: 16,
    look: (s) => (s.has('piggyBroken') ? 'broken' : s.has('piggyStolen') ? 'gone' : ''),
    verbs: (s) => (s.has('piggyBroken') || s.has('piggyStolen') ? [] : [
      examine('Um porquinho de barro com sorriso bondoso. Pesa de moedas e de consciência.'),
      { id: 'steal', label: 'Roubar', noise: 3, time: 0.9, pose: 'take', hostile: true, irritation: 60, run: (ss, f) => {
        ss.set('piggyStolen'); ss.coins(60); ss.addRep(-20); ss.pop('TLIM!', cx(f), cy(f), '#ffd95a'); ss.fx('coins', cx(f), cy(f), 6);
        ss.say('Empréstimo... sem data de devolução.', 'karimbo', 2.8); ss.trace('piggy', 80, 'CADÊ O MEU PORQUINHO?!');
      } },
      { id: 'smash', label: 'Quebrar', noise: 40, time: 0.8, pose: 'kick', hostile: true, irritation: 90, run: (ss, f) => {
        ss.set('piggyBroken'); ss.coins(90); ss.addRep(-30); ss.pop('CRASH!', cx(f), cy(f), '#ff7a5a'); ss.fx('crash', cx(f), cy(f), 9); ss.fx('coins', cx(f), cy(f), 8); ss.shake(4, 0.3); ss.sfx('crateBreak', 0.9);
        ss.say('O porquinho nunca me perdoará.', 'karimbo', 2.8); ss.trace('piggy', 90, 'MEU PORQUINHO! MEU PORQUINHO!!');
      } },
    ]),
  },
  {
    id: 'mirror', name: 'Espelho de moldura', paint: 'mirror', gx: 7, gy: 0, w: 1, h: 1, solid: false, wall: { side: 'right', z: 56, w: 34, h: 46 },
    verbs: () => [{ id: 'admire', label: 'Admirar-se', noise: 0, time: 2.4, pose: 'mirror', run: (s) => {
      s.set('mirror'); s.fx('sparkle', s.px, s.py, 8);
      s.say(s.line('mirror', ['Bonito. Muito bonito. Até demais.', 'O rosto de um herói... com cara de fome.', 'Eu sou um espetáculo em movimento.']), 'karimbo', 3);
    } }],
  },
  {
    id: 'chest', name: 'Baú de enxoval', paint: 'trunk', gx: 8, gy: 2, w: 1, h: 2, height: 24,
    look: (s) => (s.has('photos') ? 'open' : ''),
    verbs: (s) => (s.has('photos')
      ? [examine('Lençóis bordados e um cheiro de alfazema que dura mais que a minha pressa.')]
      : [{ id: 'rummage', label: 'Abrir baú', noise: 12, time: 1.3, pose: 'take', hostile: true, irritation: 20, run: (ss, f) => {
        ss.set('photos'); ss.fx('dust', cx(f), cy(f), 5); ss.sfx('creak', 0.5);
        ss.read('Fotos antigas', 'Fotografias de uma aldeia mais cheia: crianças sentadas em círculo, o jacaré de sino no pescoço, um varal azul atravessando a rua. No verso, a letra miúda: "Ninguém aqui é de ninguém. A gente é do rio."');
        ss.trace('chest', 20, 'Quem mexeu no meu enxoval?!');
      } }, examine('Um baú de enxoval fechado com fita e orgulho.')]),
  },
  {
    id: 'table', name: 'Mesa de chita', paint: 'houseTable', gx: 3, gy: 2, w: 2, h: 2, height: 22,
    verbs: () => [examine('Toalha de chita florida. Cada flor foi bordada com raiva de preço de supermercado.')],
  },
  {
    id: 'cake', name: 'Bolo de mandioca', paint: 'cake', gx: 4, gy: 2, w: 1, h: 1, solid: false, lift: 22, height: 14,
    look: (s) => (s.has('cake') ? 'cut' : ''),
    verbs: (s) => (s.has('cake')
      ? [examine('Sobrou uma fatia triste e um pratinho com migalhas.')]
      : [examine('Bolo de mandioca. Uma obra de arte comestível em temperatura de convite.'),
        { id: 'eat', label: 'Comer bolo', noise: 5, time: 1, pose: 'eat', irritation: feast(s) ? 0 : 10, run: (ss, f) => {
          ss.set('cake'); ss.heal(feast(ss) ? 25 : 10); ss.fx('crumbs', cx(f), cy(f), 6); ss.decal('crumbs', cx(f), cy(f) + 0.8); ss.pop('NHAC!', cx(f), cy(f), '#ffd24a');
          ss.say(ss.line('cake', ['Fofinho. Um crime de bom gosto.', 'Mandioca com amor é a minha religião.']), 'karimbo', 2.6);
          if (!feast(ss)) ss.trace('cake', 18, 'Quem cortou o meu bolo?!');
        } }]),
  },
  {
    id: 'chair', name: 'Cadeira de palhinha', paint: 'chair', gx: 5, gy: 2, w: 1, h: 1, height: 22,
    verbs: () => [{ id: 'sit', label: 'Sentar', noise: 2, time: 2.2, pose: 'sit', irritation: -3, run: (s, f) => { s.settle(f.id, 'sit'); s.say('Cadeira firme, dia calmo.', 'karimbo', 2); } }],
  },
  {
    id: 'catChair', name: 'Cadeira do gato', paint: 'chair', gx: 2, gy: 3, w: 1, h: 1, height: 22,
    verbs: (s) => (s.rt.catGone ? [{ id: 'sit', label: 'Sentar', noise: 2, time: 2.2, pose: 'sit', run: (ss, f) => { ss.settle(f.id, 'sit'); ss.say('Ainda morna. Ele vai se vingar.', 'karimbo', 2.4); } }] : []),
  },
  {
    id: 'cat', name: 'Gato de colo', paint: 'cat', gx: 2, gy: 3, w: 1, h: 1, solid: false, lift: 22, height: 16,
    look: (s) => (s.rt.catGone ? 'gone' : ''),
    verbs: (s) => (s.rt.catGone ? [] : [
      examine('Um gato laranja com opinião sobre tudo. Ronrona só quando ele decide.'),
      { id: 'pet', label: 'Fazer carinho', noise: 0, time: 1.5, pose: 'pet', irritation: -5, run: (ss, f) => {
        ss.set('cat'); ss.addRep(2); ss.fx('heart', cx(f), cy(f), 5); ss.say('Prrrrrr. Eu acho que ele me aprovou.', 'karimbo', 2.6); ss.sfx('bird2', 0.2);
      } },
      { id: 'knock', label: 'Derrubar da cadeira', noise: 25, time: 0.7, pose: 'kick', irritation: 10, run: (ss, f) => {
        ss.rt.catGone = 1; ss.pop('MIAUUU!', cx(f), cy(f), '#ffb060'); ss.fx('poof', cx(f), cy(f), 6); ss.sfx('frog', 0.5);
        ss.say('O gato saiu em protesto. Merece.', 'karimbo', 2.4);
      } },
    ]),
  },
  {
    id: 'cabinet', name: 'Armário de cozinha', paint: 'cabinet', gx: 0, gy: 1, w: 1, h: 1, tall: true, height: 54,
    look: (s) => (s.has('tin') ? 'tin' : s.has('cabinet') ? 'open' : ''),
    verbs: (s) => (s.has('tin')
      ? [examine('Só linha, agulha e um dedal. Era costura. Sempre é costura.')]
      : s.has('cabinet')
        ? [{ id: 'rummage', label: 'Abrir a lata', noise: 5, time: 1.2, pose: 'take', irritation: 6, run: (ss, f) => {
          ss.set('tin'); ss.pop('TÁ-DÁ?', cx(f), cy(f), '#ffd24a'); ss.fx('sparkle', cx(f), cy(f), 5);
          ss.read('A lata de biscoito', 'Biscoitos dinamarqueses! Só que não: dentro da lata há linhas, agulhas, um dedal e um botão solitário. Era costura. Sempre é costura.\nEm cima, um bilhete: "Se alguém abrir isso procurando biscoito: a vida é assim mesmo."');
          ss.trace('cabinet', 6, 'Quem mexeu na lata de biscoito?');
        } }]
        : [{ id: 'open', label: 'Abrir armário', noise: 8, time: 0.8, pose: 'take', irritation: 6, run: (ss, f) => {
          ss.set('cabinet'); ss.pop('CLAC!', cx(f), cy(f), '#ffd24a'); ss.sfx('creak', 0.5);
          ss.say('Louças, panos e uma lata de biscoito dinamarquês... que promissor.', 'karimbo', 3);
          ss.trace('cabinet', 6, 'Quem abriu meu armário?');
        } }, examine('Armário de cozinha: o cofre da nossa fome.')]),
  },
  {
    id: 'tv', name: 'TV de tubo', paint: 'tv', gx: 0, gy: 2, w: 1, h: 1, tall: true, height: 40,
    look: (s) => (s.has('tv') ? 'on' : ''),
    verbs: (s) => (s.has('tv')
      ? [{ id: 'use', label: 'Mudar de canal', noise: 4, time: 0.7, pose: 'poke', run: (ss) => ss.say(ss.line('tv', ['Novela: ela jura que é gêmea. De novo.', 'Futebol: o juiz errou. Como sempre.', 'Jornal: "o rio tem seus motivos".']), 'karimbo', 2.8) }]
      : [examine('Antena de palha de aço, imagem de chuva e uma esperança teimosa.'),
        { id: 'use', label: 'Tapa técnico', noise: 18, time: 1, pose: 'poke', irritation: -12, run: (ss, f) => {
          ss.set('tv'); ss.addRep(3); ss.pop('TÁÁ!', cx(f), cy(f), '#ffd24a'); ss.shake(3, 0.2); ss.sfx('spark', 0.7); ss.fx('sparkle', cx(f), cy(f), 6);
          ss.say('Pegou! Agora é novela.', 'karimbo', 2.6);
        } }]),
  },
  {
    id: 'redeSala', name: 'Rede da sala', paint: 'chitaHammock', gx: 6, gy: 4, w: 3, h: 1, height: 26,
    verbs: () => [
      examine('Uma rede de chita, feita para o soninho da tarde. Parece dizer "só um minutinho".'),
      { id: 'lie', label: 'Tirar um cochilo', noise: 2, time: 4.5, pose: 'lie', run: (s, f) => {
        s.set('nap'); s.settle(f.id, 'lie'); s.fx('zzz', cx(f), cy(f), 2); s.heal(10);
        const b = ben(s); if (b.away) b.data.away = Math.min(b.data.away ?? 60, 5);
        s.say('Só cinco minutinhos... Zzz...', 'karimbo', 3);
      } },
    ],
  },
  {
    id: 'hen', name: 'Galinha', paint: 'hen', gx: 7, gy: 5, w: 1, h: 1, solid: false, height: 18,
    look: (s) => (s.has('hen') ? 'gone' : ''),
    verbs: (s) => (s.has('hen') ? [] : [
      examine('Uma galinha que entra e sai quando quer. Gerência de pátio.'),
      { id: 'shoo', label: 'Enxotar', noise: 30, time: 0.8, pose: 'kick', irritation: 8, run: (ss, f) => {
        ss.set('hen'); ss.pop('CÓ-CÓ-CÓ!', cx(f), cy(f), '#ffd24a'); ss.fx('feathers', cx(f), cy(f), 10); ss.shake(2, 0.2);
        ss.say('Ela fugiu com uma dignidade que eu nunca terei.', 'karimbo', 2.8);
      } },
    ]),
  },
  { id: 'doormat', name: 'Capacho', paint: 'houseDoormat', gx: 0, gy: 4, w: 1, h: 1, solid: false, height: 2, verbs: () => [] },
];

const pranks: PrankDef[] = [
  { id: 'panela', label: 'Devolver a panela da Dona Benedita', done: (s) => s.has('panela') },
  { id: 'tv', label: 'Dar um tapa técnico na TV', done: (s) => s.has('tv') },
  { id: 'tin', label: 'Descobrir o que tem na lata de biscoito', done: (s) => s.has('tin') },
  { id: 'kind', label: 'Regar a samambaia ou fazer carinho no gato', done: (s) => s.has('plant') || s.has('cat') },
  { id: 'nap', label: 'Tirar um cochilo na rede', done: (s) => s.has('nap') },
  { id: 'clean', label: 'Terminar sem ser expulso', bonus: true, earn: (s) => !s.rt.expelled && (ben(s).meter ?? 0) < 100, done: (s) => s.has('clean') },
];

const lines: HostLines = {
  arrive: ['Cheguei! Tem alguém aí?', 'Esqueci o chapéu... e que cheiro é esse?', 'Ô de casa! Alguém mexeu aqui?'],
  met: ['Ué, Karimbo? Entrou sem bater?', 'Menino, a porta estava só encostada!', 'Karimbo... na minha casa? Que honra duvidosa.'],
  suspect: ['Hmm... esse olhar eu conheço.', 'Menino, o que é que você está aprontando?', 'Tem cheiro de travessura no ar...'],
  annoyed: ['Sai daí, menino!', 'Eu estou de olho, viu?', 'Mãos pra trás, Karimbo!', 'Minha paciência tem prazo de validade!'],
  expel: ['FORA DA MINHA CASA!!', 'LARGA ISSO E RUA!', 'VOCÊ NÃO É O HERÓI DA MINHA COZINHA!'],
  calm: ['Hmpf. Se comporta, hein.', 'Tá bom, tá bom... eu confio um tiquinho.'],
  noise: ['Que barulho foi esse?!', 'Parece que caiu uma panela!', 'Alguém aí?'],
  joy: ['MINHA PANELA!! Onde você achou, menino?!', 'A panela da minha avó! Karimbo bendito!', 'Eles tinham levado ela... e você trouxe de volta!'],
  thanks: ['Feijão da Dona Benedita: remédio e abraço no mesmo prato.', 'Melhor refeição desta fase, sem dúvida.', 'Agora sim: herói alimentado!'],
  offer: ['Senta aí que eu faço o prato! Hoje é por minha conta.', 'Panela de volta, fogão aceso: a casa é sua, Karimbo.'],
  examine: ['Dona Benedita: tece, cozinha e vigia ao mesmo tempo.', 'Ela olha para o Karimbo como quem vê um sobrinho irresponsável.'],
  discovered: ['Hmm...'],
};

const room: RoomDef = {
  id: 'benedita', title: 'Casa da Dona Benedita', subtitle: 'A porta está encostada.', theme: 'house',
  rows: ['.........', '.........', '.........', '.........', '.........', '.........'],
  door: { x: 0, y: 4 }, spawn: { x: 1, y: 4 },
  furniture, pranks,
  npcs: [{
    id: 'benedita', name: 'Dona Benedita', gx: 0, gy: 4, dx: 0.7, dy: -0.7, state: 'away', away: true,
    brain: makeHost(lines, {
      away: [48, 68], speed: 1.9,
      waypoints: [
        { x: 1, y: 1, wait: [5, 8], act: 'cook' }, { x: 2, y: 1, wait: [2, 3] }, { x: 3, y: 1, wait: [2, 3.5] },
        { x: 1, y: 3, wait: [3, 5] }, { x: 4, y: 4, wait: [3, 5] }, { x: 6, y: 3, wait: [2, 4] }, { x: 2, y: 5, wait: [2, 3] },
      ],
    }),
  }],
  lights: [
    { gx: 0.6, gy: 0.4, z: 24, r: 100, color: '#ff9a40', flicker: 0.3 },
    { gx: 3.5, gy: 0.1, z: 50, r: 150, color: '#ffe9a8', flicker: 0.04 },
  ],
  isPrivate: (c) => c.x >= 5 && c.y <= 2,
  pocket: (s) => (s.store.has('palafita', 'panela') && !s.has('panela') ? [{ id: 'panela', label: 'Panela de barro' }] : []),
  mood: (s) => (s.has('panela') ? 'happy' : s.rt.expelled || ben(s).meter >= 60 ? 'angry' : 'neutral'),
  onEnter(s) {
    if (s.has('filter')) s.decal('puddle', 2.5, 1.9);
    if (s.has('bean3')) s.decal('beans', 1.9, 1.2);
    if (s.has('cake')) s.decal('crumbs', 4.5, 3.3);
    if (!s.has('visited')) s.say('Ninguém em casa? A porta estava só encostada...', 'karimbo', 3.4);
    void here;
  },
};

export default room;
