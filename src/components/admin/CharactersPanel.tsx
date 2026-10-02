import { useEffect, useState } from 'react';
import type { AdminCharacter } from '../../game/admin';
import type { Category } from '../../game/types';
import { modeLabel, useI18n } from '../../i18n';
import { characterImageUrl } from '../../ui/fallback';
import { searchCharacters } from './api';
import CharacterDetail from './CharacterDetail';
import { errorText } from './format';

/** Filtro de categoria (null = todas); os nomes são os das categorias do jogo. */
const CATEGORIES: (Category | null)[] = [null, 'anime', 'games', 'movies', 'pokemon'];

/** Imagem do personagem como o jogo mostra (mesma URL, com a versão). */
export function CharacterThumb({ character, size = 48 }: { character: AdminCharacter; size?: number }) {
  const url = characterImageUrl({
    ...character,
    version: character.version ?? undefined,
    tier: character.tier ?? undefined,
    image: character.image ?? undefined,
    imageVersion: character.imageVersion ?? undefined,
    anilistId: character.anilistId ?? undefined,
  });
  return url ? (
    <img className="admin-thumb" src={url} alt="" width={size} height={Math.round((size * 4) / 3)} loading="lazy" />
  ) : (
    <span className="admin-thumb" style={{ width: size, height: Math.round((size * 4) / 3) }} />
  );
}

/**
 * Personagens: busca por nome, obra ou id (com filtro de categoria) e, ao escolher um, a edição (poder, nome, obra,
 * fama, ativo e imagem). `initialId`: abre direto um personagem (vindo da fila de moderação).
 */
export default function CharactersPanel({ initialId = null }: { initialId?: string | null }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [characters, setCharacters] = useState<AdminCharacter[] | null>(null);
  const [selected, setSelected] = useState<string | null>(initialId);
  const [error, setError] = useState<string | null>(null);

  // Busca enquanto digita; volta a buscar ao sair da edição (o personagem pode ter mudado).
  useEffect(() => {
    if (selected !== null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchCharacters(query.trim(), category)
        .then((rows) => {
          if (!cancelled) {
            setCharacters(rows);
            setError(null);
          }
        })
        .catch((err) => !cancelled && setError(errorText(err, lang)));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, category, selected]);

  if (selected !== null) return <CharacterDetail id={selected} onBack={() => setSelected(null)} />;

  return (
    <section className="panel admin-section">
      <h2 className="section-title">{t('admin.tab.characters')}</h2>
      <div className="admin-toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('admin.characters.search')}
          aria-label={t('admin.characters.search')}
        />
        <div className="shop-filter" role="radiogroup" aria-label={t('admin.characters.category')}>
          {CATEGORIES.map((c) => (
            <button
              key={c ?? 'all'}
              role="radio"
              aria-checked={category === c}
              className={`shop-filter-option${category === c ? ' selected' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c ? modeLabel(t, c) : t('admin.characters.all')}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {characters && !characters.length && <p className="muted">{t('admin.characters.none')}</p>}
      <ul className="admin-list">
        {characters?.map((c) => (
          <li key={c.id}>
            <button className="admin-player-row admin-character-row" onClick={() => setSelected(c.id)}>
              <CharacterThumb character={c} size={36} />
              <span className="admin-character-name">
                <strong className="admin-player-name">{c.name}</strong>
                <span className="admin-small muted">{c.series}</span>
              </span>
              <span className="admin-small">{t('admin.characters.power', { n: c.power })}</span>
              <CharacterBadges character={c} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CharacterBadges({ character }: { character: AdminCharacter }) {
  const { t } = useI18n();
  return (
    <span className="admin-badges">
      {character.tier !== null && <span className="admin-badge">{t('admin.characters.tierBadge', { n: character.tier })}</span>}
      {!character.active && <span className="admin-badge warn">{t('admin.characters.inactive')}</span>}
      {character.adminFields.length > 0 && <span className="admin-badge">{t('admin.characters.edited')}</span>}
    </span>
  );
}
