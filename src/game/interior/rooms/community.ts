import { buildingStyle, HOME_NAMES, HOME_TRADES } from '../../buildings';
import type { RoomId } from '../../interiorStore';
import type { Brain, FurnitureDef, RoomDef, VerbDef } from '../types';
import { shade } from '../../../core/math';

const stories = [
  'O tecido mostra os caminhos pelo rio. Cada família bordou o trecho que conhece; juntos, os retalhos viraram um mapa.',
  'Os potes são feitos com barro da curva do rio. Um sino pequeno avisa quando a cerâmica esfria; ninguém precisa correr.',
  'Sementes de três enchentes, guardadas em envelopes reaproveitados. No caderno, cada plantio tem data, chuva e nome de quem ajudou.',
  'A bancada guarda uma cadeira ainda sem um pé. Na parede, o desenho de uma ponte que a comunidade pretende reconstruir.',
  'A rede foi remendada tantas vezes que já conta a história da família. Peixes pequenos voltam ao rio; os grandes viram almoço.',
  'Tambor, viola e um caderno de cantigas. A roda do jacaré começa quando alguém bate duas palmas graves e uma aguda.',
];
const features = ['Tear e novelos', 'Bancada de cerâmica', 'Arquivo de sementes', 'Bancada do marceneiro', 'Redes e remos', 'Instrumentos da roda'];
const examine = (text: string): VerbDef => ({ id: 'examine', label: 'Examinar', noise: 0, time: .4,
  run: (s, f) => s.read(f.name, text) });
const friendly: Brain = {
  update(s,n,dt){n.t+=dt;n.walk=0;n.mark='';if(n.t>12){n.t=0;s.say('A trilha é de todos. Fique à vontade!',n.id,2.6);}},
  verbs: (_s,n)=>[{id:'give',label:'Conversar',noise:0,time:.5,run:s=>s.say(`Sou ${n.name}. Fique à vontade para conhecer este lugar.`,n.id,3.5)}],
};

