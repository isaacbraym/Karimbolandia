/**
 * Arte da balada: seguranças e holofotes na porta da frente, canhões de luz, multidão pulando no
 * tempo da música, Sivirino de calção dançando e estrobo leve durante a cena. Peças assadas uma vez
 * (rostos e corpos dos civis); por quadro só transformações e formas simples (sem gradiente).
 */
import type { World } from '../game/world';
import { CLUB_CROWD, CLUB_T } from '../game/club';
import { bakeCivilians, civArtFor } from './civilians';
import { bakeFace, drawFigure, figureLook, newPose, type FigureLook, type FigurePose } from './figure';
import { glowSprite, OUT, type Sprite } from './kit';
import { sivirinoHead } from './merchant';
import { SOLDIER_SCALE } from './soldiers';
import { music } from '../core/music';
import { bakeDancers, drawDancer } from './clubDancers';

interface ClubArt {
  bouncer: { look: FigureLook; pose: FigurePose };
  siv: { look: FigureLook; pose: FigurePose } | null;
}
let art: ClubArt | null = null;

/** Assa rostos/corpos da multidão e dos seguranças (carregamento da fase 1). */
export function bakeClubArt() {
  if (art) return art;
  bakeCivilians(CLUB_CROWD);
  bakeDancers();
  const face = bakeFace({ skin: '#5e3820', hair: '#1c1424', hairStyle: 'bald', accent: '#111', iris: '#2a1a12', glasses: true, beard: 'stubble' }, 'calm');
  const bouncer = {
    look: figureLook({ skin: '#5e3820', top: '#15151c', top2: '#e8e8f0', sleeve: 0.5, bottom: '#22232c', bottomKind: 'pants', shoe: '#0c0c10',
      limb: 4.4, thigh: 9.6, shin: 9, torso: 13, shoulder: 16.5, hip: 12, arm: 6.6, fore: 6.4, headScale: 1.08, belly: 0.8 }),
    pose: newPose(face),
  };
  const head = sivirinoHead();
  const siv = head ? {
    // sem camisa, calção laranja e chinelo: o Sivirino pronto para a pista
    look: figureLook({ skin: '#7d5034', top: '#7d5034', top2: '#5f3a24', sleeve: 0, bottom: '#ff8a2a', bottomKind: 'shorts', shoe: '#1d6fd1',
      limb: 3.9, thigh: 9.2, shin: 8.6, torso: 12.6, shoulder: 13.6, hip: 11.4, arm: 6.8, fore: 6.6, headScale: 1.2, belly: 1.8 }),
    pose: newPose(head),
  } : null;
  art = { bouncer, siv };
  return art;
}

const front = (w: World) => {
  const r = w.club.room!;
  let x = -Infinity;
  for (const d of w.data.doors) if (d.kind === 'in' && d.tx >= r.x && d.tx <= r.x + r.w && d.x > x) x = d.x;
  return Number.isFinite(x) ? x : r.x;
};

