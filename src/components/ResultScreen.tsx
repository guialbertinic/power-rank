import { useState } from 'react';
import { MODES, type Mode } from '../game/modes';
import { MAX_SCORE, rankTitle, scoreGame } from '../game/scoring';
import type { Character } from '../game/types';
import Leaderboard from './Leaderboard';
import RankingComparison from './RankingComparison';
import RankingStatus from './RankingStatus';

interface Props {
  mode: Mode;
  gameId: string | null;
  nick: string;
  slots: Character[];
  starting: boolean;
  onRestart: () => void;
}

export default function ResultScreen({ mode, gameId, nick, slots, starting, onRestart }: Props) {
  const { total } = scoreGame(slots);
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="result">
      <div className="panel score-panel">
        <p className="score-label">Pontuação · {MODES.find((m) => m.id === mode)?.label}</p>
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
          <button className="btn btn-primary" onClick={onRestart} disabled={starting} aria-busy={starting}>
            Jogar de novo
          </button>
        </div>
      </div>

      <RankingComparison slots={slots} />

      {gameId && (
        <div className="result-leaderboard">
          <Leaderboard mode={mode} refreshKey={submitted ? 1 : 0} highlight={nick} />
        </div>
      )}
    </section>
  );
}
