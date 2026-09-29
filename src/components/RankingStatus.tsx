import { useEffect, useState } from 'react';
import { submitScoreOnce, type SubmitResult } from '../api';

type Status = { kind: 'sending' } | { kind: 'done'; result: SubmitResult } | { kind: 'error'; message: string };

interface Props {
  gameId: string;
  placements: string[];
  onSubmitted: () => void;
}

/** Envia o resultado automaticamente ao montar; só aparece quando a partida é um novo recorde (ou se falhar). */
export default function RankingStatus({ gameId, placements, onSubmitted }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'sending' });

  useEffect(() => {
    let cancelled = false;
    submitScoreOnce(gameId, placements)
      .then((result) => {
        if (cancelled) return;
        setStatus({ kind: 'done', result });
        onSubmitted();
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

  const { isNewBest, rank } = status.result;
  if (!isNewBest) return null;
  return (
    <p className="ranking-status new-best">
      Novo recorde! Você está em <strong>#{rank}</strong> no ranking global.
    </p>
  );
}
