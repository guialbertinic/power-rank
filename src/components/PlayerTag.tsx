import type { Look } from '../game/cosmetics';
import { POOL_BY_ID } from '../data';
import { fallbackBackground, initials } from '../ui/fallback';
import Avatar from './Avatar';

interface Props {
  name: string;
  look: Look;
  /** Tamanho do avatar em px. */
  size?: number;
  /** Só o avatar (sem o nick), ex: prévia na loja. */
  avatarOnly?: boolean;
}

/**
 * Jogador com o visual equipado: avatar (personagem escolhido) com moldura e nick com cor.
 * Cada cosmético é uma classe `cosmetic-<id>` definida em styles.css.
 */
export default function PlayerTag({ name, look, size = 28, avatarOnly }: Props) {
  const character = look.avatar ? POOL_BY_ID.get(look.avatar) : undefined;

  const avatar = (
    <span className={`player-frame${look.frame ? ` cosmetic-${look.frame}` : ''}`}>
      <span className="player-frame-border">
        {character ? (
          <Avatar character={character} size={size} />
        ) : (
          <span
            className="avatar avatar-fallback"
            style={{ width: size, height: size, fontSize: size * 0.4, background: fallbackBackground(name) }}
          >
            {initials(name)}
          </span>
        )}
      </span>
    </span>
  );

  if (avatarOnly) return avatar;
  return (
    <span className="player-tag">
      {avatar}
      <span className={`player-name${look.nameColor ? ` cosmetic-${look.nameColor}` : ''}`}>{name}</span>
    </span>
  );
}
