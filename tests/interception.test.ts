import { describe, expect, it, vi, beforeEach } from 'vitest';
vi.mock('../src/art/hazards', () => ({ drawInterceptableGrenade: vi.fn(), drawLobTarget: vi.fn() }));
import { drawLobTarget } from '../src/art/hazards';
import { World } from '../src/game/world';
import { Bullet } from '../src/game/bullets';
import { circleEntry } from '../src/game/interception';
import { buildJungle } from '../src/game/level/jungle';
import { T } from '../src/game/level';
import { Prop } from '../src/game/props';
import { Grenadier } from '../src/game/enemies/soldiers';
import { newCtl } from './helpers/bot';

beforeEach(() => vi.clearAllMocks());
function scene() {
  const w = new World(buildJungle());
  w.level.tiles.fill(T.EMPTY); w.props = []; w.enemies = [];
  w.player.reset(500, 228); w.player.invuln = 0;
  return w;
}
function grenade(w: World, x = 200, y = 200) {
  w.spawnEnemyBullet(x, y, 0, 0, 12, 'bossShell', { r: 5, life: 2.6, gravity: 620, explode: { radius: 48, dmg: 18 }, interceptable: true });
  return w.bullets.at(-1)!;
}
function shot(w: World, y = 200, pierce = 0) {
  const b = new Bullet(100, y, 12000, 0, { team: 0, dmg: 9, r: 2, life: 1, pierce });
  b.update(w, 1/60); // 200 px num único passo: não pode atravessar a granada.
  return b;
}

describe('Interceptação de granadas', () => {
  it('resolve entrada, tangência, ponto imóvel e segmentos no sentido inverso', () => {
    expect(circleEntry(0,0,20,0,10,0,2)).toBeCloseTo(.4);
    expect(circleEntry(20,0,0,0,10,0,2)).toBeCloseTo(.4);
    expect(circleEntry(0,2,20,2,10,0,2)).toBeCloseTo(.5);
    expect(circleEntry(0,3,20,3,10,0,2)).toBeNull();
    expect(circleEntry(10,0,10,0,10,0,2)).toBe(0);
    expect(circleEntry(0,0,0,0,10,0,2)).toBeNull();
  });
  it('neutraliza sem explosão, dano, moedas ou reativação quando o alvo atualiza depois', () => {
    const w = scene(), g = grenade(w), boom = vi.spyOn(w, 'explode'), hp = w.player.hp;
    const b = shot(w);
    expect(g.dead).toBe(true); expect(b.dead).toBe(true); expect(w.interceptableBullets.size).toBe(0);
    g.update(w, 3);
    expect(boom).not.toHaveBeenCalled(); expect(w.player.hp).toBe(hp);
    expect(w.tokens).toBe(0); expect(w.score).toBe(0);
  });
  it('consome o tiro na granada mais próxima, independente da ordem de lançamento', () => {
    const w = scene(), far = grenade(w,250), near = grenade(w,170);
    const b = shot(w,200,2);
    expect(near.dead).toBe(true); expect(far.dead).toBe(false); expect(b.dead).toBe(true);
    expect(w.interceptableBullets.has(far)).toBe(true);
  });
  it('errar não neutraliza; só a flag explícita em explosivo hostil habilita a mecânica', () => {
    const w = scene(), g = grenade(w);
    expect(shot(w,215).dead).toBe(false); expect(g.dead).toBe(false);
    const normal = new Bullet(250,215,0,0,{team:1,dmg:12,explode:{radius:48,dmg:18}});
    const friendly = new Bullet(250,215,0,0,{team:0,dmg:12,interceptable:true,explode:{radius:48,dmg:18}});
    const plain = new Bullet(250,215,0,0,{team:1,dmg:12,interceptable:true});
    expect([normal.interceptable,friendly.interceptable,plain.interceptable]).toEqual([false,false,false]);
  });
  it.each(['tile','caixa'] as const)('cobertura de %s antes do alvo bloqueia; depois dele não rouba o acerto', kind => {
    for (const x of [160,260]) {
      const w = scene(), g = grenade(w);
      if (kind === 'tile') w.level.tiles[6*w.level.w+Math.floor(x/32)] = T.SOLID;
      else w.props.push(new Prop({ id: -1, kind: 'crate', x, y: 215 }));
      expect(shot(w).dead).toBe(true);
      expect(g.dead).toBe(x > 200);
    }
  });
  it('um soldado na frente recebe o tiro; atrás da granada permanece intacto', () => {
    for (const x of [150,260]) {
      const w = scene(), g = grenade(w), e = w.spawnEnemy({id:-1,type:'rifle',x,y:228}), hp = e.hp;
      shot(w);
      expect(g.dead).toBe(x > 200);
      expect(e.hp).toBe(x < 200 ? hp-9 : hp);
    }
  });
  it('munição perfurante atravessa o soldado antes e é consumida ao neutralizar a granada', () => {
    const w = scene(), g = grenade(w), e = w.spawnEnemy({id:-1,type:'rifle',x:150,y:228}), hp = e.hp;
    const b = shot(w,200,1);
    expect(e.hp).toBe(hp-9); expect(g.dead).toBe(true); expect(b.dead).toBe(true);
  });
  it('granada não neutralizada continua causando dano e explosão normal', () => {
    const w = scene(); w.player.reset(200,228); w.player.invuln = 0;
    const hp = w.player.hp, g = grenade(w), boom = vi.spyOn(w,'explode');
    g.update(w,0);
    expect(g.dead).toBe(true); expect(w.player.hp).toBeLessThan(hp);
    expect(boom).toHaveBeenCalledWith(200,200,48,18,1,expect.any(Object));
  });
  it('expirar não permite interceptar um projétil morto, e limpeza/novo jogo não deixam alvos fantasmas', () => {
    const w = scene(), g = grenade(w);
    g.life = 0; g.update(w,0);
    expect(g.dead).toBe(true); expect(shot(w).dead).toBe(false);
    grenade(w); w.spawnPlayerBullet(100,200,20,0,{team:0,dmg:9});
    w.clearEnemyBullets();
    expect(w.interceptableBullets.size).toBe(0); expect(w.bullets.every(b=>b.team===0)).toBe(true);
    grenade(w); w.startRun(); expect(w.interceptableBullets.size).toBe(0); expect(w.bullets).toEqual([]);
  });
  it('o loop remove alvos expirados; continuar mantém somente granadas distantes que ainda existem', () => {
    const w = scene(), expired = grenade(w,900);
    expired.life=0; w.update(1/60,newCtl());
    expect(w.bullets).not.toContain(expired); expect(w.interceptableBullets.has(expired)).toBe(false);
    for(let x=0;x<60;x++) w.level.tiles[8*w.level.w+x]=T.SOLID;
    w.player.reset(500,256); w.player.deathPos={x:500,y:256};
    const near=grenade(w,500), far=grenade(w,1000);
    w.reviveInPlace();
    expect(w.bullets).not.toContain(near); expect(w.interceptableBullets.has(near)).toBe(false);
    expect(w.bullets).toContain(far); expect(w.interceptableBullets.has(far)).toBe(true);
  });
});

