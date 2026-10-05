import type { LevelData } from './level';
import type { World } from './world';
import { WEAPONS, WEAPON_ORDER } from './weapons';
import { segHitsRect } from './bullets';
import type { RoomId } from './interiorStore';
import { buildingStyle, HOME_NAMES, HOME_TRADES } from './buildings';

export interface Clue { id: string; title: string; text: string; }
export interface InvestigationObject {
  id: string; name: string; text: string; rect: [number, number, number, number];
  drawer?: boolean; ammo?: number; clue?: Clue;
}
export interface ExplorationSpot {
  id: string; x: number; y: number; title: string; subtitle: string; cabin: boolean;
  objects: InvestigationObject[]; clue?: Clue;
  /** casa de morador (não é cabana mercenária) */
  home?: boolean;
  /** tem interior jogável em grade isométrica (em vez do modal de investigação) */
  interior?: RoomId;
}

/**
 * Centro da porta em px de mundo, compartilhado com a fachada por buildingStyle.
 * Sem variante autorada, mantém o cálculo antigo para dados legados.
 */
export function villageHomeDoorX(d:{x:number;y:number;scale?:number;flip?:boolean;variant?:number}):number {
  if (d.variant !== undefined) return d.x + (d.flip ? -1 : 1) * buildingStyle(d.variant).door * (d.scale ?? 1);
  const seed=Math.floor(d.x*7.13+d.y*3.1),v=((Math.abs(seed)%8)*977+13)%3;
  return d.x+(d.flip?-1:1)*(8*v-2)*(d.scale??1);
}
export const VILLAGE_LORE: Clue[] = [
  {id:'river',title:'01 · A aldeia de Entre-Raízes',text:'A enchente levou a estrada, mas deixou uma semente debaixo de cada casa. As famílias reconstruíram sobre as raízes. Aqui, ninguém vende o rio: a água atravessa o quintal de todos.'},
  {id:'cloth',title:'02 · O mapa que se veste',text:'Os tecidos guardam caminhos: azul é água limpa, amarelo é abrigo, três nós vermelhos significam perigo. Os mercenários confiscaram um varal inteiro. Ainda acham que roubaram bandeiras.'},
  {id:'bell',title:'03 · A roda e o silêncio',text:'O jacaré apareceu com um sino preso ao pescoço. As crianças o soltaram, e ele ficou. Duas palmas graves e uma aguda avisam que alguém voltou. A pausa é para escutar quem ainda vem pela trilha.'},
  {id:'debt',title:'04 · A concessão do nada',text:'O contrato mercenário promete explorar "terras desocupadas". No verso há trinta casas desenhadas e uma conta de lavanderia. O capitão classificou os moradores como "mobiliário resistente" para não rever o orçamento.'},
  {id:'signal',title:'05 · A frequência das avós',text:'As lavadeiras transmitem recados entre as pedras do riacho. Um rádio interceptado anotou: "o almoço esfriou". A tradução real era: "a ponte está vigiada". O batalhão montou uma operação contra uma panela.'},
  {id:'seed',title:'06 · O futuro cabe num bolso',text:'Uma ordem manda queimar o pomar para apagar rastros. Dentro do envelope alguém escondeu sementes e escreveu: "se eu não voltar, plantem". Há gente cansada de obedecer até entre as cabanas.'},
];

