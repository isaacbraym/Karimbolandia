import { afterEach, describe, expect, it, vi } from 'vitest';
import { audio, AudioEngine, type ClipHandle } from '../src/core/audio';
import { music } from '../src/core/music';
import { Game } from '../src/game/game';
import { CLUB_DANCE_ID } from '../src/game/club';
import { buildJungle } from '../src/game/level/jungle';
import { waterSurfaceBounds } from '../src/art/waterDraw';
import { GROUND_DEPTH } from '../src/art/perspective';
import { makeWorld, newCtl } from './helpers/bot';

afterEach(() => vi.restoreAllMocks());

function inClub() {
  const w = makeWorld(); w.enemies = []; w.director.cine = null;
  for (const t of w.data.triggers) w.director.triggered.add(t.id);
  w.encounters.completed.add(CLUB_DANCE_ID); w.club.reset(w);
  w.player.reset(w.club.spotX, w.club.floorY);
  return w;
}

describe('Água, saída e trilha da balada', () => {
  it('mantém a música na sala após a cena, sem alternar para exploração a cada quadro', () => {
    const w = inClub(), changes: string[] = [];
    w.hooks.onMusic = s => changes.push(s);
    for (let f = 0; f < 300; f++) w.update(1 / 60, newCtl());
    expect(w.musicState).toBe('club');
    expect(changes).toEqual(['club']);
    w.player.reset(100, 1024); w.update(1 / 60, newCtl());
    expect(w.musicState).toBe('explore');
  });

  it('a saída real chega ao ponto externo desenhado e devolve os controles', () => {
    const w = inClub(), d = w.data.doors.find(d => d.kind === 'out')!;
    w.player.reset(d.x, d.y);
    for (let f = 0; f < 4; f++) w.update(1 / 60, newCtl());
    const ctl = newCtl(); ctl.moveY = 1; w.update(1 / 60, ctl);
    for (let f = 0; f < 48; f++) w.update(1 / 60, newCtl());
    expect(w.player.x).toBeCloseTo(d.tx);
    expect(w.player.feetY).toBeCloseTo(d.ty);
    expect(w.player.lockInput).toBe(false);
    expect(w.club.inside(w)).toBe(false);
    expect(w.musicState).toBe('explore');
  });

  it('recupera o MP3 decodificado depois do fallback e não duplica o loop', () => {
    const w = inClub();
    const game = Object.assign(Object.create(Game.prototype), { world: w, state: 'playing', wasMusic: null, clubClip: null });
    const handle: ClipHandle = { playing: true, elapsed: () => 1, stop: vi.fn(), pause: vi.fn(), resume: vi.fn(), setVol: vi.fn() };
    vi.spyOn(music, 'play').mockImplementation(() => undefined);
    vi.spyOn(audio, 'ready', 'get').mockReturnValue(true);
    const ready = vi.spyOn(audio, 'clipReady').mockReturnValue(false);
    const play = vi.spyOn(audio, 'playMusicClip').mockReturnValue({ ...handle, playing: false });
    game.setMusic('club'); expect(game.clubClip.playing).toBe(false);
    ready.mockReturnValue(true); play.mockReturnValue(handle);
    game.retryClubMusic(); game.retryClubMusic();
    expect(play).toHaveBeenCalledTimes(2); // tentativa inicial + recuperação
    expect(play).toHaveBeenLastCalledWith('balada', { loop: true, vol: 1, fadeIn: .25 });
    expect(game.clubClip.playing).toBe(true);
    game.setMusic('explore'); expect(handle.stop).toHaveBeenCalledOnce();
    game.retryClubMusic(); expect(play).toHaveBeenCalledTimes(2);
  });

  it('a decodificação notifica quando o contexto está pronto, e pausa/saída impedem início tardio', () => {
    const engine = new AudioEngine(), notify = vi.fn(); engine.onPlayable = notify;
    const ctx = { state: 'running', decodeAudioData: (_: ArrayBuffer, ok: (b: AudioBuffer) => void) => ok({} as AudioBuffer) };
    Object.assign(engine, { ctx, clipData: new Map([['balada', new ArrayBuffer(8)]]) });
    (engine as any).decodeClip('balada');
    expect(engine.clipReady('balada')).toBe(true); expect(notify).toHaveBeenCalledOnce();
    const w = inClub(), game = Object.assign(Object.create(Game.prototype), { world: w, state: 'paused', wasMusic: 'club', setMusic: vi.fn() });
    game.retryClubMusic(); expect(game.setMusic).not.toHaveBeenCalled();
    game.state = 'playing'; w.player.reset(100, 1024); game.retryClubMusic();
    expect(game.setMusic).not.toHaveBeenCalled();
  });

  it('a água acompanha a projeção das margens e não cria superfície na câmara profunda', () => {
    const data = buildJungle(), before = JSON.stringify(data.water);
    for (const z of data.water) {
      const plane = waterSurfaceBounds(z);
      if (z.surface !== undefined) expect(plane).toBeNull();
      else expect(plane).toEqual({ x: z.x, y: z.y - GROUND_DEPTH.y, w: z.w + GROUND_DEPTH.x, h: GROUND_DEPTH.y });
    }
    expect(JSON.stringify(data.water)).toBe(before); // física e fôlego continuam com a linha frontal
    const thinker = data.decos.find(d => d.kind === 'aThinker')!;
    const route = data.decos.find(d => d.kind === 'aThinkerRoute')!;
    expect(route.x).toBeLessThan(thinker.x);
    expect(data.water.some(z => z.surface !== undefined && thinker.x > z.x && thinker.x < z.x + z.w && thinker.y <= z.y + z.h)).toBe(true);
  });
});
