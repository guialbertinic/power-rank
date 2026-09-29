import { useState } from 'react';
import { MAX_SCORE, rankTitle, scoreGame, type Range } from '../game/scoring';
import type { Character } from '../game/types';
import { tierClass, tierForPower } from '../ui/tiers';
import Avatar from './Avatar';
import Leaderboard from './Leaderboard';
import PowerMeter from './PowerMeter';
import RankBadge from './RankBadge';
import RankingStatus from './RankingStatus';

const formatRange = ({ min, max }: Range) => (min === max ? `#${min}` : `#${min}–${max}`);

interface Props {
  gameId: string | null;
  nick: string;
  slots: Character[];
  starting: boolean;
  onRestart: () => void;
  onChangeNick: () => void;
}

export default function ResultScreen({ gameId, nick, slots, starting, onRestart, onChangeNick }: Props) {
  const { total, results, correctOrder } = scoreGame(slots);
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="result">
      <div className="panel score-panel">
        <p className="score-label">Pontuação</p>
        <p className="score-value">
          {total}
          <span>/{MAX_SCORE}</span>
        </p>
        <p className="title-badge">{rankTitle(total)}</p>
        {gameId ? (
          <RankingStatus gameId={gameId} placements={slots.map((c) => c.id)} onSubmitted={() => setSubmitted(true)} />
        ) : (
          <p className="ranking-status">Partida offline: não conta pro ranking.</p>
        )}
        <div className="score-actions">
          <button className="btn btn-primary" onClick={onRestart} disabled={starting}>
            {starting ? 'Sorteando...' : 'Jogar de novo'}
          </button>
          <button className="link-button" onClick={onChangeNick} disabled={starting}>
            Trocar nick <span>({nick})</span>
          </button>
        </div>
      </div>

      <div className="result-columns">
        <div className="panel">
          <h3 className="section-title">Seu ranking</h3>
          <ol className="row-list">
            {results.map((r) => (
              <li key={r.position} className={`row row-yours hit-${Math.min(r.distance, 4)}`}>
                <RankBadge position={r.position} small />
                <Avatar character={r.character} size={32} />
                <span className="row-name">{r.character.name}</span>
                <span className="row-note">{r.distance === 0 ? 'Exato' : `→ ${formatRange(r.correct)}`}</span>
                <span className="row-points">+{r.points}</span>
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

      {gameId && (
        <div className="result-leaderboard">
          <Leaderboard refreshKey={submitted ? 1 : 0} highlight={nick} />
        </div>
      )}
    </section>
  );
}
