import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bullet } from '../src/game/bullets';
import { Prop } from '../src/game/props';
import { T } from '../src/game/level';
import { makeWorld } from './helpers/bot';

afterEach(() => vi.restoreAllMocks());
function scene() {
  const w = makeWorld();w.invulnerable = false;
  w.level.tiles.fill(0);w.level.relief.fill(0);w.props = [];w.enemies = [];
  w.player.reset(500, 240);w.player.invuln = 0;
  return w;
}
function shot(w: ReturnType<typeof scene>, o: Partial<ConstructorParameters<typeof Bullet>[4]> = {}, reverse = false) {
  const b = new Bullet(reverse ? 400 : 100, 210, reverse ? -18000 : 18000, 0, { team: 0, dmg: 9, r: 2, ...o });
  b.update(w, 1 / 60);return b;
}
const crate = (x: number, solid = true) => new Prop({ id: -1, kind: 'crate', x, y: 228, w: 20, h: 36, solid });
const soldier = (w: ReturnType<typeof scene>, x: number) => w.spawnEnemy({ id: -1, type: 'rifle', x, y: 240 });
function wall(w: ReturnType<typeof scene>, x = 320) { w.level.set(Math.floor(x / 32), 6, T.SOLID); }

describe('ordem espacial dos impactos', () => {
  it.each(['objeto', 'inimigo'] as const)('acerta %s antes de parede mais distante no mesmo passo', kind => {
    const w = scene(), target = kind === 'objeto' ? crate(180) : soldier(w, 180);
    if (kind === 'objeto') w.props = [target as Prop];
    wall(w);const hp = target.hp,b = shot(w);
    expect(target.hp).toBeLessThan(hp);expect(b.dead).toBe(true);expect(b.x).toBeLessThan(180);
  });
  it('atinge o primeiro inimigo mesmo quando o array está invertido e o tiro vem da direita', () => {
    const w = scene(), near = soldier(w, 280), far = soldier(w, 180);
    w.enemies.reverse();const hp = far.hp,b = shot(w, {}, true);
    expect(near.hp).toBeLessThan(near.maxHp);expect(far.hp).toBe(hp);expect(b.x).toBeGreaterThan(280);
  });
  it('atinge o primeiro objeto mesmo quando o array está invertido', () => {
    const w = scene(), near = crate(180), far = crate(280);w.props = [far, near];const b = shot(w);
    expect(near.hp).toBe(near.maxHp - 9);expect(far.hp).toBe(far.maxHp);expect(b.x).toBe(168);
  });
  it.each([true, false])('com cobertura antes=%s, escolhe a menor distância entre soldado e caixa', before => {
    const w = scene(), e = soldier(w, 220), p = crate(before ? 160 : 300);w.props = [p];
    shot(w);expect(e.hp < e.maxHp).toBe(!before);expect(p.hp < p.maxHp).toBe(before);
  });
  it('tiro hostil atinge Karimbo antes de cobertura distante, mas cobertura próxima o protege', () => {
    for (const before of [true, false]) {
      const w = scene();w.player.reset(220, 240);w.player.invuln = 0;const hp = w.player.hp;
      w.props = [crate(before ? 160 : 300)];const b = shot(w, { team: 1 });
      expect(w.player.hp).toBe(before ? hp : hp - 9);expect(b.dead).toBe(true);
    }
  });
  it('explosivo detona no contato com a caixa, uma única vez, antes da parede distante', () => {
    const w = scene(), p = crate(180);w.props = [p];wall(w);
    const boom = vi.spyOn(w, 'explode'),b = shot(w, { kind: 'rocket', explode: { radius: 48, dmg: 18 } });
    b.update(w, 1 / 60);
    expect(boom).toHaveBeenCalledTimes(1);expect(boom).toHaveBeenCalledWith(168,210,48,18,0,expect.any(Object));
  });
  it('a parede anterior impede alcançar qualquer alvo atrás', () => {
    const w = scene(), e = soldier(w, 300),p = crate(280);w.props = [p];wall(w,160);
    shot(w);expect(e.hp).toBe(e.maxHp);expect(p.hp).toBe(p.maxHp);
  });
  it('perfurante atinge só os dois primeiros soldados na ordem física e para no segundo', () => {
    const w = scene(),a = soldier(w, 160),b = soldier(w, 240),c = soldier(w, 320);
    w.enemies.reverse();const order: number[] = [];
    for (const e of [a,b,c]) {
      const hurt = e.hurt.bind(e);vi.spyOn(e,'hurt').mockImplementation((world,dmg,info)=>{order.push(e.x);return hurt(world,dmg,info);});
    }
    const bullet = shot(w, { pierce: 1 });
    expect(order).toEqual([160,240]);expect(c.hp).toBe(c.maxHp);expect(bullet.dead).toBe(true);
  });
  it('perfurante passa por objeto não sólido e inimigo uma vez antes de parar na parede', () => {
    const w = scene(),p = crate(150,false),e = soldier(w,220);w.props = [p];wall(w);
    const hurtProp = vi.spyOn(p,'hurt'),hurtEnemy = vi.spyOn(e,'hurt'),bullet = shot(w, { pierce: 2 });
    expect(hurtProp).toHaveBeenCalledTimes(1);expect(hurtEnemy).toHaveBeenCalledTimes(1);
    expect(bullet.hitList).toEqual([p,e]);expect(bullet.dead).toBe(true);expect(bullet.x).toBeGreaterThanOrEqual(320);
  });
  it('parado dentro de um alvo, o perfurante não repete o dano em outro passo', () => {
    const w = scene(),e = soldier(w,220),hurt = vi.spyOn(e,'hurt');
    const b = new Bullet(220,210,0,0,{team:0,dmg:9,pierce:3});
    b.update(w,1/60);b.update(w,1/60);
    expect(hurt).toHaveBeenCalledTimes(1);expect(b.dead).toBe(false);expect(b.pierce).toBe(2);
  });
  it('escudo frontal consome o tiro antes do soldado atrás, inclusive perfurante', () => {
    const w = scene(),shield = w.spawnEnemy({id:-1,type:'shield',x:170,y:240,facing:-1}),far = soldier(w,300);
    w.enemies.reverse();const hp = shield.hp,b = shot(w,{pierce:2});
    expect(shield.hp).toBe(hp);expect(far.hp).toBe(far.maxHp);expect(b.dead).toBe(true);
  });
  it('plasma mantém a habilidade de atravessar escudo e atingir o alvo seguinte', () => {
    const w = scene(),shield = w.spawnEnemy({id:-1,type:'shield',x:170,y:240,facing:-1}),far = soldier(w,300);
    w.enemies.reverse();const b = shot(w,{kind:'plasma',pierce:1});
    expect(shield.hp).toBeLessThan(shield.maxHp);expect(far.hp).toBeLessThan(far.maxHp);expect(b.dead).toBe(true);
  });
  it('a granada próxima é interceptada antes da caixa e parede posteriores, sem explosão', () => {
    const w = scene();w.spawnEnemyBullet(180,210,0,0,12,'bossShell',{r:5,life:2,interceptable:true,explode:{radius:48,dmg:18}});
    const grenade = w.bullets.at(-1)!,p = crate(250);w.props = [p];wall(w);
    const boom = vi.spyOn(w,'explode'),b = shot(w,{pierce:2});
    expect(grenade.dead).toBe(true);expect(b.dead).toBe(true);expect(p.hp).toBe(p.maxHp);expect(boom).not.toHaveBeenCalled();
  });
  it('i-frames deixam o tiro atravessar o jogador e bater na cobertura posterior', () => {
    const w = scene();w.player.reset(200,240);w.player.invuln = 1;const hp = w.player.hp;
    w.props = [crate(300)];const b = shot(w,{team:1});
    expect(w.player.hp).toBe(hp);expect(b.x).toBe(288);expect(b.dead).toBe(true);
  });
  it('dash neutraliza o tiro na frente da cobertura posterior sem perder vida', () => {
    const w = scene();w.player.reset(200,240);const hp = w.player.hp;
    vi.spyOn(w.player,'isDashing','get').mockReturnValue(true);w.props = [crate(300)];
    const b = shot(w,{team:1});expect(w.player.hp).toBe(hp);expect(b.x).toBeLessThan(200);expect(b.dead).toBe(true);
  });
  it('terreno vence empate exato com objeto e ricochete conserva o comportamento existente', () => {
    const w = scene(),p = crate(262);w.props = [p];vi.spyOn(w.level,'rayHit').mockReturnValue(.5);
    const b = shot(w);expect(p.hp).toBe(p.maxHp);expect(b.x).toBe(250);
    const bounce = shot(w,{wallBounce:true});
    expect(bounce.x).toBe(100);expect(bounce.vx).toBe(-18000);expect(bounce.dead).toBe(false);
  });
});
