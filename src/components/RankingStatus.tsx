import type { SubmitResult } from '../api';
import { formatDuration } from '../ui/format';
import Coins from './Coins';

/** Depois do envio: tempo da partida, moedas ganhas e o recorde do dia (se bateu). */
export default function RankingStatus({ result }: { result: SubmitResult }) {
  const { isNewBest, rank, coinsEarned, coins, durationMs } = result;
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
