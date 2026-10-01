import { scoreGame, withRanks } from '../game/scoring';
import type { CharacterInfo } from '../game/types';
import { useI18n } from '../i18n';
import { hitLevel } from '../ui/hits';
import Avatar from './Avatar';
import RankBadge from './RankBadge';

/**
 * "Seu ranking" (ou o de outro jogador, na party: `title`) ao lado do "Ranking correto". Usado no solo e na party.
 * O site não sabe o poder: `ranks` (vindo do servidor no fim da partida) diz quantos são mais fortes que cada um,
 * o que basta para a ordem e as cores de acerto.
 */
export default function RankingComparison({
  slots,
  ranks,
  title,
}: {
  slots: CharacterInfo[];
  ranks: Record<string, number>;
  title?: string;
}) {
  const { t } = useI18n();
  const { results, correctOrder } = scoreGame(withRanks(slots, ranks));

  return (
    <div className="result-columns">
      <div className="panel">
        <h3 className="section-title">{title ?? t('result.yours')}</h3>
        <ol className="row-list">
          {results.map((r) => (
            <li key={r.position} className={`row row-yours hit-${hitLevel(r.distance)}`}>
              <RankBadge position={r.position} small />
              <Avatar character={r.character} size={32} />
              <span className="row-name">{r.character.name}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel">
        <h3 className="section-title">{t('result.correct')}</h3>
        <ol className="row-list">
          {correctOrder.map((c, i) => (
            <li key={c.id} className="row row-correct">
              <RankBadge position={i + 1} small />
              <Avatar character={c} size={32} />
              <span className="row-name">
                {c.name}
                {c.version && <small>{c.version}</small>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
