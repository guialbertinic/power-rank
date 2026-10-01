// Conversão das imagens de personagem, usada por fetch-images e import-image.
import { readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const charsDir = join(dirname(fileURLToPath(import.meta.url)), '../../public/chars');

/**
 * Salva em public/chars/<id>.webp (240px de largura) e apaga versões antigas (jpg/png).
 * Imagens largas demais para o card (prints, artes horizontais) são recortadas em 3:4 na região de interesse.
 * `contain` (artes com fundo transparente, ex: Pokémon): tira a margem transparente e encaixa a arte inteira em
 * 3:4, sem cortar caudas e asas.
 * Devolve o caminho relativo a /public, para o campo `image`.
 */
export async function saveImage(id, input, { contain = false } = {}) {
  for (const f of readdirSync(charsDir)) {
    if (f.startsWith(`${id}.`) && !f.endsWith('.webp')) unlinkSync(join(charsDir, f));
  }
  const { width = 1, height = 1 } = await sharp(input).metadata();
  const image = contain
    ? sharp(await sharp(input).trim().toBuffer()).resize(216, 288, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({ top: 16, bottom: 16, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    : width / height > 0.8
      ? sharp(input).resize(240, 320, { fit: 'cover', position: sharp.strategy.attention })
      : sharp(input).resize({ width: 240, withoutEnlargement: true });
  await image.webp({ quality: 80 }).toFile(join(charsDir, `${id}.webp`));
  return `chars/${id}.webp`;
}
