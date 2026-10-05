import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', 'src');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** `import x from '...'` e `export ... from '...'` que NÃO são só de tipo. */
function valueImports(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/^\s*(import|export)\s+(?!type\b)([^;]*?)\s+from\s+['"]([^'"]+)['"]/gms)) out.push(m[3]);
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) out.push(m[1]);
  return out;
}

describe('minijogos carregam só sob demanda (D09)', () => {
  const MINI = /(^|\/)minigames(\/|$)/;

  it('game.ts e minigameFlow.ts não importam minijogos de forma estática', () => {
    for (const f of ['game/game.ts', 'game/minigameFlow.ts']) {
      expect(valueImports(read(f)).filter((s) => MINI.test(s)), f).toEqual([]);
    }
  });

  it('nada fora de game/minigames/** e art/minigames/** importa dali por valor', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const rel = join(dir, name).replace(/\\/g, '/');
        if (statSync(join(root, rel)).isDirectory()) { if (!/^(game|art)\/minigames$/.test(rel)) walk(rel); continue; }
        if (!rel.endsWith('.ts')) continue;
        for (const s of valueImports(read(rel))) if (MINI.test(s)) offenders.push(`${rel} → ${s}`);
      }
    };
    for (const d of ['game', 'core', 'ui', 'art', 'debug']) walk(d);
    expect(offenders).toEqual([]);
  });

  it('o fluxo carrega boxe e perseguição só por import() dinâmico', () => {
    const flow = read('game/minigameFlow.ts');
    expect(flow).toMatch(/import\('\.\/minigames\/boxing'\)/);
    expect(flow).toMatch(/import\('\.\/minigames\/chase'\)/);
  });

  it('types.ts é só tipos (nada a executar)', () => {
    const src = read('game/minigames/types.ts');
    expect(valueImports(src)).toEqual([]);
    expect(src).not.toMatch(/^\s*(export\s+)?(const|let|var|function|class)\b/m);
  });

  it('a simulação dos minijogos não usa arte nem DOM (roda em Node)', () => {
    for (const id of ['boxing', 'chase']) {
      const dir = join(root, 'game', 'minigames', id, 'sim');
      let files: string[] = [];
      try { files = readdirSync(dir).filter((n) => n.endsWith('.ts')); } catch { continue; } // a pasta nasce nas T8/T10
      for (const n of files) {
        const src = readFileSync(join(dir, n), 'utf8');
        expect(src, `${id}/${n}`).not.toMatch(/getArt\(|document\.|window\.|HTMLCanvasElement|CanvasRenderingContext2D/);
        expect(valueImports(src).filter((s) => /art\//.test(s)), `${id}/${n}`).toEqual([]);
      }
    }
  });
});
