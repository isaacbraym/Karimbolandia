/**
 * Cérebro da moradora (Dona Benedita). Ela NÃO está em casa: volta da roça depois de um tempo —
 * ou antes, se ouvir barulho pela porta. Dentro de casa mantém uma suspeita 0–100:
 * sobe com o que vê (e com o que descobre depois), desce quando o Karimbo se comporta, e a
 * reputação na aldeia multiplica o ganho. Estados: away → arriving → routine → annoyed → sweeping.
 * Quem devolve a panela vira hóspede de honra: ela cozinha e serve um prato que cura.
 */
import type { InteriorSim } from '../sim';
import type { Cell } from '../grid';
import type { Brain, Npc, VerbDef } from '../types';

export interface HostLines {
  arrive: string[]; met: string[]; suspect: string[]; annoyed: string[]; expel: string[]; calm: string[];
  noise: string[]; joy: string[]; thanks: string[]; offer: string[]; examine: string[]; discovered: string[];
}
export interface Waypoint { x: number; y: number; wait: [number, number]; act?: 'cook' }
export interface HostOpts { waypoints: Waypoint[]; away: [number, number]; speed?: number }

export const HOST = { passive: 28, annoyedAt: 60, expelAt: 100, noiseReturn: 0.25, loud: 22, offerHeal: 55 };

const nearestFree = (s: InteriorSim, at: Cell): Cell => {
  let best = at, bd = 1e9;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = at.x + dx, y = at.y + dy;
    if (!s.grid.walkable(x, y)) continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
};

