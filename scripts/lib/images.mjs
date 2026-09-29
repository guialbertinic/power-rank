// Conversão das imagens de personagem, usada por fetch-images e import-image.
import { readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const charsDir = join(dirname(fileURLToPath(import.meta.url)), '../../public/chars');

/**
 * Salva em public/chars/<id>.webp (240px de largura) e apaga versões antigas (jpg/png).
 * Imagens largas demais para o card (prints, artes horizontais) são recortadas em 3:4 na região de interesse.
 * Devolve o caminho relativo a /public, para o campo `image`.
 */
export async function saveImage(id, input) {
  for (const f of readdirSync(charsDir)) {
    if (f.startsWith(`${id}.`) && !f.endsWith('.webp')) unlinkSync(join(charsDir, f));
  }
  const { width = 1, height = 1 } = await sharp(input).metadata();
  const image =
    width / height > 0.8
      ? sharp(input).resize(240, 320, { fit: 'cover', position: sharp.strategy.attention })
      : sharp(input).resize({ width: 240, withoutEnlargement: true });
  await image.webp({ quality: 80 }).toFile(join(charsDir, `${id}.webp`));
  return `chars/${id}.webp`;
}
