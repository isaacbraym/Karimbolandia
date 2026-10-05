import { poly, shadedRR, OUT, type Sprite } from './kit';
import { bakeFace, drawFigure, figureLook, handPos, newPose, type FaceHair, type FaceSpec, type FigureLook, type FigurePose } from './figure';
import { prism } from './volume';
import { LIFE_BOUNDS, paintVillageLife } from './villageLife';
import { clapOpen } from '../core/clapRhythm';
import { paintBuilding } from './buildings';
export const VILLAGE_BOUNDS: Record<string, [number,number,number,number]> = {
  ...LIFE_BOUNDS,
  villageHome: [-116,-254,162,24], villageGarden: [-72,-38,80,11], villagePottery: [-50,-44,57,12],
};
export function paintVillageProp(g: CanvasRenderingContext2D, kind: string, seed: number) {
  if (!VILLAGE_BOUNDS[kind]) return false;
  if (paintVillageLife(g,kind,seed)) return true;
  if (kind === 'villageHome') { paintBuilding(g, seed); return true; }
  g.fillStyle = 'rgba(12,28,15,.2)';
  g.beginPath(); g.ellipse(4,3,50,6,0,0,Math.PI*2); g.fill();
  if (kind === 'villageGarden') {
    prism(g, -66, 2, 106, 5, 31, -21, '#614931');
    g.strokeStyle = '#977850'; g.lineWidth = 1.2;
    for (let x = -54; x < 51; x += 13) {
      g.beginPath(); g.moveTo(x,0); g.lineTo(x+27,-17); g.stroke();
      poly(g,[[x+8,-3],[x-1,-19],[x+8,-13],[x+19,-29],[x+16,-12]],'#708b43',{lw:0.5});
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const x = (i-1)*25, h = 22+i*6;
      g.fillStyle = ['#af7654','#c59468','#8d6048'][i]; g.strokeStyle = OUT; g.lineWidth = 1;
      g.beginPath(); g.ellipse(x,-h*0.45,10+i*2,h*0.5,0,0,Math.PI*2); g.fill(); g.stroke();
      shadedRR(g,x-6,-h,12,6,2,'#6b4939');
      g.strokeStyle = '#e1c798'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x-8,-h*0.5); g.lineTo(x,-h*0.6); g.lineTo(x+8,-h*0.5); g.stroke();
    }
  }
  return true;
}

export type ResidentRole = 'resident'|'farmer'|'washer'|'weaver'|'carrier'|'carpenter'|'child';
export interface ResidentPose { x:number; y:number; id:number; facing:number; walk:number; gesture:number; role?:ResidentRole; work?:number }

// ------------------------------------------------------------------ moradores (figura contínua)
const V_SKINS = ['#8a5634','#a86c43','#6e4026','#c18a5c','#5a3320','#9a6440'];
const V_HAIR = ['#1b1210','#2a1a12','#3b2414','#16100e'];
const V_CLOTH = ['#c4553a','#e0a63a','#3f7d6b','#7a3f6e','#2f5c8a','#d97b3f','#5f8a3a','#b8463f','#e8c868','#4a6fa0'];
const V_IRIS = ['#3a2416','#4a2c18','#2e2a20','#5a3a20'];
interface VillagerArt { calm: Sprite; talk: Sprite; joy: Sprite; look: FigureLook; pose: FigurePose; scale: number }
const villagers = new Map<string, VillagerArt>();
const keyOf = (role: ResidentRole, id: number) => role === 'child' ? `child|${id % 8}` : `${role}|${id % 6}`;

