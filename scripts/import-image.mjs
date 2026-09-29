// Importa uma imagem baixada manualmente (para personagens sem fonte automática).
// Converte para WebP no formato do jogo e grava o caminho no data/characters.json.
//
// Uso: npm run import:image -- <id> <arquivo>
//      npm run import:image -- leon ~/Downloads/leon.png
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveImage } from './lib/images.mjs';

const [id, file] = process.argv.slice(2);
if (!id || !file) {
  console.error('Uso: npm run import:image -- <id> <arquivo>');
  process.exit(1);
}

const dataPath = join(dirname(fileURLToPath(import.meta.url)), '../data/characters.json');
const characters = JSON.parse(readFileSync(dataPath, 'utf8'));
const character = characters.find((c) => c.id === id);
if (!character) {
  console.error(`Personagem "${id}" não existe em data/characters.json`);
  process.exit(1);
}

character.image = await saveImage(id, readFileSync(resolve(file)));
// Entra na URL da imagem: reimportar invalida o cache dos navegadores.
character.imageVersion = Date.now().toString(36);
writeFileSync(dataPath, JSON.stringify(characters, null, 2) + '\n');
console.log(`✓ ${id} → ${character.image}`);
