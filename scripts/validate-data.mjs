// Valida data/characters.json: campos obrigatórios, ids únicos, power no intervalo e imagens existentes.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const characters = JSON.parse(readFileSync(join(root, 'data/characters.json'), 'utf8'));

const errors = [];
const seen = new Set();

for (const [i, c] of characters.entries()) {
  const where = `#${i} (${c.id ?? '?'})`;
  if (!/^[a-z0-9-]+$/.test(c.id ?? '')) errors.push(`${where}: id deve ser minúsculo, só letras/números/hífen`);
  if (seen.has(c.id)) errors.push(`${where}: id duplicado`);
  seen.add(c.id);
  if (!c.name) errors.push(`${where}: falta name`);
  if (!c.series) errors.push(`${where}: falta series`);
  if (!['anime', 'games', 'pokemon'].includes(c.category)) errors.push(`${where}: category deve ser anime, games ou pokemon`);
  if (c.category === 'pokemon' && !(Number.isInteger(c.generation) && c.generation >= 1 && c.generation <= 9)) {
    errors.push(`${where}: Pokémon precisa de generation 1-9`);
  }
  if (typeof c.power !== 'number' || c.power < 0 || c.power > 100) errors.push(`${where}: power deve ser 0-100`);
  if (c.image && !existsSync(join(root, 'public', c.image))) errors.push(`${where}: imagem não encontrada: ${c.image}`);
}

const withoutImage = characters.filter((c) => !c.image).length;

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK: ${characters.length} personagens, ${withoutImage} sem imagem.`);