export function makeHost(lines: HostLines, opts: HostOpts): Brain {
  const speed = opts.speed ?? 1.9;
  const say = (s: InteriorSim, n: Npc, key: keyof HostLines, ttl = 2.8) => s.say(s.line('ben:' + key, lines[key]), n.id, ttl);
  const raise = (s: InteriorSim, n: Npc, d: number) => {
    n.meter = Math.max(0, Math.min(100, n.meter + d));
    if (d > 0) n.data.lastBad = s.t;
  };
  const carrying = (s: InteriorSim) => s.carrying;
  const next = (s: InteriorSim, n: Npc) => {
    const w = opts.waypoints[Math.floor(s.random() * opts.waypoints.length)];
    n.data.wp = opts.waypoints.indexOf(w);
    if (!s.npcGoto(n, { x: w.x, y: w.y })) n.data.wait = 1;
    n.data.wait = -1; // anda; ao chegar, espera
  };
  const arrive = (s: InteriorSim, n: Npc) => {
    n.away = false; n.gx = s.room.door.x + 0.5; n.gy = s.room.door.y + 0.5; n.state = 'arriving'; n.t = 0; n.speed = speed;
    n.dx = 0.7; n.dy = -0.7; n.facing = 1; n.mark = '!'; n.markT = 1.2;
    say(s, n, 'arrive', 3);
    s.sfx('creak', 0.8); s.fx('dust', n.gx, n.gy, 5);
    next(s, n);
  };
  const level = (m: number) => (m >= HOST.expelAt ? 3 : m >= HOST.annoyedAt ? 2 : m >= 30 ? 1 : 0);

  return {
    verbs(s, n): VerbDef[] {
      const v: VerbDef[] = [{ id: 'examine', label: 'Cumprimentar', noise: 0, time: 0.5, pose: 'idle', run: (ss) => ss.say(ss.line('ben:examine', lines.examine), 'karimbo', 3) }];
      if (carrying(s) && n.state !== 'sweeping' && n.state !== 'cooking' && n.state !== 'offering') {
        v.unshift({ id: 'give', label: 'Devolver a panela', noise: 0, time: 0.8, pose: 'take', run: (ss, f) => {
          ss.set('panela'); ss.addRep(25); n.meter = 0; n.data.lvl = 0; n.state = 'cooking'; n.t = 0; n.mark = '!'; n.markT = 2;
          n.data.cook = 5.5; n.data.cooked = 0;
          ss.npcGoto(n, { x: 1, y: 1 });
          say(ss, n, 'joy', 4); ss.fx('heart', n.gx, n.gy, 6); ss.sfx('clap', 0.8); ss.pop('OBRIGADA!', f.gx + 0.5, f.gy + 0.5, '#ff9ac0');
          ss.banner('PANELA DEVOLVIDA', 'A aldeia vai ficar sabendo.');
        } });
      }
      return v;
    },

    hear(s, n, p, at) {
      if (n.away) { n.data.away = (n.data.away ?? 60) - p * HOST.noiseReturn; return; }
      if (p >= HOST.loud && (n.state === 'routine' || n.state === 'arriving')) {
        n.data.inv = 1; n.mark = '?'; n.markT = 1.8; say(s, n, 'noise', 2.4);
        s.npcGoto(n, nearestFree(s, at));
      }
    },

    witness(s, n, act) {
      const irr = act.verb.irritation ?? 0;
      if (!irr) return;
      raise(s, n, irr > 0 ? irr * s.repMult() : irr);
      if (irr > 0 && n.state !== 'sweeping' && n.state !== 'annoyed') { n.mark = '?'; n.markT = 1.4; }
    },

    update(s, n, dt) {
      if (n.data.away === undefined) n.data.away = opts.away[0] + s.random() * (opts.away[1] - opts.away[0]);
      if (n.away) {
        n.data.aware = 0;
        n.data.away -= dt;
        if (n.data.away <= 0) arrive(s, n);
        return;
      }
      n.data.aware = n.meter / 100;
      const sees = s.canSee(n, s.px, s.py);
      const pc = s.cell();
      const priv = !!s.room.isPrivate?.(pc);
      const lvl = n.data.lvl ?? 0;
      const guest = n.state === 'cooking' || n.state === 'offering';

      // primeiro encontro
      if (sees && !n.data.met) {
        n.data.met = 1;
        if (carrying(s)) { n.mark = '!'; n.markT = 2; say(s, n, 'joy', 3.4); n.meter = 0; }
        else { say(s, n, 'met', 3); raise(s, n, 10); }
      }
      // suspeita passiva e calma
      if (!guest && n.state !== 'sweeping') {
        const behaved = s.t - (n.data.lastBad ?? -99) > 6;
        if (sees && priv) raise(s, n, 5 * dt * s.repMult());
        else if (sees && n.meter < HOST.passive && !carrying(s)) raise(s, n, 1 * dt * s.repMult());
        else if (behaved && n.meter > HOST.passive) raise(s, n, -2.5 * dt);
        else if (!sees && n.meter > 0) raise(s, n, -0.8 * dt);
        if (carrying(s) && sees && n.meter > 0) n.meter = Math.max(0, n.meter - 6 * dt);
      }
      // o que ela descobre depois (rastros de ações que ninguém viu)
      for (const tr of s.traces) {
        if (tr.discovered) continue;
        const f = s.furnById.get(tr.fid);
        if (!f) continue;
        const cx = f.gx + f.w / 2, cy = f.gy + f.h / 2;
        if (Math.hypot(n.gx - cx, n.gy - cy) < 2.1 && !guest) {
          tr.discovered = true;
          raise(s, n, tr.irritation * s.repMult());
          n.mark = '?'; n.markT = 1.8; s.say(tr.line, n.id, 3.2); s.fx('poof', cx, cy, 3);
        }
      }
      // degraus de suspeita
      const now = level(n.meter);
      if (now > lvl && !guest) {
        n.data.lvl = now;
        if (now === 1) { n.mark = '?'; n.markT = 2; say(s, n, 'suspect', 3); }
        else if (now === 2) { n.state = 'annoyed'; n.t = 0; n.mark = '!'; n.markT = 2.4; n.speed = speed * 1.15; say(s, n, 'annoyed', 3); s.sfx('whistle', 0.4); }
        else if (now === 3) { n.state = 'sweeping'; n.t = 0; n.mark = '!'; n.markT = 3; n.speed = 3.6; say(s, n, 'expel', 3); s.pop('FORA!', n.gx, n.gy, '#ff5a5a'); s.shake(3, 0.3); s.emit({ type: 'alert', npc: n.id }); }
      } else if (now < lvl) {
        n.data.lvl = now;
        if (n.state === 'annoyed' && now < 2) { n.state = 'routine'; n.t = 0; n.speed = speed; say(s, n, 'calm', 2.6); next(s, n); }
      }

      switch (n.state) {
        case 'arriving':
          if (s.moveNpc(n, dt)) { n.state = 'routine'; n.data.wait = 1 + s.random() * 2; }
          break;
        case 'routine': {
          if (n.data.inv && !n.path.length) { n.data.inv = 0; n.data.wait = 1.4; }
          if (n.path.length) { s.moveNpc(n, dt); break; }
          if (n.data.wait < 0) {
            const w = opts.waypoints[n.data.wp ?? 0];
            n.data.wait = w.wait[0] + s.random() * (w.wait[1] - w.wait[0]);
            if (w.act === 'cook') s.fx('steam', n.gx, n.gy, 2);
          }
          n.data.wait -= dt;
          if (n.data.wait <= 0 && !n.data.inv) next(s, n);
          break;
        }
        case 'annoyed': {
          n.data.rp = (n.data.rp ?? 0) - dt;
          if (Math.hypot(n.gx - s.px, n.gy - s.py) > 1.8) {
            if (n.data.rp <= 0) { n.data.rp = 0.35; s.npcApproach(n, pc); }
            s.moveNpc(n, dt);
          } else {
            n.dx = (s.px - n.gx) / (Math.hypot(n.gx - s.px, n.gy - s.py) || 1); n.dy = (s.py - n.gy) / (Math.hypot(n.gx - s.px, n.gy - s.py) || 1);
          }
          if (n.t > 4.5 && (n.data.talk ?? 0) < s.t) { n.data.talk = s.t + 4.5; say(s, n, 'annoyed', 2.6); }
          break;
        }
        case 'sweeping': {
          n.data.rp = (n.data.rp ?? 0) - dt;
          if (n.data.rp <= 0) { n.data.rp = 0.25; s.npcApproach(n, pc); }
          s.moveNpc(n, dt);
          if (Math.hypot(n.gx - s.px, n.gy - s.py) < 1.4) { s.rt.expelled = 1; s.forceOut(); n.state = 'sweepEnd'; }
          break;
        }
        case 'sweepEnd': break;
        case 'cooking': {
          if (n.path.length) s.moveNpc(n, dt);
          n.data.cook -= dt;
          if (n.data.cooked === 0 && n.data.cook < 4.6) { n.data.cooked = 1; s.fx('steam', 1.5, 0.8, 5); s.sfx('servo', 0.3); }
          if (n.data.cook <= 0) { n.state = 'offering'; n.t = 0; n.data.rp = 0; say(s, n, 'offer', 3); }
          break;
        }
        case 'offering': {
          n.data.rp = (n.data.rp ?? 0) - dt;
          if (Math.hypot(n.gx - s.px, n.gy - s.py) > 1.9 && n.t < 8) {
            if (n.data.rp <= 0) { n.data.rp = 0.4; s.npcApproach(n, pc); }
            s.moveNpc(n, dt);
          } else {
            s.heal(HOST.offerHeal); s.fx('heart', s.px, s.py, 5); s.sfx('heal', 0.9);
            s.say(s.line('ben:thanks', lines.thanks), 'karimbo', 3);
            n.state = 'routine'; n.t = 0; n.data.wait = 2; n.mark = ''; n.speed = speed;
            s.rt.fed = 1;
          }
          break;
        }
      }
    },
  };
}
