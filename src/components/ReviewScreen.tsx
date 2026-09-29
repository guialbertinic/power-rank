import { useMemo, useState } from 'react';
import type { Character } from '../game/types';
import { tierClass, tierForPower, type Tier } from '../ui/tiers';
import Avatar from './Avatar';
import PowerMeter from './PowerMeter';

const TIER_LABEL: Record<Tier, string> = { ss: 'SS · 95+', s: 'S · 85+', a: 'A · 75+', b: 'B · 60+', c: 'C · 45+', d: 'D · <45' };

/**
 * Só em desenvolvimento (http://localhost:5173/?review): todos os personagens ordenados por poder,
 * agrupados por tier, com filtro por obra e busca. Serve para revisar a escala de `power`.
 */
export default function ReviewScreen({ characters }: { characters: Character[] }) {
  const [category, setCategory] = useState('');
  const [series, setSeries] = useState('');
  const [query, setQuery] = useState('');

  const seriesList = useMemo(
    () => [...new Set(characters.filter((c) => !category || c.category === category).map((c) => c.series))].sort(),
    [characters, category],
  );
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = characters
      .filter((c) => !category || c.category === category)
      .filter((c) => !series || c.series === series)
      .filter((c) => !q || `${c.name} ${c.version ?? ''} ${c.id}`.toLowerCase().includes(q))
      .sort((a, b) => b.power - a.power || a.name.localeCompare(b.name));
    const byTier = new Map<Tier, Character[]>();
    for (const c of filtered) {
      const tier = tierForPower(c.power);
      byTier.set(tier, [...(byTier.get(tier) ?? []), c]);
    }
    return [...byTier];
  }, [characters, category, series, query]);

  const missingImages = characters.filter((c) => !c.image).length;

  return (
    <section className="review">
      <div className="panel review-toolbar">
        <h3 className="section-title">
          Revisão · {characters.length} personagens · {seriesList.length} obras
          {missingImages > 0 && ` · ${missingImages} sem imagem`}
        </h3>
        <div className="review-filters">
          <select value={category} onChange={(e) => {
              setCategory(e.target.value);
              setSeries('');
            }}>
            <option value="">Todas as categorias</option>
            <option value="anime">Animes</option>
            <option value="games">Games</option>
          </select>
          <select value={series} onChange={(e) => setSeries(e.target.value)}>
            <option value="">Todas as obras</option>
            {seriesList.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nome ou id" />
        </div>
      </div>

      {groups.map(([tier, list]) => (
        <div key={tier} className="panel review-group">
          <h3 className={`section-title review-tier ${tierClass(tier)}`}>
            Tier {TIER_LABEL[tier]} <span>({list.length})</span>
          </h3>
          <ol className="row-list">
            {list.map((c) => (
              <li key={c.id} className="row review-row">
                <Avatar character={c} size={40} />
                <span className="row-name">
                  {c.name}
                  <small>
                    {c.series}
                    {c.version && ` · ${c.version}`} · <code>{c.id}</code>
                  </small>
                </span>
                <PowerMeter power={c.power} />
                <span className={`row-power ${tierClass(tier)}`}>{c.power}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