export function drawClub(g: CanvasRenderingContext2D, w: World, layer: 'back' | 'front') {
  const club = w.club;
  const r = club.room;
  if (!r || typeof document === 'undefined') return;
  const a = art ?? bakeClubArt();
  const t = w.time;
  const beat = music.beat();
  const cam = w.camera;
  if (layer === 'back') {
    // ---- porta da frente: holofotes, cordão de veludo e seguranças
    const fx = front(w);
    // calçada: a linha dos pés da porta da frente
    const street = w.data.doors.find((d) => d.x === fx)?.y ?? r.y - 64;
    if (cam.visible(fx, street - 120, 360)) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const ang = -Math.PI / 2 + Math.sin(t * 0.7 + i * 2.2) * 0.45;
        const bx = fx + (i ? 70 : -70);
        g.globalAlpha = 0.12;
        g.fillStyle = i ? '#ff4fd0' : '#39f0ff';
        g.beginPath();
        g.moveTo(bx, street - 6);
        g.lineTo(bx + Math.cos(ang - 0.08) * 620, street + Math.sin(ang - 0.08) * 620);
        g.lineTo(bx + Math.cos(ang + 0.08) * 620, street + Math.sin(ang + 0.08) * 620);
        g.closePath();
        g.fill();
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      // cordão de veludo
      g.strokeStyle = '#b3123c';
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(fx - 64, street - 22);
      g.quadraticCurveTo(fx - 46, street - 12, fx - 28, street - 22);
      g.stroke();
      for (const px of [fx - 64, fx - 28]) {
        g.fillStyle = '#d9b44a';
        g.fillRect(px - 2, street - 28, 4, 28);
        g.strokeStyle = OUT;
        g.lineWidth = 1;
        g.strokeRect(px - 2, street - 28, 4, 28);
      }
      for (const [bx, face] of [[fx - 46, 1], [fx + 40, -1]] as [number, 1 | -1][]) drawBouncer(g, a, bx, street, face, t);
    }
    if (!cam.visible(r.x + r.w / 2, r.y + r.h / 2, r.w / 2 + 80)) return;
    // ---- dentro: canhões de luz, multidão e o Sivirino
    const raving = w.musicState === 'rave' || w.musicState === 'club' || w.musicState === 'drop';
    g.globalCompositeOperation = 'lighter';
    const cols = ['#ff4fd0', '#39f0ff', '#ffd23a', '#7a5cff'];
    for (let i = 0; i < 6; i++) {
      const sx = r.x + ((i + 0.5) / 6) * r.w;
      const ang = Math.PI / 2 + Math.sin(t * (club.active ? 2.2 : 0.9) + i * 1.3) * 0.6;
      g.globalAlpha = club.active ? 0.16 : 0.08;
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.moveTo(sx, r.y);
      g.lineTo(sx + Math.cos(ang - 0.1) * r.h * 1.2, r.y + Math.sin(ang - 0.1) * r.h * 1.2);
      g.lineTo(sx + Math.cos(ang + 0.1) * r.h * 1.2, r.y + Math.sin(ang + 0.1) * r.h * 1.2);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // Piso profundo, juntas diagonais e reflexos no mesmo plano dos pés.
    g.fillStyle = '#252139';
    g.beginPath();g.moveTo(r.x,club.floorY);g.lineTo(r.x+r.w,club.floorY);
    g.lineTo(r.x+r.w-16,club.floorY-156);g.lineTo(r.x+86,club.floorY-156);g.closePath();g.fill();
    g.save();g.clip();
    g.strokeStyle='#555074';g.lineWidth=1;
    for(let x=r.x-120;x<r.x+r.w+120;x+=64){g.beginPath();g.moveTo(x,club.floorY);g.lineTo(x+86,club.floorY-156);g.stroke();}
    for(let z=0;z<=156;z+=26){g.beginPath();g.moveTo(r.x,club.floorY-z);g.lineTo(r.x+r.w,club.floorY-z);g.stroke();}
    g.globalAlpha=.18;for(let i=0;i<6;i++){g.fillStyle=cols[i%4];g.beginPath();g.ellipse(r.x+(i+.5)*r.w/6,club.floorY-70,85,20,-.1,0,Math.PI*2);g.fill();}g.restore();
    for (let i = 0; i < club.crowd.length; i++) {
      const d = club.crowd[i];
      if (!cam.visible(d.x, club.floorY - d.depth - 40, 80)) continue;
      const ca = civArtFor(d.look);
      if (!ca) continue;
      const k = (beat + d.phase) % 1;
      const y=club.floorY-d.depth,sc=ca.scale*d.scale;
      g.fillStyle='rgba(8,5,18,.35)';g.beginPath();g.ellipse(d.x,y+1,17*d.scale,5*d.scale,0,0,Math.PI*2);g.fill();
      drawDancer(g,i,d.x,y-(raving?(1-k)**2*5:0),sc,d.facing,k);
    }
    if (a.siv && Number.isFinite(club.sivX)) drawSivirino(g, a.siv, club.sivX, club.floorY, t, beat, club.active);
  } else if (club.active && club.t > CLUB_T.dance && club.t < CLUB_T.turn && beat < 0.12) {
    // estrobo leve no tempo forte (sem piscar a tela inteira)
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.07;
    g.fillStyle = '#ffffff';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}

function drawBouncer(g: CanvasRenderingContext2D, a: ClubArt, x: number, y: number, facing: 1 | -1, t: number) {
  const { look, pose: P } = a.bouncer;
  const breath = Math.sin(t * 1.6 + x) * 0.02;
  P.lean = 0; P.hipDrop = 0; P.hipX = 0; P.breath = breath;
  P.footBX = -4; P.footBY = 0; P.footFX = 4; P.footFY = 0;
  // braços cruzados na frente do peito
  P.handFX = 3; P.handFY = 6.5; P.handBX = 5; P.handBY = 5.5;
  P.headTilt = Math.sin(t * 0.5 + x) * 0.04;
  g.save();
  g.translate(x, y);
  g.scale(facing * SOLDIER_SCALE * 0.98, SOLDIER_SCALE * 0.98);
  drawFigure(g, look, P);
  g.scale(facing, 1); // texto da camiseta nunca espelhado
  g.fillStyle = '#e8e8f0';
  g.font = 'bold 2.4px sans-serif';
  g.textAlign = 'center';
  g.fillText('SEGURANÇA', 0.5, -26.5);
  g.restore();
}

function drawSivirino(g: CanvasRenderingContext2D, s: { look: FigureLook; pose: FigurePose }, x: number, y: number, t: number, beat: number, hype: boolean) {
  const P = s.pose;
  const L = s.look;
  const reach = L.arm + L.fore;
  const db = t * (150 / 60) * Math.PI;
  const sw = Math.sin(db * 0.5);
  // rebolado, braços para cima alternando, passinho para os lados
  P.lean = sw * 0.14;
  P.hipX = sw * 2.2;
  P.hipDrop = (1 - beat) * (hype ? 1.6 : 0.8);
  P.breath = 0;
  P.footFX = 3 + Math.max(0, Math.sin(db)) * 3;
  P.footFY = -Math.max(0, Math.sin(db)) * 2.2;
  P.footBX = -3 - Math.max(0, -Math.sin(db)) * 3;
  P.footBY = -Math.max(0, -Math.sin(db)) * 2.2;
  P.handFX = 4 + Math.sin(db) * 3;
  P.handFY = -reach * (0.7 + 0.25 * Math.sin(db));
  P.handBX = -4 - Math.sin(db) * 3;
  P.handBY = -reach * (0.7 - 0.25 * Math.sin(db));
  P.headTilt = sw * 0.12;
  g.save();
  g.translate(x, y);
  g.scale(SOLDIER_SCALE * 0.95, SOLDIER_SCALE * 0.95);
  drawFigure(g, L, P);
  g.restore();
  // brilho de suor da pista
  const glow: Sprite = glowSprite('#ffd23a', 32);
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.18;
  g.drawImage(glow.c, x - 26, y - 70, 52, 52);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}
