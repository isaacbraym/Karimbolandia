/**
 * Personagens do interior: Karimbo (rig real, rosto de foto) e os NPCs (rig contínuo de figura +
 * rostos assados). Escalas reduzidas para caber nos tiles; poses extras são só transformações.
 */
import { getArt } from '../index';
import { drawKarimbo, type KPose, type KState } from '../karimbo';
import { bakeFace, drawFigure, figureLook, newPose, type FaceSpec, type FigureLook, type FigurePose } from '../figure';
import { OUT, type Sprite } from '../kit';
import type { InteriorSim } from '../../game/interior/sim';
import type { Npc } from '../../game/interior/types';
import { heightOf } from './furniture';

const K_SCALE = 0.62;
const NPC_SCALE = 0.62;

interface NpcArt { look: FigureLook; faces: Record<'calm' | 'talk' | 'fear' | 'joy', Sprite>; pose: FigurePose; scale: number }
const npcArt = new Map<string, NpcArt>();

const SPECS: Record<string, { face: FaceSpec; look: Parameters<typeof figureLook>[0]; scale: number }> = {
  benedita: {
    scale: 1.42,
    face: { skin: '#8a5634', hair: '#d9d5cc', hairStyle: 'bun', accent: '#c4553a', iris: '#3a2416', lashes: true, elder: true, earring: '#e8c868' },
    look: { skin: '#8a5634', top: '#c4553a', top2: '#f0d27a', sleeve: 0.5, bottom: '#b44a35', bottomKind: 'dress', shoe: '#7a5236',
      limb: 3.4, thigh: 9.2, shin: 8.6, torso: 11.4, shoulder: 11.4, hip: 11.8, arm: 6.4, fore: 6.2, headScale: 1.14, belly: 0.6,
      apron: '#efe6cf', necklace: '#e8c868' },
  },
  cabo: {
    scale: 1.42,
    face: { skin: '#c68a5c', hair: '#2a1a12', hairStyle: 'cap', accent: '#4a5a34', iris: '#3a2416', beard: 'mustache' },
    look: { skin: '#c68a5c', top: '#56633b', top2: '#2e3a22', sleeve: 0.5, bottom: '#3f4832', bottomKind: 'pants', shoe: '#2a1c12',
      limb: 3.9, thigh: 9.6, shin: 9, torso: 12.2, shoulder: 13.4, hip: 10.8, arm: 6.8, fore: 6.6, headScale: 1.14, belly: 0.9 },
  },
};

/** Assa os rostos dos NPCs da sala (chamar durante a íris, nunca no meio de um quadro). */
export function warmActors(sim: InteriorSim) {
  for (const n of sim.npcs) artOf(n.id);
}
export function clearActorCache() { npcArt.clear(); }

function artOf(id: string): NpcArt | null {
  let a = npcArt.get(id);
  if (a) return a;
  const spec = SPECS[id];
  if (!spec) return null;
  const faces = { calm: bakeFace(spec.face, 'calm'), talk: bakeFace(spec.face, 'talk'), fear: bakeFace(spec.face, 'fear'), joy: bakeFace(spec.face, 'joy') };
  a = { look: figureLook(spec.look), faces, pose: newPose(faces.calm), scale: spec.scale };
  npcArt.set(id, a);
  return a;
}

function shadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, a = 0.3) {
  g.fillStyle = `rgba(8,14,16,${a})`;
  g.beginPath(); g.ellipse(x, y + 1, rx, rx * 0.46, 0, 0, Math.PI * 2); g.fill();
}

// ───────────────────────────────────────────────────────────────────────── Karimbo
const kpose: KPose = {
  facing: 1, state: 'idle', t: 0, runPhase: 0, speed01: 0, aim: 0, weapon: 'pistol', kick: 0, flash: false, earGlide: 0, vy: 0,
  alpha: 1, hasGun: false,
};

export function drawKarimboIso(g: CanvasRenderingContext2D, sim: InteriorSim, x: number, y: number, s: number, t: number, alpha: number) {
  const art = getArt().karimbo;
  const lying = sim.pose === 'lie', sitting = sim.pose === 'sit';
  let z = 0;
  if (sim.on) { const f = sim.furnById.get(sim.on); if (f) z = heightOf(f) * (lying ? 0.62 : 0.4); }
  shadow(g, x, y, 15 * s, 0.32 * alpha);
  const sc = s * K_SCALE;
  g.save();
  g.translate(x, y - z * s);
  g.scale(sc, sc);
  let st: KState = 'idle';
  let speed = 0, squash = 0, lean = 0;
  if (sim.moving) { st = 'run'; speed = sim.sneaking ? 0.42 : 0.82; lean = sim.sneaking ? 0.22 : 0.06; }
  else if (sitting) st = 'crouch';
  const pose = kpose;
  pose.facing = sim.facing; pose.t = t; pose.state = st; pose.runPhase = sim.walkPhase; pose.speed01 = speed; pose.alpha = alpha;
  pose.idleT = t; pose.lean = lean; pose.clap = sim.pose === 'mirror'; pose.clapTime = t;
  if (sim.pose === 'eat') squash = Math.sin(t * 16) * 0.35;
  else if (sim.pose === 'take' || sim.pose === 'poke') squash = Math.min(0.5, Math.sin(Math.min(1, sim.poseT * 3) * Math.PI) * 0.45);
  else if (sim.pose === 'kick') { squash = -0.3; pose.lean = 0.35; }
  else if (sim.pose === 'pet') { st = 'crouch'; pose.state = 'crouch'; }
  pose.squash = squash;
  if (lying) {
    g.translate(0, -26);
    g.rotate(-sim.facing * Math.PI / 2 * 0.96);
    g.translate(0, 26);
    pose.state = 'idle'; pose.idleT = t;
  }
  drawKarimbo(g, art, 0, 0, pose);
  g.restore();
  // item em mãos (panela de barro)
  if (sim.carrying) drawPot(g, x + sim.facing * 12 * s, y - 15 * s - z * s, s * 0.75);
}

