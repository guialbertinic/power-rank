import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry } from '../api';
import { sameNick } from '../nick';
import RankBadge from './RankBadge';

/** Top do ranking global. `refreshKey` força recarregar (ex: depois de enviar uma pontuação). */
export default function Leaderboard({ refreshKey = 0, highlight }: { refreshKey?: number; highlight?: string }) {
  const [scores, setScores] = useState<LeaderboardEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard()
      .then((s) => {
        if (!cancelled) setScores(s);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (failed) return null;

  return (
    <div className="panel leaderboard">
      <h3 className="section-title">Ranking global</h3>
      {scores === null && <p className="muted">Carregando...</p>}
      {scores?.length === 0 && <p className="muted">Ninguém jogou ainda. Seja o primeiro.</p>}
      {scores && scores.length > 0 && (
        <ol className="row-list">
          {scores.map((s, i) => (
            <li key={i} className={`row row-leader${highlight && sameNick(s.name, highlight) ? ' highlight' : ''}`}>
              <RankBadge position={i + 1} small />
              <span className="row-name">{s.name}</span>
              <span className="row-score">{s.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
