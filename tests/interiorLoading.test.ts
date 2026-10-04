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

describe('interiores carregam só sob demanda', () => {
  const INTERIOR = /(^|\/)interior(\/|$)/;

  it('game.ts e interiorFlow.ts não importam o módulo do interior de forma estática', () => {
    for (const f of ['game/game.ts', 'game/interiorFlow.ts']) {
      const bad = valueImports(read(f)).filter((s) => INTERIOR.test(s));
      expect(bad, f).toEqual([]);
    }
  });

  it('o pacote principal (tudo fora de interior/) só importa dele por import() ou como tipo', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const rel = join(dir, name).replace(/\\/g, '/');
        if (statSync(join(root, rel)).isDirectory()) { if (!/(^|\/)interior$/.test(rel)) walk(rel); continue; }
        if (!rel.endsWith('.ts')) continue;
        for (const s of valueImports(read(rel))) if (INTERIOR.test(s)) offenders.push(`${rel} → ${s}`);
      }
    };
    walk('game'); walk('core'); walk('ui'); walk('art');
    expect(offenders).toEqual([]);
  });

  it('o fluxo carrega o módulo e os cômodos por import() dinâmico', () => {
    const flow = read('game/interiorFlow.ts');
    expect(flow).toMatch(/import\('\.\/interior'\)/);
    const idx = read('game/interior/index.ts');
    expect(idx).toMatch(/import\('\.\/rooms\/palafitaVigia'\)/);
    expect(idx).toMatch(/import\('\.\/rooms\/casaBenedita'\)/);
  });

  it('o save, o mundo e a validação só dependem do store minúsculo (fora de interior/)', () => {
    for (const f of ['game/world.ts', 'game/save.ts', 'core/saveValidation.ts', 'game/exploration.ts']) {
      const imports = valueImports(read(f));
      expect(imports.filter((s) => INTERIOR.test(s)), f).toEqual([]);
    }
    const store = read('game/interiorStore.ts');
    expect(valueImports(store)).toEqual([]);
  });

  it('o simulador do interior não usa arte nem DOM (roda em Node)', () => {
    const dir = join(root, 'game', 'interior');
    const files: string[] = [];
    const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } };
    walk(dir);
    const sessionLike = new Set(['session.ts', 'index.ts']);
    for (const f of files) {
      const name = f.split(/[\\/]/).pop()!;
      if (sessionLike.has(name)) continue; // a sessão é a cola com o desenho
      const src = readFileSync(f, 'utf8');
      expect(src, name).not.toMatch(/getArt\(|document\.|window\.|HTMLCanvasElement|CanvasRenderingContext2D/);
      expect(valueImports(src).filter((s) => /art\//.test(s)), name).toEqual([]);
    }
  });
});
