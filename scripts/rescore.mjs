// Recalcula a pontuação de todas as partidas gravadas a partir das posições salvas, usando a regra
// e os valores de poder atuais. Rode depois de mudar a pontuação ou o `power` dos personagens.
//
// Uso: npm run rescore -- --local
//      npm run rescore -- --remote   (banco de produção)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreGame } from '../src/game/scoring.ts';

const target = process.argv[2];
if (target !== '--local' && target !== '--remote') {
  console.error('Uso: npm run rescore -- --local | --remote');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const byId = new Map(JSON.parse(readFileSync(join(root, 'data/characters.json'), 'utf8')).map((c) => [c.id, c]));

const wranglerBin = join(root, 'node_modules/wrangler/bin/wrangler.js');
const wrangler = (...args) =>
  execFileSync(process.execPath, [wranglerBin, 'd1', 'execute', 'power-rank', target, ...args], {
    cwd: root,
    encoding: 'utf8',
  });

const [{ results: rows }] = JSON.parse(wrangler('--json', '--command', 'SELECT id, score, placements FROM scores'));

const updates = [];
let skipped = 0;
for (const row of rows) {
  const slots = JSON.parse(row.placements).map((id) => byId.get(id));
  if (slots.some((c) => !c)) {
    skipped++; // personagem removido da base: mantém a pontuação antiga
    continue;
  }
  const { total } = scoreGame(slots);
  if (total !== row.score) updates.push(`UPDATE scores SET score = ${total} WHERE id = ${row.id};`);
}

console.log(`${rows.length} partidas, ${updates.length} com pontuação alterada, ${skipped} ignoradas.`);
if (updates.length) {
  const file = join(mkdtempSync(join(tmpdir(), 'rescore-')), 'rescore.sql');
  writeFileSync(file, updates.join('\n'));
  wrangler('--file', file);
  console.log('Pontuações atualizadas.');
}
