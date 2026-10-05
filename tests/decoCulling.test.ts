import {afterEach,describe,expect,it,vi} from 'vitest';
import {World} from '../src/game/world';
import {buildLevel} from '../src/game/level/index';
import {buildJungle} from '../src/game/level/jungle';
import * as decor from '../src/art/decor';

afterEach(()=>vi.restoreAllMocks());

describe('Seleção reutilizada do cenário',()=>{
  it('mantém arte, ordem, paralaxe e destruição ao andar, voltar e mudar o zoom',()=>{
    const draw=vi.spyOn(decor,'drawDeco').mockImplementation(()=>{});
    const g={save(){},restore(){},translate(){}} as unknown as CanvasRenderingContext2D;
    for(const data of [buildLevel(),buildJungle()]) {
      const w=new World(data),cam=w.camera;
      for(const [x,width,zoom] of [[0,800,1],[200,800,1],[240,800,1],[511,800,1],[512,800,1],
        [354*32,800,.8],[920*32,1100,1],[920*32+40,1100,.72],[354*32,800,1],[200,800,1]]) {
        cam.x=x;cam.viewW=width;cam.zoom=zoom;
        for(const layer of ['back','front'] as const) {
          const expected=data.decos.filter((d,i)=>{
            if(d.par||d.layer!==layer||w.smash.smashed.has(i))return false;
            const bounds=decor.decoExtent(d);return bounds[2]>=cam.x&&bounds[0]<=cam.x+cam.w;
          });
          if(layer==='front')for(const d of data.decos)if(d.par){
            const b=decor.decoExtent(d),ox=(d.x-(cam.x+cam.w/2))*d.par;
            if(b[2]+ox>=cam.x&&b[0]+ox<=cam.x+cam.w)expected.push(d);
          }
          draw.mockClear();w.director.drawDecos(g,layer);
          expect(draw.mock.calls.map(([,d])=>d)).toEqual(expected);
          const first=data.decos.indexOf(expected.find(d=>!d.par)!);
          if(first>=0)w.smash.smashed.add(first);
        }
      }
    }
  });

  it('movimento dentro dos mesmos buckets evita refazer busca e limites de cada peça',()=>{
    const w=new World(buildJungle()),cam=w.camera;
    vi.spyOn(decor,'drawDeco').mockImplementation(()=>{});
    const extent=vi.spyOn(decor,'decoExtent');
    const buckets=(w.director as any).decoBuckets;
    const back=vi.spyOn(buckets.back,'get'),front=vi.spyOn(buckets.front,'get');
    const g={save(){},restore(){},translate(){}} as unknown as CanvasRenderingContext2D;
    cam.x=100;cam.viewW=600;cam.zoom=1;
    for(const layer of ['back','front'] as const)w.director.drawDecos(g,layer);
    const queries=back.mock.calls.length+front.mock.calls.length;
    for(let frame=0;frame<120;frame++) {
      cam.x=100+frame/12;
      for(const layer of ['back','front'] as const)w.director.drawDecos(g,layer);
    }
    expect(back.mock.calls.length+front.mock.calls.length).toBe(queries);
    expect(extent).not.toHaveBeenCalled();
    cam.x+=600;w.director.drawDecos(g,'back');
    expect(back.mock.calls.length+front.mock.calls.length).toBeGreaterThan(queries);
  });
});
