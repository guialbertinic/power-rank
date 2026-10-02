// Copia data/characters.json para a tabela `characters` do D1 (a fonte de edição continua sendo o JSON).
// Uso: npm run characters:sync            → banco local (dev)
//      npm run characters:sync -- --remote → produção (só o usuário roda)
// Personagem que saiu do JSON fica com active = 0 (continua valendo em partidas e avatares antigos).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const remote = process.argv.includes('--remote');
const characters = JSON.parse(readFileSync(join(root, 'data/characters.json'), 'utf8'));

/** Mesmo hash de src/ui/fallback.ts: mantém as URLs das imagens (?v=) iguais às de antes da migração. */
function hashString(value) {
  let hash = 0;
  for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/** Versão da imagem para o ?v= da URL (troca de imagem = URL nova = cache ignorado). */
const imageVersion = (c) =>
  c.imageVersion ?? (c.anilistId ? undefined : (c.igdbId ?? (c.wikipedia ? hashString(c.wikipedia) : undefined)));

const sql = (v) => (v === undefined || v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const now = Date.now();

const statements = characters.map(
  (c) =>
    `INSERT INTO characters (id, name, category, series, tier, generation, version, power, image, anilist_id, image_version, active, updated_at) ` +
    `VALUES (${[c.id, c.name, c.category, c.series, c.tier, c.generation, c.version, c.power, c.image, c.anilistId, imageVersion(c)].map(sql).join(', ')}, 1, ${now}) ` +
    `ON CONFLICT (id) DO UPDATE SET name = excluded.name, category = excluded.category, series = excluded.series, ` +
    `tier = excluded.tier, generation = excluded.generation, version = excluded.version, power = excluded.power, image = excluded.image, anilist_id = excluded.anilist_id, ` +
    `image_version = excluded.image_version, active = 1, updated_at = excluded.updated_at;`,
);
statements.push(`UPDATE characters SET active = 0, updated_at = ${now} WHERE id NOT IN (${characters.map((c) => sql(c.id)).join(', ')});`);

const dir = mkdtempSync(join(tmpdir(), 'characters-'));
const file = join(dir, 'sync.sql');
writeFileSync(file, statements.join('\n'));
try {
  const out = execFileSync(
    process.execPath,
    [join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'power-rank', remote ? '--remote' : '--local', '--file', file],
    { cwd: root, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] },
  );
  if (/error/i.test(out) && !/success/i.test(out)) throw new Error(out);
  console.log(`${characters.length} personagens sincronizados (${remote ? 'produção' : 'local'}).`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
