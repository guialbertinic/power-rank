import { scoreGame } from '../game/scoring';
import type { Character } from '../game/types';
import { tierClass, tierForPower } from '../ui/tiers';
import Avatar from './Avatar';
import PowerMeter from './PowerMeter';
import RankBadge from './RankBadge';

/** Cor da linha pela quantidade de pares errados envolvendo o personagem (0 = todos certos). */
function hitLevel(pairsWrong: number): number {
  if (pairsWrong === 0) return 0;
  if (pairsWrong <= 2) return 1;
  if (pairsWrong <= 4) return 2;
  if (pairsWrong <= 6) return 3;
  return 4;
}

/** "Seu ranking" ao lado do "Ranking correto" (com a revelação do poder). Usado no solo e na party. */
export default function RankingComparison({ slots }: { slots: Character[] }) {
  const { results, correctOrder } = scoreGame(slots);

  return (
    <div className="result-columns">
      <div className="panel">
        <h3 className="section-title">Seu ranking</h3>
        <ol className="row-list">
          {results.map((r) => (
            <li key={r.position} className={`row row-yours hit-${hitLevel(r.pairsTotal - r.pairsRight)}`}>
              <RankBadge position={r.position} small />
              <Avatar character={r.character} size={32} />
              <span className="row-name">{r.character.name}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel">
        <h3 className="section-title">Ranking correto</h3>
        <ol className="row-list">
          {correctOrder.map((c, i) => (
            <li key={c.id} className="row row-correct">
              <RankBadge position={i + 1} small />
              <Avatar character={c} size={32} />
              <span className="row-name">
                {c.name}
                {c.version && <small>{c.version}</small>}
              </span>
              <PowerMeter power={c.power} delay={i * 90} />
              <span className={`row-power ${tierClass(tierForPower(c.power))}`}>{c.power}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
