import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, checkStartupVersion, wasUpdateAttempted } from '../src/core/update';

let replace: ReturnType<typeof vi.fn>;
let session: Map<string, string>;
beforeEach(() => {
  session = new Map();
  replace = vi.fn();
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('window', {});
  vi.stubGlobal('location', { href: 'https://example.com/Karimbolandia/?save=keep#menu', replace });
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => session.get(k) ?? null,
    setItem: (k: string, v: string) => session.set(k, v),
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Verificação antes de abrir', () => {
  it('aguarda a resposta de rede e compara com o build instalado, sem usar cache', async () => {
    let respond!: (r: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { respond = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    let finished = false;
    const pending = checkStartupVersion('./', 'installed').then(v => { finished = true; return v; });
    await Promise.resolve();
    expect(finished).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/^\.\/version\.json\?t=/), expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
    respond(new Response(JSON.stringify({ id: 'installed' })));
    expect(await pending).toEqual({ status: 'current' });
  });

  it('identifica a versão nova antes de liberar a abertura', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'latest' }))));
    expect(await checkStartupVersion('./', 'installed')).toEqual({ status: 'outdated', id: 'latest' });
  });

  it('permite offline sem afirmar que a versão está atualizada', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await checkStartupVersion('./', 'installed')).toEqual({ status: 'unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    () => new Response('{}'),
    () => new Response('{"id":"../../invalid"}'),
    () => new Response('bad json'),
    () => new Response('{}', { status: 503 }),
    () => Promise.reject(new TypeError('network failed')),
  ])('tolera erro de rede ou resposta inválida', async response => {
    vi.stubGlobal('fetch', vi.fn(response));
    expect(await checkStartupVersion('./', 'installed')).toEqual({ status: 'unavailable' });
  });

  it('não deixa a abertura presa se a rede não responder', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, opts: RequestInit) => new Promise((_resolve, reject) => {
      opts.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const pending = checkStartupVersion('./', 'installed');
    await vi.advanceTimersByTimeAsync(6000);
    expect(await pending).toEqual({ status: 'unavailable' });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Atualização preserva progresso e outras aplicações', () => {
  it('limpa somente caches e service worker do jogo e preserva URL e save', async () => {
    const removeCache = vi.fn();
    const own = { scope: 'https://example.com/Karimbolandia/', unregister: vi.fn() };
    const other = { scope: 'https://example.com/other-game/', unregister: vi.fn() };
    vi.stubGlobal('window', { caches: {} });
    vi.stubGlobal('caches', { keys: async () => ['karimbolandia-old', 'other-game-v1'], delete: removeCache });
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: { getRegistrations: async () => [own, other] } });
    const save = { getItem: vi.fn(() => '{"tokens":47}'), clear: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', save);
    await applyUpdate('latest', './');
    expect(removeCache).toHaveBeenCalledExactlyOnceWith('karimbolandia-old');
    expect(own.unregister).toHaveBeenCalledOnce();
    expect(other.unregister).not.toHaveBeenCalled();
    expect(save.clear).not.toHaveBeenCalled();
    expect(save.removeItem).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledExactlyOnceWith('https://example.com/Karimbolandia/?save=keep&v=latest#menu');
    expect(wasUpdateAttempted('latest')).toBe(true);
  });

  it('evita loop mesmo quando o navegador bloqueia sessionStorage', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    await applyUpdate('latest');
    vi.stubGlobal('location', { href: replace.mock.calls[0][0], replace });
    expect(wasUpdateAttempted('latest')).toBe(true);
    expect(wasUpdateAttempted('another')).toBe(false);
  });
});
