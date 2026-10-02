// Traz para data/characters.json (e public/chars/) o que o admin editou no banco: power, nome, obra, versão, fama,
// ativo e imagem enviada. O `characters:sync` não sobrescreve campos editados pelo admin (`admin_fields`), então o
// JSON fica para trás até rodar este script.
// Uso: npm run characters:pull                       → lê o banco local
//      npm run characters:pull -- --remote            → lê a produção (só o usuário roda)
//      npm run characters:pull -- --remote --unlock   → depois do deploy com as imagens: libera os campos para o
//                                                       sync voltar a valer (apaga as imagens guardadas no banco)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const remote = process.argv.includes('--remote');
const unlock = process.argv.includes('--unlock');
const file = join(root, 'data/characters.json');

function query(sql) {
  const out = execFileSync(
    process.execPath,
    [join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'power-rank', remote ? '--remote' : '--local', '--json', '--command', sql],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out).flatMap((statement) => statement.results ?? []);
}

/** Coluna do banco → campo do JSON (o resto tem o mesmo nome). */
const FIELDS = { name: 'name', series: 'series', version: 'version', tier: 'tier', power: 'power' };

const rows = query(
  'SELECT id, name, series, version, tier, power, active, image_version, admin_fields FROM characters WHERE admin_fields IS NOT NULL',
);
if (!rows.length) {
  console.log('Nenhum personagem editado pelo admin.');
  process.exit(0);
}

const characters = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(characters.map((c) => [c.id, c]));
let removed = 0;
for (const row of rows) {
  const entry = byId.get(row.id);
  if (!entry) {
    console.warn(`⚠ ${row.id}: está no banco mas não no JSON (ignorado)`);
    continue;
  }
  const fields = JSON.parse(row.admin_fields);
  const changes = [];
  for (const field of fields) {
    if (field in FIELDS) {
      const value = row[field] ?? undefined;
      if (entry[FIELDS[field]] !== value) changes.push(`${field}: ${entry[FIELDS[field]]} → ${value}`);
      if (value === undefined) delete entry[FIELDS[field]];
      else entry[FIELDS[field]] = value;
    } else if (field === 'active' && !row.active) {
      // Desativado pelo admin: sai do JSON (o sync deixa inativo quem não está no JSON).
      characters.splice(characters.indexOf(entry), 1);
      removed++;
      changes.push('removido (desativado no admin)');
    } else if (field === 'image') {
      const [image] = query(`SELECT hex(data) AS hex FROM character_images WHERE character_id = '${row.id.replace(/'/g, "''")}'`);
      if (!image) continue;
      writeFileSync(join(root, 'public/chars', `${row.id}.webp`), Buffer.from(image.hex, 'hex'));
      entry.image = `chars/${row.id}.webp`;
      entry.imageVersion = row.image_version;
      changes.push(`imagem → public/chars/${row.id}.webp`);
    }
  }
  if (changes.length) console.log(`✓ ${row.id}: ${changes.join(' · ')}`);
}

characters.sort((a, b) => b.power - a.power);
writeFileSync(file, JSON.stringify(characters, null, 2) + '\n');
console.log(`${rows.length} personagens editados no admin conferidos${removed ? `, ${removed} removidos do JSON` : ''}.`);

if (unlock) {
  query("UPDATE characters SET admin_fields = NULL WHERE admin_fields IS NOT NULL; DELETE FROM character_images;");
  console.log('Campos liberados: o próximo characters:sync volta a valer para esses personagens.');
} else {
  console.log('Confira o diff, rode o validate e publique. Depois do deploy: characters:pull -- --remote --unlock.');
}
