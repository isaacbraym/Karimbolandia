import type { EnemySpawn } from '../level';
import type { Enemy } from './enemy';
import { RifleSoldier, ShotgunSoldier, ShieldSoldier, JetpackSoldier, Sniper } from './soldiers';
import { Drone, Turret, HeavyRobot, SpiderBot, MiniMech, RollerMine } from './robots';
import { Felipao } from './felipao';

export function createEnemy(s: EnemySpawn): Enemy {
  switch (s.type) {
    case 'rifle': return new RifleSoldier(s);
    case 'shotgun': return new ShotgunSoldier(s);
    case 'shield': return new ShieldSoldier(s);
    case 'jetpack': return new JetpackSoldier(s);
    case 'sniper': return new Sniper(s);
    case 'drone': return new Drone(s);
    case 'turret': return new Turret(s);
    case 'heavy': return new HeavyRobot(s);
    case 'spider': return new SpiderBot(s);
    case 'minimech': return new MiniMech(s);
    case 'roller': return new RollerMine(s);
    case 'boss': return new Felipao(s);
  }
}
