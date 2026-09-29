import type { Character } from '../game/types';
import { characterImageUrl, fallbackBackground, initials } from '../ui/fallback';

/** Miniatura chanfrada do personagem (ou iniciais, se não houver imagem). */
export default function Avatar({ character, size }: { character: Character; size: number }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  const src = characterImageUrl(character);
  if (src) {
    return <img className="avatar" style={style} src={src} alt="" loading="lazy" />;
  }
  return (
    <span className="avatar avatar-fallback" style={{ ...style, background: fallbackBackground(character.id) }}>
      {initials(character.name)}
    </span>
  );
}
