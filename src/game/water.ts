/**
 * Água da selva: pântanos rasos (andar devagar, respingos) e o lago fundo (nado com traje de
 * mergulho, peixes, bolhas, luz). A simulação aqui não depende de arte; o desenho fica em
 * `art/waterDraw.ts`.
 */
import type { Level, WaterZone, DecoSpawn } from './level';
import { clamp } from '../core/math';
import { DEEP_PLAN, EEL_SEGMENTS, FISH_SIM_MARGIN, GIANT_COOLDOWN, GIANT_LANE, MAX_AMBIENT_FISH, SHALLOW_PLAN, SPECIES, TUCUNARE_COOLDOWN } from './lake/species';
import type { FishSpecies, LifeSpecies, SpawnReq } from './lake/species';
import { TILE } from './level';

export interface Fish {
  /** espécie ('photo' = os peixes das fotos; as demais têm arte própria, ver lake/species.ts) */
  species: FishSpecies;
  kind: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** largura em px no mundo */
  size: number;
  /** -1 = olhando para a esquerda (como na foto), 1 = direita; `turn` suaviza a virada */
  dir: -1 | 1;
  turn: number;
  /** fase da cauda */
  ph: number;
  speed: number;
  tx: number;
  ty: number;
  /** 0 = ao fundo (escurecido pela água), 1 = meio (mesmo plano do Karimbo), 2 = na frente */
  layer: 0 | 1 | 2;
  /** índice do líder do cardume (-1 = sozinho) */
  lead: number;
  offX: number;
  offY: number;
  wait: number;
  scared: number;
  zone: WaterZone;
  /** 0 = no plano de origem; 1 = afastado da câmera (passando atrás de pedra). Contínuo. */
  depth: number;
  depthGoal: 0 | 1;
  /** segundos seguidos sem pedra no corpo e à frente (histerese da volta) */
  clearT: number;
  /** segundos seguidos dentro de pedra (salvaguarda) */
  rockT: number;
  /** nada rente ao leito (coridora, arraia): folga extra acima do fundo em px; 0 = nada livre */
  hug: number;
  /** temporizador por espécie: tucunaré = pausa entre perseguições; coridora = saltinho; gigante = estacionado */
  cool: number;
  /** de onde vem o susto (a fuga é para longe daqui): o Karimbo ou o tucunaré */
  fx: number;
  fy: number;
  /** tucunaré: tempo restante da perseguição e índice do cardume perseguido (-1 = nenhum) */
  chaseT: number;
  chase: number;
  /** peixe gigante do evento: sentido da travessia (±1); 0 = não é */
  lane: 0 | 1 | -1;
  /** poraquê: posições dos segmentos do corpo (x,y intercalados) */
  seg: Float32Array | null;
  /** pedra por perto (no corpo ou à frente): sem isso a sondagem só roda a cada 3 passos */
  rockNear: boolean;
  /** cardume fiel: acompanha o Karimbo (cosmético, nunca assustado por ele) */
  loyal: boolean;
  /** anel de neon em volta da estátua: índice em `Waters.rings` (-1 = não) e ângulo atual */
  ring: number;
  ang: number;
}

/** Anel orbital (centro/raio em px; `w` em rad/s, sinal = sentido; elipse achatada em y). */
export interface Ring { cx: number; cy: number; r: number; w: number }

/** Cardume de espécie (líder + membros em sequência no vetor de peixes). */
export interface School { lead: number; n: number; species: LifeSpecies }

/** Poeirinha de areia levantada pela arraia (pool fixo, sem alocar por quadro). */
export interface Puff { x: number; y: number; vx: number; vy: number; t: number; max: number }
const MAX_PUFFS = 24;


export const FISH_BACK_SCALE = 0.78; // −22% ao passar atrás da pedra
export const FISH_BACK_FADE = 0.35; // quanto se mistura à água lá atrás
export const FISH_DIVE_RATE = 2.2; // 1/s: ~0,45 s para afastar
export const FISH_RISE_RATE = 1.4; // 1/s: ~0,7 s para voltar
export const FISH_CLEAR_HOLD = 0.3; // s livres antes de voltar
export const FISH_LOOKAHEAD = 0.8; // s de antecipação da pedra
/** escala de desenho: diminui um pouco quando o peixe se afasta da câmera */
export const fishScale = (f: Fish) => 1 - (1 - FISH_BACK_SCALE) * f.depth;
/** passe de desenho: 0 = fundo (antes da névoa), 1 = meio (antes dos tiles), 2 = frente (depois do Karimbo) */
export const fishPass = (f: Fish): 0 | 1 | 2 => (f.layer === 0 ? 0 : f.layer === 2 && f.depth < 0.5 ? 2 : 1);

export interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  ph: number;
  life: number;
  top: number;
}

export interface Ripple {
  x: number;
  y: number;
  t: number;
  max: number;
  r: number;
}

/** Semente estável (sem Math.random na criação: mesma fase = mesmos peixes). */
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Waters {
  zones: WaterZone[];
  fish: Fish[] = [];
  bubbles: Bubble[] = [];
  ripples: Ripple[] = [];
  vents: { x: number; y: number; t: number }[] = [];
  schools: School[] = [];
  puffs: Puff[] = [];
  rings: Ring[] = [];
  /** alvo do cardume fiel (o Karimbo) e o susto das piranhas; preenchidos pelo mundo a cada quadro */
  loyalX = 0;
  loyalY = 0;
  loyalFear: { x: number; y: number } | null = null;
  /** o cardume fiel já nasceu? (índice do líder; -1 = não) */
  loyalLead = -1;
  private lifeRnd = mulberry(4242);
  private level: Level;
  private rnd = mulberry(9001);
  time = 0;
  private tick = 0;

  constructor(zones: WaterZone[], level: Level, decos: DecoSpawn[]) {
    this.zones = zones;
    this.level = level;
    for (const d of decos) {
      if (d.kind === 'uVent') this.vents.push({ x: d.x, y: d.y - 4, t: 0 });
      else if (d.kind === 'uVentLine') for (const o of [-18, 0, 18]) this.vents.push({ x: d.x + o, y: d.y - 4, t: o / 40 });
    }
    for (let i = 0; i < MAX_PUFFS; i++) this.puffs.push({ x: 0, y: 0, vx: 0, vy: 0, t: 1, max: 1 });
    this.spawnFish();
  }

  reset() {
    this.bubbles.length = 0;
    this.ripples.length = 0;
    this.fish.length = 0;
    this.schools.length = 0;
    this.rings.length = 0;
    this.loyalLead = -1;
    for (const p of this.puffs) p.t = p.max;
    this.rnd = mulberry(9001);
    this.lifeRnd = mulberry(4242);
    this.spawnFish();
  }

  // ------------------------------------------------------------------ consultas
  /** Zona de água que contém o ponto (px). */
  zoneAt(x: number, y: number): WaterZone | null {
    for (const z of this.zones) if (x >= z.x && x < z.x + z.w && y >= z.y && y <= z.y + z.h) return z;
    return null;
  }
  /** Lago em que o ponto está submerso. */
  lakeAt(x: number, y: number): WaterZone | null {
    const z = this.zoneAt(x, y);
    return z && z.kind === 'lake' ? z : null;
  }
  /** Profundidade (px) do pântano nos pés (0 = seco). */
  wadeDepth(x: number, feetY: number): number {
    for (const z of this.zones) {
      if (z.kind !== 'swamp' || x < z.x || x >= z.x + z.w) continue;
      if (feetY > z.y && feetY <= z.y + z.h + 2) return feetY - z.y;
    }
    return 0;
  }

  // ------------------------------------------------------------------ peixes
  /** Só os limites da zona (o peixe nunca sai da água). */
  private inZone(z: WaterZone, x: number, y: number, pad: number) {
    // margem vertical ~ meia altura do peixe: antes os grandes subiam até a superfície e o recorte do
    // lago cortava o alto da cabeça
    return !(x < z.x + pad || x > z.x + z.w - pad || y < z.y + pad * 1.3 + 6 || y > z.y + z.h - pad * 1.1);
  }
  /** Corpo do peixe encosta em pedra? */
  private rockAt(x: number, y: number, pad: number) {
    const L = this.level;
    return L.solidAtPx(x, y) || L.solidAtPx(x - pad * 0.6, y) || L.solidAtPx(x + pad * 0.6, y) || L.solidAtPx(x, y + pad * 0.4);
  }
  /** Água livre: alvos e nascimento só em pontos assim, então o peixe nunca "mora" dentro da pedra. */
  private freeAt(z: WaterZone, x: number, y: number, pad: number) {
    return this.inZone(z, x, y, pad) && !this.rockAt(x, y, pad);
  }

  /** Topo do leito abaixo de (x, y): varre para baixo em passos de 8 px (só ao escolher alvo, nunca por quadro). */
  private floorTop(x: number, y: number): number | null {
    for (let k = 0; k < 60; k++) {
      const yy = y + k * 8;
      if (this.level.solidAtPx(x, yy)) return yy;
    }
    return null;
  }

  private pickTarget(f: Fish) {
    const z = f.zone;
    if (f.hug > 0) {
      // rente ao leito: o alvo fica logo acima do chão e perto (para não cortar colinas)
      const mp = Math.max(10, f.size * 0.35);
      for (let i = 0; i < 12; i++) {
        const x = f.x + (this.rnd() - 0.5) * 520;
        const top = this.floorTop(x, f.y - 40);
        if (top === null) continue;
        const y = top - mp * 0.4 - 4 - f.hug * 0.3;
        if (this.inZone(z, x, y, mp) && !this.rockAt(x, y, mp)) {
          f.tx = x;
          f.ty = y;
          return;
        }
      }
      f.tx = f.x;
      f.ty = f.y;
      return;
    }
    const pad = Math.max(24, f.size * 0.6);
    const reach = f.species === 'pirarucu' ? 1500 : Math.min(z.w, 900);
    const rise = f.species === 'pirarucu' ? 110 : Math.min(z.h, 160);
    for (let i = 0; i < 12; i++) {
      // nadam mais na horizontal (alvos largos e pouco altos)
      const x = f.x + (this.rnd() - 0.5) * reach;
      const y = f.y + (this.rnd() - 0.5) * rise;
      if (this.freeAt(z, x, y, pad)) {
        f.tx = x;
        f.ty = y;
        return;
      }
    }
    f.tx = z.x + z.w / 2;
    f.ty = z.y + z.h * 0.45;
  }

  private spawnFish() {
    for (const z of this.zones) {
      if (z.kind !== 'lake') continue;
      const area = (z.w * z.h) / 10000;
      const r = this.rnd;
      const add = (size: number, layer: 0 | 1 | 2, lead = -1, offX = 0, offY = 0): Fish | null => {
        let x = 0;
        let y = 0;
        let ok = false;
        for (let k = 0; k < 30 && !ok; k++) {
          x = z.x + 40 + r() * (z.w - 80);
          y = z.y + 30 + r() * (z.h - 60);
          ok = this.freeAt(z, x, y, Math.max(20, size * 0.5));
        }
        if (!ok) return null;
        const f: Fish = {
          kind: r() < 0.5 ? 0 : 1, x, y, vx: 0, vy: 0, size, dir: r() < 0.5 ? -1 : 1, turn: 1, ph: r() * 6.28,
          speed: (size < 44 ? 70 : size < 90 ? 46 : 30) * (0.8 + r() * 0.4), tx: x, ty: y, layer, lead, offX, offY, wait: r() * 2, scared: 0, zone: z,
          depth: 0, depthGoal: 0, clearT: 0, rockT: 0,
          species: 'photo', hug: 0, cool: 0, fx: 0, fy: 0, chaseT: 0, chase: -1, lane: 0, seg: null, rockNear: false, loyal: false, ring: -1, ang: 0,
        };
        f.turn = f.dir;
        this.fish.push(f);
        return f;
      };
      // gigantes lentos (2–3), médios solitários e cardumes de pequenos — densidade pelo tamanho do lago
      const nBig = Math.max(3, Math.round(area * 0.04));
      const nMid = Math.max(6, Math.round(area * 0.09));
      const nSchools = Math.max(3, Math.round(area * 0.05));
      for (let i = 0; i < nBig; i++) add(118 + r() * 46, i === 0 ? 2 : r() < 0.5 ? 1 : 0);
      for (let i = 0; i < nMid; i++) add(54 + r() * 36, r() < 0.45 ? 0 : 1);
      for (let s = 0; s < nSchools; s++) {
        const leader = add(30 + r() * 10, s % 2 === 0 ? 1 : 0);
        if (!leader) continue;
        const li = this.fish.length - 1;
        const kind = leader.kind;
        for (let k = 0; k < 6; k++) {
          const f = add(22 + r() * 14, leader.layer, li, -18 - (k % 3) * 22 - r() * 8, ((k % 2) * 2 - 1) * (10 + r() * 14));
          if (f) {
            f.kind = kind;
            const nx = leader.x + f.offX;
            const ny = leader.y + f.offY;
            if (this.freeAt(z, nx, ny, 16)) {
              f.x = nx;
              f.y = ny;
            }
          }
        }
      }
      // ao fundo, peixinhos distantes
      for (let i = 0; i < Math.max(5, Math.round(area * 0.08)); i++) add(18 + r() * 12, 0);
      // vida de rio: o lago raso principal e Atlântida (o laguinho da aldeia fica como está)
      if (z.surface !== undefined) this.spawnLife(z, DEEP_PLAN);
      else if (z.w >= 60 * TILE) this.spawnLife(z, SHALLOW_PLAN);
    }
  }

  private newFish(species: LifeSpecies, z: WaterZone, x: number, y: number, size: number, layer: 0 | 1 | 2, r: () => number): Fish {
    const def = SPECIES[species];
    const dir: -1 | 1 = r() < 0.5 ? -1 : 1;
    return {
      species, kind: 0, x, y, vx: 0, vy: 0, size, dir, turn: dir, ph: r() * 6.28, speed: def.speed * (0.85 + r() * 0.3), tx: x, ty: y,
      layer, lead: -1, offX: 0, offY: 0, wait: r() * 2, scared: 0, zone: z, depth: 0, depthGoal: 0, clearT: 0, rockT: 0,
      hug: def.hug, cool: 0, fx: 0, fy: 0, chaseT: 0, chase: -1, lane: 0, rockNear: false, loyal: false, ring: -1, ang: 0,
      seg: species === 'poraque' ? new Float32Array(EEL_SEGMENTS * 2) : null,
    };
  }

  /** Ponto de água livre para um grupo (determinístico: usa só o gerador próprio da vida do lago). */
  private lifePoint(z: WaterZone, req: SpawnReq, gi: number, size: number, r: () => number): [number, number] | null {
    const pad = Math.max(20, size * 0.5);
    for (let k = 0; k < 60; k++) {
      let x: number;
      let y: number;
      if (req.where === 'near' && req.at) {
        const [tx, ty] = req.at[gi % req.at.length];
        x = tx * TILE + (r() - 0.5) * 360;
        y = ty * TILE + (r() - 0.5) * 220;
      } else {
        x = z.x + 40 + r() * (z.w - 80);
        y = z.y + 30 + r() * (z.h - 60);
        if (req.where === 'floor') {
          // do fundo da zona para cima, até achar água livre sobre o leito
          let yy = z.y + z.h - 8;
          while (yy > z.y + 20 && this.level.solidAtPx(x, yy)) yy -= 8;
          const top = this.floorTop(x, yy - 8);
          if (top === null) continue;
          y = top - Math.max(10, size * 0.35) * 0.4 - 6;
        }
      }
      const fp = req.where === 'floor' ? Math.max(10, size * 0.35) : pad;
      if (req.where === 'floor' ? this.inZone(z, x, y, fp) && !this.rockAt(x, y, fp) : this.freeAt(z, x, y, pad)) return [x, y];
    }
    return null;
  }

  private spawnLife(z: WaterZone, plan: SpawnReq[]) {
    const r = this.lifeRnd;
    for (const req of plan) {
      const def = SPECIES[req.species];
      for (let gi = 0; gi < req.groups; gi++) {
        const n = Math.round(def.group[0] + r() * (def.group[1] - def.group[0]));
        if (this.fish.length + n > MAX_AMBIENT_FISH) return;
        const size = def.size[0] + r() * (def.size[1] - def.size[0]);
        const p = this.lifePoint(z, req, gi, size, r);
        if (!p) continue;
        const layer = req.layer ?? def.layer;
        const lead = this.newFish(req.species, z, p[0], p[1], size, layer, r);
        if (req.species === 'poraque') this.initSegments(lead);
        const li = this.fish.length;
        this.fish.push(lead);
        if (n > 1) this.schools.push({ lead: li, n: n - 1, species: req.species });
        for (let k = 0; k < n - 1; k++) {
          const sz = def.size[0] + r() * (def.size[1] - def.size[0]);
          const f = this.newFish(req.species, z, p[0], p[1], sz, layer, r);
          f.lead = li;
          // treliça: colunas atrás do líder, linhas alternadas em altura (gira junto com o líder)
          const col = k % 4;
          const row = (k >> 2) - 3;
          f.offX = -(sz * 1.1 + col * sz * 1.25 + r() * 3);
          f.offY = row * sz * 0.95 + (col % 2) * sz * 0.4;
          f.speed = lead.speed;
          const nx = p[0] + f.offX;
          const ny = p[1] + f.offY;
          if (this.freeAt(z, nx, ny, 10)) {
            f.x = nx;
            f.y = ny;
          }
          this.fish.push(f);
        }
        if (req.species === 'tucunare') lead.cool = TUCUNARE_COOLDOWN[0] + r() * (TUCUNARE_COOLDOWN[1] - TUCUNARE_COOLDOWN[0]);
        if (req.species === 'pirarucu' && gi === 0) {
          // o evento "peixe gigante": cruza o palácio na frente, no máximo 1× a cada GIANT_COOLDOWN s
          const gx = GIANT_LANE.x0 * TILE;
          const gy = GIANT_LANE.y * TILE;
          const giant = this.newFish('pirarucu', z, gx, gy, 215, 2, r);
          if (this.freeAt(z, gx, gy, 80)) {
            giant.lane = 1;
            giant.cool = GIANT_COOLDOWN * 0.5;
            this.fish.push(giant);
          }
        }
      }
    }
  }

  /** Anéis de neon (40 peixes) em volta de um ponto: `converge` = nascem longe e voam até a órbita. */
  spawnRings(cx: number, cy: number, converge: boolean) {
    const specs: [number, number][] = [[150, 0.5], [220, -0.4]];
    const r = this.lifeRnd;
    const zone = this.zoneAt(cx, cy) ?? this.zones.find((z) => z.surface !== undefined) ?? this.zones[0];
    for (const [radius, w] of specs) {
      if (this.fish.length + 20 > MAX_AMBIENT_FISH) return; // nunca deixa um anel sem peixes
      const ri = this.rings.length;
      this.rings.push({ cx, cy, r: radius, w });
      for (let k = 0; k < 20; k++) {
        if (this.fish.length >= MAX_AMBIENT_FISH) return;
        const f = this.newFish('neon', zone, cx, cy, SPECIES.neon.size[0] + r() * 3, 2, r);
        f.ring = ri;
        f.ang = (k / 20) * Math.PI * 2 + (w < 0 ? 0.3 : 0);
        const tx = cx + Math.cos(f.ang) * radius, ty = cy + Math.sin(f.ang) * radius * 0.42;
        f.x = converge ? cx + (r() - 0.5) * 1100 : tx;
        f.y = converge ? cy + (r() - 0.5) * 420 : ty;
        f.layer = 2;
        this.fish.push(f);
      }
    }
  }

  /** Cardume fiel: 20 neons que acompanham o Karimbo (nasce perto dele). */
  spawnLoyal(x: number, y: number) {
    if (this.loyalLead >= 0 || this.fish.length + 21 > MAX_AMBIENT_FISH) return;
    // a zona de onde o cardume nasce (o lago raso e Atlântida são zonas diferentes)
    const zone = this.zoneAt(x, y) ?? this.zones.find((z) => z.surface !== undefined) ?? this.zones[0];
    const r = this.lifeRnd;
    const li = this.fish.length;
    const lead = this.newFish('neon', zone, x - 60, y - 10, 13, 2, r);
    lead.loyal = true;
    lead.speed = 90;
    this.fish.push(lead);
    this.loyalLead = li;
    this.schools.push({ lead: li, n: 20, species: 'neon' });
    for (let k = 0; k < 20; k++) {
      const sz = 11 + r() * 3;
      const f = this.newFish('neon', zone, lead.x, lead.y, sz, 2, r);
      f.lead = li;
      f.loyal = true;
      const col = k % 4, row = (k >> 2) - 2;
      f.offX = -(sz * 1.1 + col * sz * 1.25);
      f.offY = row * sz * 0.95 + (col % 2) * sz * 0.4;
      f.speed = 90;
      f.x = lead.x + f.offX;
      f.y = lead.y + f.offY;
      this.fish.push(f);
    }
  }

  private initSegments(f: Fish) {
    const seg = f.seg!;
    const gap = f.size / (EEL_SEGMENTS + 0.5);
    for (let i = 0; i < EEL_SEGMENTS; i++) {
      seg[i * 2] = f.x - i * gap * f.dir;
      seg[i * 2 + 1] = f.y;
    }
  }

  /** Levanta uma nuvenzinha de areia (≤ 6 partículas) no ponto. */
  private sandPuff(x: number, y: number) {
    let made = 0;
    for (const p of this.puffs) {
      if (p.t < p.max) continue;
      p.x = x + (Math.random() - 0.5) * 22;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 22;
      p.vy = -8 - Math.random() * 12;
      p.t = 0;
      p.max = 0.8 + Math.random() * 0.6;
      if (++made >= 6) break;
    }
  }

  // ------------------------------------------------------------------ simulação
  /** `px,py`: Karimbo (peixes fogem dele); `active`: o lago está perto da câmera. */
  update(dt: number, px: number, py: number, swimming: boolean, viewX0: number, viewX1: number) {
    this.time += dt;
    this.tick++;
    const near = (z: WaterZone) => z.x + z.w > viewX0 - 600 && z.x < viewX1 + 600;
    // peixes
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i];
      // longe da câmera o peixe fica congelado (nada se vê; poupa a simulação de ~1000 peixes)
      if (!near(f.zone) || f.x < viewX0 - FISH_SIM_MARGIN || f.x > viewX1 + FISH_SIM_MARGIN) continue;
      const z = f.zone;
      const dxp = f.x - px;
      const dyp = f.y - py;
      const d2 = dxp * dxp + dyp * dyp;
      const fearR = 60 + f.size * 0.9;
      if (f.species !== 'pirarucu' && f.species !== 'poraque' && !f.loyal && f.ring < 0) {
        if (swimming && d2 < fearR * fearR && f.layer === 1) { f.scared = 1.2; f.fx = px; f.fy = py; }
        else if (swimming && d2 < fearR * fearR * 0.5) { f.scared = Math.max(f.scared, 0.6); f.fx = px; f.fy = py; }
      }
      let tx: number;
      let ty: number;
      let spd = f.speed;
      if (f.species === 'tucunare') this.tucunare(f, dt);
      if (f.scared > 0) {
        f.scared -= dt;
        const sdx = f.x - f.fx;
        const sdy = f.y - f.fy;
        const d = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
        tx = f.x + (sdx / d) * 200;
        ty = f.y + (sdy / d) * 90;
        spd *= 2.6;
      } else if (f.species === 'tucunare' && f.chaseT > 0) {
        // persegue um cardume (nunca o come): o cardume foge dele
        const sc = this.schools[f.chase];
        const L = this.fish[sc.lead];
        tx = L.x;
        ty = L.y;
        spd *= 2.4;
        f.chaseT -= dt;
        for (let m = 0; m <= sc.n; m++) {
          const mf = this.fish[sc.lead + m];
          mf.scared = Math.max(mf.scared, 0.5);
          mf.fx = f.x;
          mf.fy = f.y;
        }
        if (f.chaseT <= 0) f.cool = TUCUNARE_COOLDOWN[0] + this.lifeRnd() * (TUCUNARE_COOLDOWN[1] - TUCUNARE_COOLDOWN[0]);
      } else if (f.ring >= 0) {
        // anel em volta da estátua: segue o ponto da órbita (a metade da frente passa na frente da pedra)
        const R = this.rings[f.ring];
        f.ang += R.w * dt;
        tx = R.cx + Math.cos(f.ang) * R.r;
        ty = R.cy + Math.sin(f.ang) * R.r * 0.42;
        f.layer = Math.sin(f.ang) > 0 ? 2 : 1;
        spd = Math.max(Math.abs(R.w) * R.r * 1.05, Math.hypot(tx - f.x, ty - f.y) * 2.4);
        spd = Math.min(spd, 420);
      } else if (f.loyal && f.lead < 0) {
        // líder do cardume fiel: paira perto do Karimbo e some do perigo
        const fear = this.loyalFear;
        if (fear && Math.hypot(f.x - fear.x, f.y - fear.y) < 170) {
          f.scared = 0.9;
          f.fx = fear.x;
          f.fy = fear.y;
        }
        tx = this.loyalX - 64;
        ty = this.loyalY - 14;
        spd = Math.min(260, Math.max(f.speed, Math.hypot(tx - f.x, ty - f.y) * 1.6));
      } else if (f.lane !== 0) {
        // gigante do evento: cruza o palácio e fica estacionado (à deriva) até a próxima travessia
        if (f.cool > 0) {
          f.cool -= dt;
          tx = f.x - f.lane * 30;
          ty = f.y;
          spd *= 0.2;
        } else {
          tx = (f.lane > 0 ? GIANT_LANE.x1 : GIANT_LANE.x0) * TILE;
          ty = GIANT_LANE.y * TILE;
          if (Math.abs(f.x - tx) < 140) {
            f.lane = f.lane > 0 ? -1 : 1;
            f.cool = GIANT_COOLDOWN + this.lifeRnd() * 30;
          }
        }
      } else if (f.lead >= 0) {
        const L = this.fish[f.lead];
        const back = L.dir === 1 ? 1 : -1;
        tx = L.x + f.offX * back;
        ty = L.y + f.offY + Math.sin(this.time * 1.7 + i) * 4;
        // quem ficou para trás (depois de um susto) acelera para voltar à treliça
        const gap = Math.hypot(tx - f.x, ty - f.y);
        spd = L.speed * 1.35 + 30 + Math.max(0, gap - 60) * 1.1;
      } else {
        if (f.wait > 0) {
          f.wait -= dt;
          spd *= 0.25;
        }
        const ddx = f.tx - f.x;
        const ddy = f.ty - f.y;
        if (ddx * ddx + ddy * ddy < 24 * 24) {
          this.pickTarget(f);
          f.wait = this.rnd() < 0.4 ? 0.6 + this.rnd() * 1.8 : f.species === 'bandeira' ? 1.5 + this.rnd() * 3 : 0;
          if (f.species === 'arraia') this.sandPuff(f.x, f.y + f.size * 0.12);
        }
        tx = f.tx;
        ty = f.ty;
      }
      const ddx = tx - f.x;
      const ddy = ty - f.y;
      const dd = Math.hypot(ddx, ddy) || 1;
      const want = Math.min(spd, dd * 2.2);
      const ax = (ddx / dd) * want - f.vx;
      const ay = ((ddy / dd) * want) * 0.6 - f.vy;
      const k = clamp(dt * (f.scared > 0 ? 5 : 1.6), 0, 1);
      f.vx += ax * k;
      f.vy += ay * k;
      if (f.species === 'coridora') {
        // saltinhos rentes ao fundo
        f.cool -= dt;
        if (f.cool <= 0) {
          f.cool = 0.7 + this.lifeRnd() * 1.3;
          if (Math.abs(f.vx) > 8) f.vy -= 38;
        }
      }
      let nx = f.x + f.vx * dt;
      let ny = f.y + f.vy * dt;
      // pedra: em vez de travar, o peixe se afasta da câmera (encolhe, mistura-se à água), passa por
      // trás e volta; só a borda da zona d'água limita
      const pad = Math.max(10, f.size * 0.35);
      const lead = f.lead >= 0 ? this.fish[f.lead] : null;
      // sondar pedra custa 12 consultas: longe de qualquer pedra basta a cada 3 passos (a antecipação de
      // 0,8 s cobre dezenas de px; em 3 passos o peixe anda < 10 px)
      let rockHere = false;
      let rockAhead = false;
      if (f.rockNear || (this.tick + i) % 3 === 0) {
        rockHere = this.rockAt(nx, ny, pad);
        rockAhead = this.rockAt(f.x + f.vx * FISH_LOOKAHEAD, f.y + f.vy * FISH_LOOKAHEAD, pad)
          || this.rockAt(f.x + f.vx * FISH_LOOKAHEAD * 0.5, f.y + f.vy * FISH_LOOKAHEAD * 0.5, pad);
        f.rockNear = rockHere || rockAhead || f.depthGoal === 1 || f.depth > 0;
      }
      if (rockHere || rockAhead || (lead !== null && lead.depthGoal === 1)) { f.depthGoal = 1; f.clearT = 0; }
      else if ((f.clearT += dt) >= FISH_CLEAR_HOLD) f.depthGoal = 0;
      f.depth = f.depthGoal === 1 ? Math.min(1, f.depth + dt * FISH_DIVE_RATE) : Math.max(0, f.depth - dt * FISH_RISE_RATE);
      // ainda no plano e prestes a entrar na pedra: espera afastar (sem estalo de camada, sem rebote)
      if (rockHere && f.depth < 0.5) { nx = f.x; ny = f.y; f.vx *= 0.5; f.vy *= 0.5; }
      // salvaguarda: preso atrás de pedra por muito tempo, escolhe outro alvo em água livre
      f.rockT = rockHere ? f.rockT + dt : 0;
      if (f.rockT > 5 && f.lead < 0) { this.pickTarget(f); f.rockT = 0; }
      if (f.loyal) {
        // cardume fiel: segue o Karimbo por qualquer água do lago (raso e fenda), sem a parede de zona
        const zz = this.lakeAt(nx, ny);
        if (zz) f.zone = zz;
        else { nx = f.x; ny = f.y; f.vx *= 0.5; f.vy *= 0.5; }
      } else if (!this.inZone(z, nx, ny, pad)) {
        if (this.inZone(z, nx, f.y, pad)) ny = f.y, (f.vy *= -0.4);
        else if (this.inZone(z, f.x, ny, pad)) nx = f.x, (f.vx *= -0.4);
        else {
          nx = f.x;
          ny = f.y;
          f.vx *= -0.5;
          f.vy *= -0.5;
          if (f.lead < 0) this.pickTarget(f);
        }
      }
      f.x = nx;
      f.y = ny;
      if (f.seg) this.followSegments(f);
      if (Math.abs(f.vx) > 6) f.dir = f.vx > 0 ? 1 : -1;
      f.turn += (f.dir - f.turn) * clamp(dt * 7, 0, 1);
      f.ph += dt * (4 + Math.hypot(f.vx, f.vy) * 0.09) * (f.size < 40 ? 1.6 : 1);
      // bolhinha de vez em quando
      if (f.size > 50 && this.bubbles.length < 90 && Math.random() < dt * 0.25) this.addBubble(f.x + (f.turn < 0 ? -1 : 1) * f.size * 0.42, f.y - f.size * 0.1, 1.2 + Math.random() * 1.6, z.y);
    }
    // fontes de bolhas no fundo
    for (const v of this.vents) {
      if (v.x < viewX0 - 200 || v.x > viewX1 + 200) continue;
      v.t -= dt;
      if (v.t <= 0) {
        v.t = 0.08 + Math.random() * 0.35;
        const z = this.zoneAt(v.x, v.y);
        if (z) this.addBubble(v.x + (Math.random() - 0.5) * 8, v.y, 1 + Math.random() * 3, z.y);
      }
    }
    // bolhas
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life += dt;
      b.vy = Math.max(-70 - b.r * 18, b.vy - 160 * dt);
      b.y += b.vy * dt;
      b.x += Math.sin(b.life * 7 + b.ph) * 14 * dt;
      let gone = false;
      if (b.y <= b.top + b.r) {
        if (b.r > 1.8 && this.ripples.length < 40) this.ripples.push({ x: b.x, y: b.top, t: 0, max: 0.7, r: 6 + b.r * 2 });
        gone = true;
      } else if (b.life > 9) gone = true;
      // troca com o último (a ordem das bolhas não importa; nada de splice)
      if (gone) {
        const last = this.bubbles.pop()!;
        if (last !== b) this.bubbles[i] = last;
      }
    }
    // areia levantada pela arraia
    for (const p of this.puffs) {
      if (p.t >= p.max) continue;
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 1.5;
      p.vy *= 1 - dt * 1.5;
    }
    // ondas na superfície
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.t += dt;
      if (r.t >= r.max) this.ripples.splice(i, 1);
    }
  }

  /** Tucunaré: de tempos em tempos escolhe o cardume mais próximo e o espanta (sem comer ninguém). */
  private tucunare(f: Fish, dt: number) {
    if (f.chaseT > 0) return;
    f.cool -= dt;
    if (f.cool > 0) return;
    let best = -1;
    let bd = 700 * 700;
    for (let i = 0; i < this.schools.length; i++) {
      const sc = this.schools[i];
      if (sc.species !== 'neon' && sc.species !== 'cardinal') continue;
      const L = this.fish[sc.lead];
      if (L.zone !== f.zone) continue;
      const d = (L.x - f.x) * (L.x - f.x) + (L.y - f.y) * (L.y - f.y);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) f.cool = 4;
    else { f.chase = best; f.chaseT = 3; }
  }

  /** Corpo do poraquê: cada segmento persegue o anterior mantendo o espaçamento (O(segmentos)). */
  private followSegments(f: Fish) {
    const seg = f.seg!;
    const gap = (f.size * fishScale(f)) / (EEL_SEGMENTS + 0.5); // acompanha o encolhimento atrás da pedra
    seg[0] = f.x;
    seg[1] = f.y;
    for (let i = 1; i < EEL_SEGMENTS; i++) {
      const dx = seg[(i - 1) * 2] - seg[i * 2];
      const dy = seg[(i - 1) * 2 + 1] - seg[i * 2 + 1];
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = (d - gap) / d;
      seg[i * 2] += dx * k;
      seg[i * 2 + 1] += dy * k;
    }
  }

  addBubble(x: number, y: number, r: number, top: number) {
    if (this.bubbles.length >= 160) return;
    this.bubbles.push({ x, y, r, vy: -20 - Math.random() * 30, ph: Math.random() * 6.28, life: 0, top });
  }

  ripple(x: number, y: number, r = 14, max = 0.8) {
    if (this.ripples.length >= 40) this.ripples.shift();
    this.ripples.push({ x, y, t: 0, max, r });
  }
}
