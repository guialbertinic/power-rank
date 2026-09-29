import { useEffect, useState } from 'react';
import { submitScoreOnce, type SubmitResult } from '../api';
import { MODES, type Mode } from '../game/modes';
import { MAX_SCORE, rankTitle } from '../game/scoring';
import type { CharacterInfo } from '../game/types';
import Leaderboard from './Leaderboard';
import RankingComparison from './RankingComparison';
import RankingStatus from './RankingStatus';

interface Props {
  mode: Mode;
  gameId: string;
  nick: string;
  slots: CharacterInfo[];
  starting: boolean;
  onRestart: () => void;
}

type Status = { kind: 'sending' } | { kind: 'done'; result: SubmitResult } | { kind: 'error'; message: string };

/**
 * Resultado da partida solo. A pontuação e a ordem correta vêm do servidor (o site não sabe o `power`):
 * envia as posições ao montar e mostra tudo quando a resposta chega.
 */
export default function ResultScreen({ mode, gameId, nick, slots, starting, onRestart }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'sending' });

  useEffect(() => {
    let cancelled = false;
    submitScoreOnce(
      gameId,
      slots.map((c) => c.id),
    )
      .then((result) => {
        if (!cancelled) setStatus({ kind: 'done', result });
      })
      .catch((err: unknown) => {
        if (!cancelled) setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'erro desconhecido' });
      });
    return () => {
      cancelled = true;
    };
    // Envio é por partida: as posições não mudam depois que o resultado aparece.
  }, [gameId]);

  const result = status.kind === 'done' ? status.result : null;

  return (
    <section className="result">
      <div className="panel score-panel" aria-busy={!result}>
        <p className="score-label">Pontuação · {MODES.find((m) => m.id === mode)?.label}</p>
        {result ? (
          <>
            <p className="score-value">
              {result.score}
              <span>/{MAX_SCORE}</span>
            </p>
            <p className="title-badge">{rankTitle(result.score)}</p>
            <RankingStatus result={result} />
          </>
        ) : status.kind === 'error' ? (
          <p className="ranking-status error">Não foi possível calcular o resultado: {status.message}</p>
        ) : (
          <p className="muted score-pending">Calculando...</p>
        )}
        <div className="score-actions">
          <button className="btn btn-primary" onClick={onRestart} disabled={starting} aria-busy={starting}>
            Jogar de novo
          </button>
        </div>
      </div>

      {result && <RankingComparison slots={slots} ranks={result.ranks} />}

      {result && (
        <div className="result-leaderboard">
          <Leaderboard mode={mode} refreshKey={1} highlight={nick} />
        </div>
      )}
    </section>
  );
}
