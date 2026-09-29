import type { Character } from '../game/types';

function hueFor(id: string): number {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 360;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** Mostra a imagem do personagem ou, se não houver, as iniciais sobre uma cor derivada do id. */
export default function Avatar({ character, size }: { character: Character; size: number }) {
  const style = { width: size, height: size, fontSize: size * 0.36 };
  if (character.image) {
    return (
      <img
        className="avatar"
        style={style}
        src={`${import.meta.env.BASE_URL}${character.image}`}
        alt={character.name}
      />
    );
  }
  const hue = hueFor(character.id);
  return (
    <div
      className="avatar avatar-fallback"
      style={{ ...style, background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 70% 30%))` }}
      aria-label={character.name}
    >
      {initials(character.name)}
    </div>
  );
}
