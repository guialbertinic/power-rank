import type { CharacterInfo } from '../game/types';

/** Hash curto e estável de uma string (base 36). */
function hashString(value: string): string {
  let hash = 0;
  for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

/** Matiz do placeholder de um personagem (também usado na imagem de compartilhar). */
export function fallbackHue(id: string): number {
  return parseInt(hashString(id), 36) % 360;
}

/** Placeholder para personagens sem imagem: iniciais sobre um gradiente derivado do id. */
export function fallbackBackground(id: string): string {
  const hue = fallbackHue(id);
  return `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 70% 25%))`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/**
 * URL da imagem do personagem. As imagens ficam em cache por dias (public/_headers), então a versão da imagem
 * entra na URL: se a imagem for trocada, a URL muda e o cache é ignorado. A versão vem pronta do catálogo
 * (`imageVersion`, calculada no `characters:sync` a partir da fonte: import manual, AniList, IGDB ou Wikipédia).
 */
export function characterImageUrl(character: CharacterInfo): string | null {
  if (!character.image) return null;
  const sourceId = character.imageVersion ?? character.anilistId;
  const version = sourceId ? `?v=${sourceId}` : '';
  return `${import.meta.env.BASE_URL}${character.image}${version}`;
}

/**
 * Baixa as imagens da partida antes de ela começar. Espera só a primeira (até `timeoutMs`),
 * o resto continua em segundo plano enquanto o jogador posiciona.
 */
export async function preloadImages(characters: CharacterInfo[], timeoutMs = 1500): Promise<void> {
  const loads = characters.map((c) => {
    const url = characterImageUrl(c);
    if (!url) return Promise.resolve();
    const img = new Image();
    img.src = url;
    return img.decode().catch(() => undefined);
  });
  await Promise.race([loads[0] ?? Promise.resolve(), new Promise((r) => setTimeout(r, timeoutMs))]);
}