function villagerSpecs(role: ResidentRole, id: number): { face: FaceSpec; body: FigureLook } {
  const v = id * 7 + role.length * 3;
  const kid = role === 'child';
  const feminine = role === 'washer' || role === 'weaver' || (role === 'resident' || role === 'carrier' || kid) && id % 2 === 1;
  const skin = V_SKINS[v % V_SKINS.length];
  const cloth = V_CLOTH[(v + id) % V_CLOTH.length];
  const cloth2 = V_CLOTH[(v * 3 + 4) % V_CLOTH.length];
  const hairStyle: FaceHair = kid
    ? (['puffs', 'curly', 'braids', 'spiky', 'afro', 'short', 'puffs', 'curly'] as FaceHair[])[id % 8]
    : role === 'farmer' ? 'straw'
    : role === 'washer' || role === 'weaver' ? 'wrap'
    : role === 'carrier' ? (feminine ? 'wrap' : 'short')
    : role === 'carpenter' ? (id % 2 ? 'bald' : 'short')
    : feminine ? (id % 3 ? 'braids' : 'afro') : (id % 3 ? 'short' : 'curly');
  const face: FaceSpec = {
    skin, hair: V_HAIR[v % V_HAIR.length], hairStyle, accent: cloth2, iris: V_IRIS[v % V_IRIS.length],
    kid, lashes: feminine, elder: !kid && id % 6 === 5,
    beard: kid || feminine ? 'none' : role === 'carpenter' ? 'full' : id % 3 === 0 ? 'stubble' : 'none',
    earring: feminine && !kid ? '#e8c868' : undefined,
    paint: kid && id % 3 === 0 ? '#f2f0e6' : undefined,
  };
  const body = figureLook({
    skin, top: cloth, top2: cloth2,
    sleeve: role === 'carpenter' || role === 'farmer' ? 0.5 : kid ? 0.5 : feminine ? 0 : 0.5,
    bottom: feminine ? cloth2 : kid ? V_CLOTH[(v + 2) % V_CLOTH.length] : ['#5a4a3a', '#3e4a5a', '#6a5a40'][id % 3],
    bottomKind: feminine ? (kid ? 'skirt' : 'dress') : kid ? 'shorts' : role === 'farmer' ? 'shorts' : 'pants',
    shoe: kid ? '#d9b26a' : '#7a5236',
    limb: kid ? 2.9 : role === 'carpenter' || role === 'carrier' ? 3.8 : 3.3,
    thigh: kid ? 5.8 : 9.4, shin: kid ? 5.4 : 8.8,
    torso: kid ? 8.8 : 11.8, shoulder: kid ? 9 : role === 'carpenter' ? 14 : feminine ? 11 : 12.4,
    hip: kid ? 8.2 : feminine ? 11.4 : 10.2, arm: kid ? 4.8 : 6.6, fore: kid ? 4.8 : 6.4,
    headScale: kid ? 1.42 : 1.14,
    belly: !kid && id % 6 === 5 ? 1.3 : 0,
    apron: role === 'carpenter' ? '#a8865a' : role === 'washer' ? '#e9e0c8' : undefined,
    necklace: feminine || kid && id % 2 ? (id % 2 ? '#e8c868' : '#d9503a') : undefined,
  });
  return { face, body };
}

function villagerArt(role: ResidentRole, id: number): VillagerArt {
  const key = keyOf(role, id);
  let a = villagers.get(key);
  if (!a) {
    const { face, body } = villagerSpecs(role, id);
    const calm = bakeFace(face, 'calm');
    a = { calm, talk: bakeFace(face, 'talk'), joy: role === 'child' ? bakeFace(face, 'joy') : calm, look: body, pose: newPose(calm), scale: role === 'child' ? 1.3 : 1.42 };
    villagers.set(key, a);
  }
  return a;
}

/** Assa todos os rostos da aldeia junto com a arte da selva (nunca no meio de um quadro). */
export function bakeVillagers() {
  const roles: ResidentRole[] = ['resident', 'farmer', 'washer', 'weaver', 'carrier', 'carpenter'];
  for (const r of roles) for (let i = 0; i < 6; i++) villagerArt(r, i);
  for (let i = 0; i < 8; i++) villagerArt('child', i);
}