describe('Aviso do granadeiro', () => {
  it('mantém alvo fixo durante preparo, registra somente sua granada e avisa o jogador', () => {
    const w = new World(buildJungle()), s = w.data.enemies.find(e=>e.type==='grenadier')!, e = w.enemies.find(e=>e.spawn.id===s.id) as Grenadier;
    w.player.reset(e.x-300,s.y); w.hooks.onHint = vi.fn();
    for(let i=0;i<25;i++) e.update(w,1/60);
    const target = e.targetX; w.player.body.x -= 100;
    for(let i=0;i<100;i++) e.update(w,1/60);
    expect(e.targetX).toBe(target); expect(w.interceptableBullets.size).toBe(1);
    expect(w.hooks.onHint).toHaveBeenCalledWith('interceptGrenade');
    expect([...w.interceptableBullets][0].explode?.radius).toBe(48);
  });
  it('desenha o alvo visível mesmo com atirador fora da câmera; não desenha morto ou fora da tela', () => {
    const w = scene(), e = new Grenadier({id:-1,type:'grenadier',x:1200,y:228});
    w.camera.x=0; w.camera.y=0; e.mode='charge'; e.charge=.6; e.targetX=200; e.targetY=223;
    const g = {} as CanvasRenderingContext2D;
    expect(w.camera.visible(e.x,e.y,160)).toBe(false);
    e.drawWarnings(g,w); expect(drawLobTarget).toHaveBeenCalledWith(g,200,228,.6,48);
    vi.mocked(drawLobTarget).mockClear(); e.targetX=-1000; e.drawWarnings(g,w); expect(drawLobTarget).not.toHaveBeenCalled();
    e.targetX=200; e.alive=false; e.drawWarnings(g,w); expect(drawLobTarget).not.toHaveBeenCalled();
  });
});
