import { MAX_SCORE, rankTitle, scoreGame, type Range } from '../game/scoring';
import type { Character } from '../game/types';
import Avatar from './Avatar';

const formatRange = ({ min, max }: Range) => (min === max ? `#${min}` : `#${min}–${max}`);

export default function ResultScreen({ slots, onRestart }: { slots: Character[]; onRestart: () => void }) {
  const { total, results, correctOrder } = scoreGame(slots);

  return (
    <section className="result">
      <div className="panel score">
        <p className="score-value">
          {total} <span>/ {MAX_SCORE}</span>
        </p>
        <p className="score-title">{rankTitle(total)}</p>
        <button className="btn-primary" onClick={onRestart} autoFocus>
          Jogar de novo
        </button>
      </div>

      <div className="result-columns">
        <div className="panel">
          <h3>Seu ranking</h3>
          <ol className="result-list">
            {results.map((r) => (
              <li key={r.position} className={`distance-${Math.min(r.distance, 4)}`}>
                <span className="slot-pos">#{r.position}</span>
                <Avatar character={r.character} size={36} />
                <span className="slot-name">{r.character.name}</span>
                <span className="result-correct">
                  {r.distance === 0 ? '✓' : `certo: ${formatRange(r.correct)}`}
                </span>
                <span className="result-points">+{r.points}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel">
          <h3>Ranking correto</h3>
          <ol className="result-list">
            {correctOrder.map((c, i) => (
              <li key={c.id}>
                <span className="slot-pos">#{i + 1}</span>
                <Avatar character={c} size={36} />
                <span className="slot-name">
                  {c.name}
                  {c.version && <small> ({c.version})</small>}
                </span>
                <span className="result-power">{c.power}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