/** Desenha um morador com os pés em (p.x, p.y). Pose reaproveitada, nada alocado. */
export function drawResident(g: CanvasRenderingContext2D, p: ResidentPose, t:number, talking=false) {
  const role = p.role ?? 'resident';
  const a = villagerArt(role, p.id);
  const L = a.look, P = a.pose, work = p.work ?? 0;
  const reach = L.arm + L.fore;
  const sway = Math.sin(t * 1.4 + p.id);
  P.lean = sway * 0.02; P.hipDrop = 0; P.hipX = sway * 0.4; P.breath = Math.sin(t * 2.2 + p.id) * 0.02;
  const stride = Math.sin(p.walk) * 5.5, lift = Math.max(0, Math.cos(p.walk)) * 2.4;
  P.footFX = 2.4 + stride; P.footFY = stride > 0 ? -lift : 0; P.footBX = -2.2 - stride; P.footBY = stride < 0 ? -lift : 0;
  P.handFX = 2.4 - stride * 0.35; P.handFY = reach * 0.9; P.handBX = -2.2 + stride * 0.35; P.handBY = reach * 0.9;
  P.headTilt = Math.sin(t * 0.8 + p.id * 2) * 0.04;
  P.head = talking ? (Math.sin(t * 20) > -0.25 ? a.talk : a.calm) : a.calm;
  let tool = 0;
  switch (role) {
    case 'child': {
      // palmas no ritmo da roda: mãos se encontram à frente do peito, pulinho no estalo
      const open = clapOpen(t);
      P.handFX = 3.2 + open * 4.5; P.handFY = reach * 0.42 - open * 2;
      P.handBX = 2.6 - open * 5.5; P.handBY = reach * 0.42 - open * 1.6;
      P.hipDrop = (1 - open) * 0.9; P.lean = -0.04; P.headTilt = Math.sin(t * 5 + p.id) * 0.08;
      P.footFY = P.footBY = 0; P.footFX = 2.6; P.footBX = -2.4;
      // olhos abertos e sorrindo; no estalo da palma, aperta os olhos de alegria
      P.head = open < 0.12 ? a.joy : a.talk;
      break;
    }
    case 'farmer':
      // enxada: sobe e desce com o trabalho
      P.lean = 0.12 + work * 0.18;
      P.handFX = 6 + work * 2; P.handFY = reach * 0.3 - work * 6;
      P.handBX = 3.4 + work * 1.5; P.handBY = reach * 0.5 - work * 4;
      tool = 1;
      break;
    case 'washer':
      // torcendo roupa à beira do rio
      P.lean = 0.3 + work * 0.15; P.hipDrop = 2.2;
      P.handFX = 6.5; P.handFY = reach * 0.72 + work * 1.5;
      P.handBX = 4.6; P.handBY = reach * 0.74 - work * 1.5;
      tool = 2;
      break;
    case 'weaver':
      P.handFX = 6 + Math.sin(t * 6 + p.id) * 1.2; P.handFY = reach * 0.5;
      P.handBX = 4; P.handBY = reach * 0.55 + Math.cos(t * 6 + p.id) * 1.2;
      tool = 3;
      break;
    case 'carrier':
      // cesto equilibrado na cabeça, duas mãos segurando
      P.handFX = 4.6; P.handFY = -reach * 0.9; P.handBX = -3.4; P.handBY = -reach * 0.86;
      P.headTilt = 0;
      tool = 4;
      break;
    case 'carpenter':
      P.lean = 0.08;
      P.handFX = 6 + work * 1.5; P.handFY = reach * 0.18 - work * 9;
      P.handBX = 5; P.handBY = reach * 0.6;
      tool = 5;
      break;
    default:
      if (p.gesture > 0.02) {
        const wave = Math.sin(t * 7 + p.id) * 2.4;
        P.handFX = 4 + p.gesture * 2 + wave; P.handFY = reach * (0.9 - p.gesture * 1.75);
      }
  }
  g.save(); g.translate(p.x, p.y); g.scale(p.facing * a.scale, a.scale);
  drawFigure(g, L, P);
  if (tool) {
    const h = handPos(L, P, true);
    g.lineCap = 'round';
    if (tool === 1 || tool === 5) {
      g.save(); g.translate(h.x, h.y); g.rotate(tool === 1 ? 0.5 + work * 0.6 : -0.6 + work * 1.2);
      g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(0, tool === 1 ? -9 : 1); g.lineTo(0, tool === 1 ? 17 : -9); g.stroke();
      g.strokeStyle = '#8a6440'; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = '#a9b4ad'; g.strokeStyle = OUT; g.lineWidth = .7;
      g.beginPath(); if (tool === 1) g.rect(-1.5, 15, 7, 3); else g.rect(-3.5, -12, 7, 3.2); g.fill(); g.stroke();
      g.restore();
    } else if (tool === 2 || tool === 3) {
      g.fillStyle = tool === 2 ? '#d9e4ea' : '#c4553a'; g.strokeStyle = OUT; g.lineWidth = .7;
      g.beginPath(); g.moveTo(h.x - 3, h.y - 1); g.quadraticCurveTo(h.x + 2, h.y + 4 + work * 2, h.x + 1, h.y + 8); g.lineTo(h.x - 4, h.y + 7); g.closePath(); g.fill(); g.stroke();
      if (tool === 3) { g.strokeStyle = '#e8c868'; g.lineWidth = .6; g.beginPath(); g.moveTo(h.x - 3, h.y + 2); g.lineTo(h.x + 1, h.y + 3); g.moveTo(h.x - 3.5, h.y + 4.5); g.lineTo(h.x + 1, h.y + 5.5); g.stroke(); }
    } else {
      const fx = h.x, fy = h.y;
      const bx = (fx + handPos(L, P, false).x) / 2, by = fy - 1;
      g.fillStyle = '#b48a52'; g.strokeStyle = OUT; g.lineWidth = .9;
      g.beginPath(); g.moveTo(bx - 8, by - 6); g.lineTo(bx + 8, by - 6); g.lineTo(bx + 6, by + 1); g.lineTo(bx - 6, by + 1); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#7a5a32'; g.lineWidth = .6; g.beginPath(); g.moveTo(bx - 7, by - 3.5); g.lineTo(bx + 7, by - 3.5); g.stroke();
      for (const [dx, c] of [[-4, '#d47b45'], [0, '#e0c048'], [4, '#7aa04a']] as [number, string][]) { g.fillStyle = c; g.beginPath(); g.arc(bx + dx, by - 7.5, 2.4, 0, Math.PI * 2); g.fill(); }
    }
  }
  g.restore();
}
