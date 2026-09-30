// SQL no D1 local com saída compacta (só as linhas, em tabela), sem o banner e o JSON do Wrangler.
// Uso: npm run db -- "SELECT id, name, coins FROM players"
// Só banco local: produção é do usuário (ele roda o wrangler com --remote).
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--remote')) {
  console.error('db.mjs só roda no banco local.');
  process.exit(1);
}
const sql = args.join(' ').trim();
if (!sql) {
  console.error('Uso: npm run db -- "<SQL>"');
  process.exit(1);
}

let output;
try {
  output = execFileSync(
    process.execPath,
    [join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'power-rank', '--local', '--json', '--command', sql],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
} catch (error) {
  // O Wrangler manda o erro de SQL no stdout (JSON) ou no stderr: mostra só a mensagem
  let message;
  try {
    const { error: body } = JSON.parse(error.stdout);
    message = [body.text, ...(body.notes ?? []).map((note) => note.text)].join('\n');
  } catch {
    message = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().split('\n').slice(-3).join('\n');
  }
  console.error(message);
  process.exit(1);
}

for (const statement of JSON.parse(output)) {
  const rows = statement.results ?? [];
  if (rows.length === 0) {
    console.log(`(0 linhas; alteradas: ${statement.meta?.changes ?? 0})`);
    continue;
  }
  const columns = Object.keys(rows[0]);
  console.log(columns.join(' | '));
  for (const row of rows) console.log(columns.map((column) => String(row[column] ?? 'NULL')).join(' | '));
  console.log(`(${rows.length} linha${rows.length === 1 ? '' : 's'})`);
}
