import type { CharacterInfo } from '../game/types';
import { characterImageUrl, fallbackBackground, initials } from '../ui/fallback';

/** Miniatura chanfrada do personagem (ou iniciais, se não houver imagem). Sem `size`, o tamanho vem do CSS. */
export default function Avatar({ character, size }: { character: CharacterInfo; size?: number }) {
  const style = size ? { width: size, height: size, fontSize: size * 0.38 } : undefined;
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