function cabinObjects(index:number): InvestigationObject[] {
  return [
    {id:'bottle',name:'Bebida de procedência duvidosa',rect:[116,270,90,90],text:'"Coragem Líquida — 70% álcool, 30% arrependimento." O rótulo recomenda consumir depois da missão. A garrafa está vazia antes dela.'},
    {id:'magazine',name:'Revista de carreira',rect:[267,345,152,68],text:'MERCENÁRIO DO MÊS: "Como terceirizar a culpa em cinco passos". Na seção de empregos: exige experiência, oferece lápide corporativa. Alguém resolveu as palavras cruzadas com NÃO.'},
    {id:'radio',name:'Radinho de campanha',rect:[120,183,140,80],text:index===1?'O locutor anuncia: "Operação Panela Fria suspensa por falta de talheres". No botão de volume, uma marca azul combina com os tecidos da aldeia.':'"Atenção, tropa: o plano de saúde cobre apenas a parte saudável." Depois, uma voz baixa avisa: três nós vermelhos na ponte. O rádio chia como se tivesse vergonha.'},
    {id:'portrait',name:'Retrato do capitão',rect:[405,64,122,139],text:'O capitão posa com uma medalha de "Presença Confirmada". A moldura custa mais que o soldo. Atrás do retrato, a concessão do rio tem uma assinatura que ninguém da aldeia reconhece.',clue:VILLAGE_LORE[3]},
    {id:'drawer',name:'Gaveta trancada com barbante',rect:[118,363,122,70],text:'Uma gaveta que range mais que o comando. A chave estava desenhada na fechadura. Lá dentro há cartuchos secos, embrulhados num relatório de "paz preventiva".',drawer:true,ammo:18},
    {id:'letter',name:'Carta sob a caneca',rect:[582,345,111,62],text:index===2?'Uma ordem de queima foi riscada. No lugar: "plantem". Um pacotinho de sementes está preso ao papel.':'Uma tabela decifra a frequência do riacho. "Almoço frio" é ponte vigiada; "roupa no varal" é caminho livre. A inteligência militar registrou tudo como previsão do tempo.',clue:VILLAGE_LORE[index===2?5:4]},
    {id:'weapons',name:'Armeiro e manutenção',rect:[733,124,134,155],text:'Armas limpas, coronhas remendadas e um aviso: "Não apontar para colegas sem preencher formulário". Um caderno ensina a contar cartuchos antes de recarregar. A última página diz: "a oficina do Sivirino cobra, mas pelo menos entrega".'},
    {id:'chest',name:'Baú de emergência',rect:[695,392,171,88],text:'Uma reserva escondida sob um par de meias com patente maior que o dono. A etiqueta: "usar somente em emergência". Alguém acrescentou: "estar aqui já conta".',drawer:true,ammo:12},
  ];
}

