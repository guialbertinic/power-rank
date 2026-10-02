import { useMemo, useState, type ReactNode } from 'react';
import { avatarItemId } from '../game/cosmetics';
import { MODES } from '../game/modes';
import type { CharacterInfo } from '../game/types';
import { POOL } from '../data';
import { useI18n } from '../i18n';

interface Props {
  owned: Set<string>;
  /** Filtro "Todos / Obtidos / Não obtidos" da loja. */
  visible: (itemId: string) => boolean;
  /** Avatar equipado (id do personagem): o grupo dele já começa aberto. */
  equipped: string | null;
  renderItem: (c: CharacterInfo) => ReactNode;
}

interface Group {
  key: string;
  label: string;
  items: CharacterInfo[];
}

/** Obras com menos personagens que isso vão para "Outros" da categoria. */
const MIN_GROUP = 2;
const OTHERS = '~others';

/** Franquia de um jogo: sem subtítulo nem número ("Final Fantasy VII", "Resident Evil 3" → a série). */
const franchise = (series: string) =>
  series
    .split(': ')[0]
    .replace(/\s+(\d+|[IVX]+)$/, '')
    .trim();

/** Já tem primeiro, depois em ordem alfabética (nunca por poder). */
const byOwnedThenName = (owned: Set<string>) => (a: CharacterInfo, b: CharacterInfo) =>
  Number(owned.has(avatarItemId(b.id))) - Number(owned.has(avatarItemId(a.id))) || a.name.localeCompare(b.name);

/**
 * Avatares da loja: sem busca, por categoria (Animes / Games / Pokémon) e, dentro dela, por obra (Pokémon por
 * geração), tudo recolhido; só os grupos abertos renderizam as imagens. Com busca, a lista plana de quem bate.
 */
export default function ShopAvatars({ owned, visible, equipped, renderItem }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => {
    const c = equipped ? POOL.find((p) => p.id === equipped) : undefined;
    return new Set(c ? [c.category, `${c.category}/${groupKey(c, POOL)}`] : []);
  });
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const available = useMemo(() => POOL.filter((c) => c.image && visible(avatarItemId(c.id))), [visible]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return available.filter((c) => `${c.name} ${c.series}`.toLowerCase().includes(q)).sort(byOwnedThenName(owned));
  }, [query, available, owned]);

  const categories = useMemo(
    () =>
      MODES.filter((m) => m.id !== 'all')
        .map((m) => {
          const list = available.filter((c) => c.category === m.id);
          const byKey = new Map<string, CharacterInfo[]>();
          for (const c of list) {
            const key = groupKey(c, POOL);
            byKey.set(key, [...(byKey.get(key) ?? []), c]);
          }
          const groups: Group[] = [...byKey]
            .map(([key, items]) => ({
              key,
              label:
                key === OTHERS
                  ? t('shop.avatars.others')
                  : m.id === 'pokemon'
                    ? t('gen.aria', { n: key })
                    : key,
              items: items.sort(byOwnedThenName(owned)),
            }))
            // Pokémon na ordem das gerações; obras em ordem alfabética; "Outros" no fim.
            .sort((a, b) =>
              a.key === OTHERS
                ? 1
                : b.key === OTHERS
                  ? -1
                  : m.id === 'pokemon'
                    ? Number(a.key) - Number(b.key)
                    : a.label.localeCompare(b.label),
            );
          return { id: m.id, label: m.label, count: list.length, groups };
        })
        .filter((c) => c.count > 0),
    [available, owned, t],
  );

  const ownedIn = (items: CharacterInfo[]) => items.filter((c) => owned.has(avatarItemId(c.id))).length;

  /** Cabeçalho que abre/fecha um grupo, com "obtidos/total". */
  const header = (key: string, label: string, items: CharacterInfo[], className: string) => (
    <button
      type="button"
      className={className}
      aria-expanded={open.has(key)}
      onClick={() => toggle(key)}
      data-group={label}
    >
      <span className="shop-cat-label">{label}</span>
      <span className="shop-cat-count">
        {ownedIn(items)}/{items.length}
      </span>
    </button>
  );

  return (
    <>
      <input
        className="shop-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('shop.search', { n: POOL.length })}
        aria-label={t('shop.searchAria')}
      />
      {results ? (
        results.length ? (
          <ol className="shop-avatars">{results.map(renderItem)}</ol>
        ) : (
          <p className="muted shop-empty">{t('shop.emptyAvatars')}</p>
        )
      ) : categories.length ? (
        <div className="shop-cats">
          {categories.map((cat) => (
            <section key={cat.id} className="shop-cat">
              {header(
                cat.id,
                cat.label,
                cat.groups.flatMap((g) => g.items),
                'shop-cat-header',
              )}
              {open.has(cat.id) && (
                <div className="shop-subcats">
                  {cat.groups.map((g) => {
                    const key = `${cat.id}/${g.key}`;
                    return (
                      <section key={key} className="shop-subcat">
                        {header(key, g.label, g.items, 'shop-subcat-header')}
                        {open.has(key) && <ol className="shop-avatars">{g.items.map(renderItem)}</ol>}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p className="muted shop-empty">{t('shop.emptyAvatars')}</p>
      )}
    </>
  );
}

/** Contagem de personagens por obra (na base toda, para o grupo não mudar com o filtro). */
const seriesSizeCache = new WeakMap<CharacterInfo[], Map<string, number>>();

function groupKey(c: CharacterInfo, pool: CharacterInfo[]): string {
  if (c.category === 'pokemon') return String(c.generation ?? 0);
  let sizes = seriesSizeCache.get(pool);
  if (!sizes) {
    sizes = new Map();
    for (const p of pool) {
      if (p.category === 'pokemon' || !p.image) continue;
      const k = `${p.category}/${seriesOf(p)}`;
      sizes.set(k, (sizes.get(k) ?? 0) + 1);
    }
    seriesSizeCache.set(pool, sizes);
  }
  const series = seriesOf(c);
  return (sizes.get(`${c.category}/${series}`) ?? 0) >= MIN_GROUP ? series : OTHERS;
}

const seriesOf = (c: CharacterInfo) => (c.category === 'games' ? franchise(c.series) : c.series);
