import { useEffect, useState } from 'react';
import { submitScoreOnce, type SubmitResult } from '../api';
import { formatDuration } from '../ui/format';
import Coins from './Coins';

type Status = { kind: 'sending' } | { kind: 'done'; result: SubmitResult } | { kind: 'error'; message: string };

interface Props {
  gameId: string;
  placements: string[];
  onSubmitted: (result: SubmitResult) => void;
}

/** Envia o resultado automaticamente ao montar e mostra as moedas ganhas (e o recorde, se bateu). */
export default function RankingStatus({ gameId, placements, onSubmitted }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'sending' });

  useEffect(() => {
    let cancelled = false;
    submitScoreOnce(gameId, placements)
      .then((result) => {
        if (cancelled) return;
        setStatus({ kind: 'done', result });
        onSubmitted(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'erro desconhecido' });
      });
    return () => {
      cancelled = true;
    };
    // Envio é por partida: placements e onSubmitted não mudam depois que o resultado aparece.
  }, [gameId]);

  if (status.kind === 'sending') return null;
  if (status.kind === 'error') {
    return <p className="ranking-status error">Não foi possível enviar ao ranking: {status.message}</p>;
  }

  const { isNewBest, rank, coinsEarned, coins, durationMs } = status.result;
  return (
    <>
      <p className="muted ranking-time">Tempo: {formatDuration(durationMs)}</p>
      <p className="coins-earned">
        {coins === null
          ? 'Crie uma conta para entrar no ranking e ganhar moedas'
          : coinsEarned
            ? <Coins amount={coinsEarned} prefix="+" />
            : 'Faça 500+ pontos para ganhar moedas'}
      </p>
      {isNewBest && (
        <p className="ranking-status new-best">
          Seu melhor de hoje! Você está em <strong>#{rank}</strong> no ranking de hoje.
        </p>
      )}
    </>
  );
}
