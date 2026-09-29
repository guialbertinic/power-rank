/** Placeholder para personagens sem imagem: iniciais sobre um gradiente derivado do id. */
export function fallbackBackground(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
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

export const imageUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