/** IDs derivam de posições autoradas, independentes de IDs de inimigos/itens e de índices de save. */
export class Exploration {
  readonly spots: ExplorationSpot[];
  constructor(data:LevelData) {
    this.spots=data.stage!==2?[]:data.decos.filter(d=>d.kind==='jHut').map((d,i)=>({
      id:`cabin:${Math.round(d.x/32)}`,x:d.x+(d.flip?-1:1)*buildingStyle(i,true).door*(d.scale??1),y:d.y,cabin:true,
      title:['Palafita do vigia','Cabana do comando','Cabana da retaguarda'][i]??'Cabana mercenária',
      interior: (i === 0 ? 'palafita' : `hut:${i}`) as RoomId,
      subtitle:['O brejo guarda mais que pegadas.','A burocracia chegou antes da paz.','Há uma ordem que ninguém quis cumprir.'][i%3],objects:cabinObjects(i),
    }));
    const homes=data.stage===2?data.decos.filter(d=>d.kind==='villageHome').sort((a,b)=>a.x-b.x):[];
    for(const [i,home] of homes.entries()) {
      const x=villageHomeDoorX(home);
      this.spots.push({id:`house:${Math.round(x/32)}`,x,y:data.level.reliefSurface(x)??home.y,cabin:true,home:true,interior:i === 0 ? 'benedita' : `home:${i}`,
        title:`Casa de ${HOME_NAMES[i]}`,subtitle:i === 0 ? 'A porta está encostada. Alguém tece lá dentro... ou saiu para a roça.' : `${HOME_TRADES[i % 6]} · ${buildingStyle(i).floors === 2 ? 'Sala e andar superior' : 'Casa térrea'} · Entre e conheça.`,objects:[]});
    }
    if(data.stage===2) for(const [i,x] of [774,936,1024].entries()) {
      const y=data.level.reliefSurface(x*32)??1024;
      this.spots.push({id:`village:clue:${i}`,x:x*32,y,cabin:false,
        title:['Marco de Entre-Raízes','Tecido de caminhos','Sino sem coleira'][i],
        subtitle:'Um detalhe da aldeia merece ser observado.',objects:[],clue:VILLAGE_LORE[i]});
    }
  }
  nearest(w:World): ExplorationSpot|undefined {
    const p=w.player;
    if(p.mode!=='foot'||p.lockInput||p.vine||p.swimming||p.crouch||!p.body.onGround||p.hurtT>0||w.director.cine||w.finished||w.village.active)return;
    return this.spots.filter(s=>s.x>=w.blockX&&Math.abs(s.x-p.x)<76&&Math.abs(s.y-p.feetY)<24
      &&w.level.rayHit(p.x,p.y,s.x,s.y-28)<0
      &&!w.solidRects.some(r=>segHitsRect(p.x,p.y,s.x,s.y-28,0,r.x,r.y,r.w,r.h)))
      .sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
  }
  /** Morador expulsou o Karimbo neste trecho: a porta só reabre no próximo checkpoint. */
  locked(w:World,spot:ExplorationSpot) {return !!spot.interior&&w.interiorLock.get(spot.interior)===w.checkpointIdx;}
  /** Há uma porta de interior perto o bastante para valer a pena pré-carregar o módulo. */
  nearInterior(w:World,range=620):ExplorationSpot|undefined {
    const p=w.player;
    return this.spots.find(s=>s.interior&&Math.abs(s.x-p.x)<range&&Math.abs(s.y-p.feetY)<260);
  }
  safe(w:World,spot:ExplorationSpot) {
    return this.nearest(w)===spot&&!this.locked(w,spot)&&!w.enemies.some(e=>e.alive&&Math.hypot(e.x-w.player.x,e.y-w.player.y)<360)
      &&!w.bullets.some(b=>!b.dead&&b.team!==0&&Math.hypot(b.x-w.player.x,b.y-w.player.y)<260)
      &&!w.grenades.some(g=>!g.dead&&Math.hypot(g.x-w.player.x,g.y-w.player.y)<260);
  }
  private mark(w:World,id:string) {
    if(w.encounters.completed.has(id))return;
    w.encounters.completed.add(id);w.hooks.onProgress?.();
  }
  found(w:World,clue:Clue) {return w.encounters.completed.has(`lore:${clue.id}`);}
  discover(w:World,clue:Clue) {this.mark(w,`lore:${clue.id}`);}
  key(spot:ExplorationSpot,obj:InvestigationObject){return `${spot.id}:${obj.id}`;}
  inspect(w:World,spot:ExplorationSpot,obj:InvestigationObject):string {
    if(!this.spots.includes(spot)||!spot.objects.includes(obj))return '';
    const key=this.key(spot,obj);
    if(obj.drawer&&!w.encounters.completed.has(`${key}:open`)) {
      this.mark(w,`${key}:open`);return `${obj.text}\nAberto. Investigue novamente para recolher a reserva.`;
    }
    if(obj.ammo) {
      if(w.encounters.completed.has(key))return 'A reserva já foi recolhida nesta partida. Restaram o barbante e a burocracia.';
      const p=w.player;
      const usable=(id:typeof p.cur)=>id!=='pistol'&&p.weapons.has(id)&&(p.weapons.get(id)??0)<WEAPONS[id].ammoMax;
      const id=usable(p.cur)?p.cur:WEAPON_ORDER.find(usable);
      // A pistola histórica tem reserva infinita. Com só ela, o depósito fornece uma granada.
      if(!id) {
        if(p.grenades>=p.maxGrenades)return 'Suas reservas estão cheias. O material fica aqui até você precisar dele.';
        p.grenades++;this.mark(w,key);return `${obj.text}\n+1 granada de reserva.`;
      }
      const have=p.weapons.get(id)??0;
      const cap=WEAPONS[id].ammoMax;
      if(have>=cap)return 'Sua reserva está cheia. Os cartuchos ficam aqui até você precisar deles.';
      const added=Math.min(obj.ammo,WEAPONS[id].ammoPickup,cap-have);
      p.weapons.set(id,have+added);this.mark(w,key);
      return `${obj.text}\n+${added} de munição para ${WEAPONS[id].name}. Recarregue para abastecer o pente.`;
    }
    this.mark(w,key);if(obj.clue)this.discover(w,obj.clue);
    return obj.text+(obj.clue?'\nFragmento guardado no caderno de Entre-Raízes.':'');
  }
}
