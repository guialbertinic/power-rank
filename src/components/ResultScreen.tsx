import { useState } from 'react';
import { MODES, type Mode } from '../game/modes';
import { MAX_SCORE, rankTitle, scoreGame } from '../game/scoring';
import type { Character } from '../game/types';
import { tierClass, tierForPower } from '../ui/tiers';
import Avatar from './Avatar';
import Leaderboard from './Leaderboard';
import PowerMeter from './PowerMeter';
import RankBadge from './RankBadge';
import RankingStatus from './RankingStatus';

/** Cor da linha pela quantidade de pares errados envolvendo o personagem (0 = todos certos). */
function hitLevel(pairsWrong: number): number {
  if (pairsWrong === 0) return 0;
  if (pairsWrong <= 2) return 1;
  if (pairsWrong <= 4) return 2;
  if (pairsWrong <= 6) return 3;
  return 4;
}

interface Props {
  mode: Mode;
  gameId: string | null;
  nick: string;
  slots: Character[];
  starting: boolean;
  onRestart: () => void;
  onChangeNick: () => void;
}

export default function ResultScreen({ mode, gameId, nick, slots, starting, onRestart, onChangeNick }: Props) {
  const { total, results, correctOrder } = scoreGame(slots);
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

      {gameId && (
        <div className="result-leaderboard">
          <Leaderboard mode={mode} refreshKey={submitted ? 1 : 0} highlight={nick} />
        </div>
      )}
    </section>
  );
}