/** Plantas distintas, dimensões estáveis e corredores livres. Nada usa índices de entities/save. */
export function makeCommunityRoom(id: RoomId): RoomDef {
  const merc = id.startsWith('hut:'), index = Number(id.split(':')[1]);
  if (!Number.isInteger(index) || index < 1 || index > (merc ? 2 : 29)) throw new Error(`Interior desconhecido: ${id}`);
  const spec=buildingStyle(index,merc), trade=index%6;
  const owner=merc?['','Sargento Papel','Cabo Semente'][index]:HOME_NAMES[index];
  const title=merc?['','Cabana do comando','Cabana da retaguarda'][index]:`Casa de ${owner}`;
  const floors: RoomDef[]=[];
  for(let floor=0;floor<spec.floors;floor++){
    const w=spec.cols,h=spec.rows,upper=floor===1;
    const furniture: FurnitureDef[]=[];
    const item=(fid:string,name:string,paint:string,gx:number,gy:number,fw:number,fh:number,verbs:()=>VerbDef[],height=30,solid=true)=>{
      furniture.push({id:fid,name,paint,gx,gy,w:fw,h:fh,height,solid,verbs});
    };
    // Cada índice produz uma combinação única de largura, profundidade, profissão e posição da mesa.
    item('bed',upper?'Cama do andar superior':'Cama de descanso','bed',w-2,0,2,2,
      ()=>[examine(`Uma colcha escolhida por ${owner}. A janela dá para ${index%2?'o pomar':'o riacho'}.`),
        {id:'lie',label:'Descansar',noise:0,time:2,pose:'lie',run:(s,f)=>{s.settle(f.id,'lie');if(!s.has('rest')){s.set('rest');s.heal(10);}s.say('Um minuto de sossego.');}}],24);
    item('feature',upper?'Cômoda do quarto':merc?(index===1?'Mesa de mapas e relatórios':'Viveiro escondido'):features[trade],upper?'dresser':merc?'campDesk':'communityFeature',1,0,2,1,
      ()=>[examine(merc?(index===1?'O mapa chama a aldeia de "área vazia". Trinta pontos de tinta desmentem o relatório.':'Entre caixas de equipamento, alguém cultiva mudas. Uma anotação diz: "Depois da missão, eu quero plantar".'):stories[trade]),
        {id:'use',label:merc?'Conferir anotações':'Conhecer o ofício',noise:2,time:1,pose:'poke',run:s=>{s.set('keepsake');s.say(`${owner} deixou tudo organizado. Aqui se faz ${merc?'muito mais que vigia':HOME_TRADES[trade].toLowerCase()}.`);}}],36);
    // Mesa, cadeira e patamar formam áreas separadas; porta e circulação têm uma célula livre.
    const tableX=2+index%Math.max(1,w-5),tableY=2;
    item('table','Mesa da família','houseTable',tableX,tableY,2,1,()=>[examine(`Na mesa de ${owner}, há ${['folhas de tecido','potes pintados','sementes catalogadas','peças de madeira','conchas do rio','partituras'][trade]}.`)],22);
    item('chair','Cadeira de visita','chair',tableX+2,tableY,1,1,()=>[{id:'sit',label:'Sentar',noise:1,time:1.5,pose:'sit',run:(s,f)=>s.settle(f.id,'sit')}],22);
    item('plant','Planta do quintal','plant',w-3,0,1,1,()=>[examine('A luz da janela alcança cada folha.'),
      {id:'water',label:'Regar',noise:1,time:.9,pose:'take',run:s=>{if(!s.has('plant')){s.set('plant');s.addRep(1);}s.fx('splash',w-2.5,.5,4);s.say('Verde outra vez.');}}],34);
    item('chest',merc?'Baú de campanha':'Baú de lembranças',merc?'chest':'trunk',0,h-3,1,1,
      ()=>[{id:'open',label:'Abrir baú',noise:4,time:.8,pose:'take',run:s=>{
        if(merc){s.legacy('chest');return;}s.read(`Lembrança de ${owner}`,`${stories[trade]}\nUm retrato numerado ${index+1} guarda a memória desta família.`);
        if(!s.has('gift')){s.set('gift');s.coins(8);}
      }}],24);
    if(merc)item('drawer','Arquivo do destacamento','dresser',0,1,1,1,()=>[
      {id:'open',label:'Abrir gaveta',noise:4,time:.7,pose:'take',run:s=>s.legacy('drawer')},
      {id:'examine',label:'Ler a carta',noise:0,time:.5,run:s=>s.legacy('letter')}],32);
    else item('shelf',upper?'Estante de memórias':'Prateleira de mantimentos','cabinet',0,1,1,1,()=>[examine(`${owner} organiza ${['linhas e agulhas','tintas e pincéis','sacos de sementes','ferramentas pequenas','anzóis e cestos','palhetas e cordas'][trade]} nesta estante.`)],54);
    if(merc&&!upper){
      // Os objetos do modal anterior continuam acessíveis com as mesmas chaves de lore/recompensa.
      const inspect=(obj:string):VerbDef[]=>[{id:'examine',label:'Examinar',noise:0,time:.5,run:s=>s.legacy(obj)}];
      item('radio','Radinho de campanha','radio',4,0,1,1,()=>inspect('radio'),22);
      furniture.push({id:'portrait',name:'Retrato do capitão',paint:'portrait',gx:4,gy:0,w:1,h:1,solid:false,
        wall:{side:'right',z:60,w:44,h:52},verbs:()=>inspect('portrait')});
      item('weapons','Armeiro e manutenção','weaponRack',w-2,3,2,1,()=>inspect('weapons'),58);
      furniture.push({id:'bottle',name:'Bebida de procedência duvidosa',paint:'bottle',gx:tableX,gy:tableY,w:1,h:1,
        solid:false,lift:26,height:18,verbs:()=>inspect('bottle')});
      furniture.push({id:'magazine',name:'Revista de carreira',paint:'magazine',gx:tableX+1,gy:tableY,w:1,h:1,
        solid:false,lift:26,height:3,verbs:()=>inspect('magazine')});
    }
    if(spec.floors===2)item('stairs',upper?'Escada para a sala':'Escada para o andar superior',upper?'stairsDown':'stairs',w-2,h-2,1,2,()=>[
      {id:'use',label:upper?'Descer à sala':'Subir ao 2º andar',noise:3,time:.5,run:s=>s.emit({type:'floor',index:upper?0:1})}],upper?18:52);
    const room:RoomDef={id,title:`${title}${upper?' · 2º andar':''}`,subtitle:merc?'A rotina por trás do uniforme.':HOME_TRADES[trade],
      theme:merc?'stilt':'house',floor,rows:Array.from({length:h},()=>'.'.repeat(w)),door:{x:0,y:h-1},spawn:{x:1,y:h-1},furniture,
      npcs:upper?[]:[{id:`neighbor:${index}`,name:owner,gx:w-3,gy:1,state:'idle',brain:friendly}],pranks:[],
      palette:{floorA:merc?'#98794f':shade(spec.accent,upper?.32:.15),floorB:merc?'#685335':shade(spec.accent,upper?.05:-.12),wallL:spec.color,wallR:shade(spec.color,.16),base:spec.accent},
      lights:[{gx:1,gy:0,z:60,r:150,color:upper?'#f8d194':'#ffe1a4'}],
      onEnter:s=>s.say(upper?'O quarto fica acima da sala. A escada leva de volta.':`Esta é a ${merc?'cabana':'casa'} de ${owner}. Pode entrar!`)};
    floors.push(room);
  }
  for(const room of floors)room.floors=floors;
  return floors[0];
}
