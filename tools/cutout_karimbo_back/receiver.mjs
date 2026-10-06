/**
 * Receptor local da ferramenta de recorte: `node tools/cutout_karimbo_back/receiver.mjs [porta]`.
 * Grava cada POST /save?name=<arquivo> em public/assets/img (só nomes karimbo_back_*; nada fora da pasta).
 */
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets', 'img');
const port = Number(process.argv[2] ?? 5599);

createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors).end(); return; }
  const u = new URL(req.url, 'http://x');
  const name = u.searchParams.get('name') ?? '';
  if (req.method !== 'POST' || u.pathname !== '/save' || !/^karimbo_back_[a-z_]+\.(webp|json)$/.test(name)) { res.writeHead(400, cors).end('nome inválido'); return; }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    writeFileSync(join(OUT, name), buf);
    console.log('gravado', name, buf.length, 'bytes');
    res.writeHead(200, cors).end('ok');
  });
}).listen(port, () => console.log(`receptor em http://localhost:${port} → ${OUT}`));
