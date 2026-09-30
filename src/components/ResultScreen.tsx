import { useEffect, useState } from 'react';
import { submitScoreOnce, type SubmitResult } from '../api';
import type { Mode } from '../game/modes';
import { MAX_SCORE, rankLevel } from '../game/scoring';
import { dailyLabel, serverText, useI18n } from '../i18n';
import type { CharacterInfo } from '../game/types';
import Leaderboard from './Leaderboard';
import RankingComparison from './RankingComparison';
import RankingStatus from './RankingStatus';
import ShareResult from './ShareResult';

interface Props {
  mode: Mode;
  gameId: string;
  nick: string;
  slots: CharacterInfo[];
  /** Partida do Desafio Diário: abre o ranking do desafio (a próxima partida já é normal). */
  daily?: boolean;
  starting: boolean;
  onRestart: () => void;
}

type Status = { kind: 'sending' } | { kind: 'done'; result: SubmitResult } | { kind: 'error'; message: string };

/**
 * Resultado da partida solo. A pontuação e a ordem correta vêm do servidor (o site não sabe o `power`):
 * envia as posições ao montar e mostra tudo quando a resposta chega.
 */
export default function ResultScreen({ mode, gameId, nick, slots, daily = false, starting, onRestart }: Props) {
  const { t, lang } = useI18n();
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
        if (!cancelled) setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Erro interno' });
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
        <p className="score-label">
          {t('result.scoreLabel', { mode: dailyLabel(t, mode, daily) })}
        </p>
        {result ? (
          <>
            <p className="score-value">
              {result.score}
              <span>/{MAX_SCORE}</span>
            </p>
            <p className="title-badge">{t(`rank.${rankLevel(result.score)}`)}</p>
            <RankingStatus result={result} />
          </>
        ) : status.kind === 'error' ? (
          <p className="ranking-status error">{t('result.error', { message: serverText(status.message, lang) })}</p>
        ) : (
          <p className="muted score-pending">{t('result.calculating')}</p>
        )}
        <div className="score-actions">
          <button className="btn btn-primary" onClick={onRestart} disabled={starting} aria-busy={starting}>
            {t('result.again')}
          </button>
        </div>
        {result && (
          <ShareResult mode={mode} nick={nick} slots={slots} ranks={result.ranks} score={result.score} daily={daily} />
        )}
      </div>

      {result && <RankingComparison slots={slots} ranks={result.ranks} />}

      {result && (
        <div className="result-leaderboard">
          <Leaderboard mode={mode} refreshKey={1} highlight={nick} initialPeriod={daily ? 'daily' : 'today'} />
        </div>
      )}
    </section>
  );
}
