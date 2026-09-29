// Mosaico das imagens de personagem, para conferir de uma vez se cada imagem é do personagem certo
// e se o recorte ficou bom. Gera e2e/screenshots/contact-sheet.png (abrir/ler só esse arquivo).
//
// Uso: npm run contact-sheet -- goku vegeta sephiroth     (ids)
//      npm run contact-sheet -- --category games
//      npm run contact-sheet -- --series "One Piece"
//      npm run contact-sheet -- --recent 20                 (os últimos N do JSON)
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const characters = JSON.parse(readFileSync(join(root, 'data/characters.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

let list;
if (flag('--category')) list = characters.filter((c) => c.category === flag('--category'));
else if (flag('--series')) list = characters.filter((c) => c.series === flag('--series'));
else if (flag('--recent')) list = characters.slice(-Number(flag('--recent')));
else list = args.map((id) => characters.find((c) => c.id === id)).filter(Boolean);
list = list.filter((c) => c.image);
if (!list.length) {
  console.error('Nenhum personagem com imagem encontrado. Veja o uso no topo do arquivo.');
  process.exit(1);
}

// Mesmo enquadramento do card (3:4, foco no topo): o que o jogador vai ver.
const W = 110;
const H = 166;
const cols = Math.min(11, list.length);
const escape = (s) => s.replace(/[<>&"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const tiles = await Promise.all(
  list.map(async (c, i) => {
    const img = await sharp(join(root, 'public', c.image)).resize(W, H - 20, { fit: 'cover', position: 'top' }).toBuffer();
    const label = Buffer.from(
      `<svg width="${W}" height="20"><rect width="100%" height="100%" fill="#000"/>` +
        `<text x="3" y="14" font-size="11" font-family="Arial" fill="#fff">${escape(c.id)}</text></svg>`,
    );
    const tile = await sharp({ create: { width: W, height: H, channels: 3, background: '#222' } })
      .composite([{ input: img, top: 0, left: 0 }, { input: label, top: H - 20, left: 0 }])
      .png()
      .toBuffer();
    return { input: tile, left: (i % cols) * W, top: Math.floor(i / cols) * H };
  }),
);

const out = join(root, 'e2e/screenshots/contact-sheet.png');
mkdirSync(dirname(out), { recursive: true });
await sharp({ create: { width: cols * W, height: Math.ceil(list.length / cols) * H, channels: 3, background: '#000' } })
  .composite(tiles)
  .png()
  .toFile(out);
console.log(`${list.length} personagens → ${out}`);