export function drawPot(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = '#b56a45'; g.strokeStyle = OUT; g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(0, 0, 7.5, 6.2, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#7a4128'; g.beginPath(); g.ellipse(0, -4.6, 5.2, 1.7, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e8c88a'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, 1); g.quadraticCurveTo(0, 4, 6, 1); g.stroke();
  g.restore();
}

// ───────────────────────────────────────────────────────────────────────── NPCs
export function drawNpc(g: CanvasRenderingContext2D, sim: InteriorSim, n: Npc, x: number, y: number, s: number, t: number) {
  const a = artOf(n.id);
  if (!a) {
    shadow(g, x, y, 12 * s);
    g.fillStyle = '#c9a'; g.fillRect(x - 6 * s, y - 40 * s, 12 * s, 40 * s);
    return;
  }
  const L = a.look, P = a.pose;
  const sc = NPC_SCALE * s * (a.scale / 1.42) * 1.0;
  const talking = n.markT > 0 && n.mark === '!' || sim.talking === n.id;
  const lying = n.state === 'asleep' || n.state === 'stirring' || n.state === 'tripped';
  const sit = n.state === 'half';
  const walking = n.path.length > 0 || n.state === 'chase' || n.state === 'sweeping';
  const reach = L.arm + L.fore;
  const sway = Math.sin(t * 1.4);
  P.lean = sway * 0.02; P.hipDrop = 0; P.hipX = sway * 0.4; P.breath = Math.sin(t * 2.2) * 0.02;
  const stride = walking ? Math.sin(n.walk * 1.8) * 5.5 : 0, lift = Math.max(0, Math.cos(n.walk * 1.8)) * 2.4;
  P.footFX = 2.4 + stride; P.footFY = stride > 0 ? -lift : 0; P.footBX = -2.2 - stride; P.footBY = stride < 0 ? -lift : 0;
  P.handFX = 2.4 - stride * 0.35; P.handFY = reach * 0.9; P.handBX = -2.2 + stride * 0.35; P.handBY = reach * 0.9;
  P.headTilt = Math.sin(t * 0.8) * 0.04;
  P.head = talking ? (Math.sin(t * 20) > -0.25 ? a.faces.talk : a.faces.calm) : (n.mark === '!' ? a.faces.fear : a.faces.calm);
  if (n.id === 'cabo' && (n.state === 'asleep' || n.state === 'stirring')) P.head = a.faces.calm;
  if (n.state === 'sweeping' || n.state === 'chase') { P.handFX = 6; P.handFY = reach * 0.1 - Math.sin(t * 14) * 4; P.handBX = 3; P.handBY = reach * 0.3; P.lean = 0.12; }
  if (n.mark === '!' && n.id === 'benedita') { P.handFX = 5; P.handFY = reach * 0.5; P.handBX = 4; P.handBY = reach * 0.52; }
  if (sit) { P.hipDrop = 7; P.lean = 0.18; P.footFX = 5; P.footBX = 2; }
  if (n.state === 'cooking') { P.lean = 0.14; P.handFX = 6 + Math.sin(t * 6) * 1.5; P.handFY = reach * 0.55; }
  shadow(g, x, y, 13 * s, lying ? 0.12 : 0.3);
  g.save();
  g.translate(x, y);
  if (lying) {
    const hang = n.state === 'tripped' ? 0 : 24 * s;
    g.translate(0, -hang);
    g.rotate(n.facing * -Math.PI / 2 * (n.state === 'stirring' ? 0.94 + Math.sin(t * 3) * 0.04 : 0.98));
    g.translate(0, -2);
    P.hipDrop = 1; P.footFX = 3; P.footBX = -1; P.footFY = P.footBY = 0;
  }
  const big = lying ? 1.65 : 1;
  g.scale(n.facing * sc * big, sc * big);
  drawFigure(g, L, P);
  g.restore();
  // chapéu sobre o rosto do Cabo dormindo
  if (n.id === 'cabo' && n.state === 'asleep') {
    g.save();
    g.translate(x + n.facing * 27 * s, y - 29 * s);
    g.rotate(n.facing * 0.3);
    g.fillStyle = '#4a5a34'; g.strokeStyle = OUT; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(0, 0, 14 * s, 6.5 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#3a4828'; g.beginPath(); g.ellipse(-1 * s, -3 * s, 8 * s, 3.2 * s, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}
