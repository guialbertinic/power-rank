import { cosmeticById, type Look } from '../game/cosmetics';
import { cosmeticLabel, useI18n } from '../i18n';
import { POOL_BY_ID } from '../data';
import { fallbackBackground, initials } from '../ui/fallback';
import Avatar from './Avatar';
import BadgeIcon from './BadgeIcon';

interface Props {
  name: string;
  look: Look;
  /** Tamanho do avatar em px. */
  size?: number;
  /** Só o avatar (sem o nick), ex: prévia na loja. */
  avatarOnly?: boolean;
}

/**
 * Jogador com o visual equipado: avatar (personagem escolhido) com moldura, nick com cor e emblema, e o título embaixo.
 * Cada cosmético é uma classe `cosmetic-<id>` definida em styles.css.
 */
export default function PlayerTag({ name, look, size = 28, avatarOnly }: Props) {
  const character = look.avatar ? POOL_BY_ID.get(look.avatar) : undefined;
  const { lang } = useI18n();
  const titleItem = look.title ? cosmeticById(look.title) : undefined;
  const title = titleItem ? cosmeticLabel(titleItem, lang) : undefined;
  const badgeItem = look.badge ? cosmeticById(look.badge) : undefined;

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
      <span className="player-text">
        <span className="player-name-line">
          <span className={`player-name${look.nameColor ? ` cosmetic-${look.nameColor}` : ''}`}>{name}</span>
          {badgeItem && <BadgeIcon id={badgeItem.id} label={cosmeticLabel(badgeItem, lang)} />}
        </span>
        {title && <span className="player-title">{title}</span>}
      </span>
    </span>
  );
}
