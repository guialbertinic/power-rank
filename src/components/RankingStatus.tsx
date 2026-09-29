import type { SubmitResult } from '../api';
import { useI18n } from '../i18n';
import { formatDuration } from '../ui/format';
import Coins from './Coins';

/** Depois do envio: tempo da partida, moedas ganhas e o recorde do dia (se bateu). */
export default function RankingStatus({ result }: { result: SubmitResult }) {
  const { t } = useI18n();
  const { isNewBest, rank, coinsEarned, coins, durationMs } = result;
  return (
    <>
      <p className="muted ranking-time">{t('result.time', { time: formatDuration(durationMs) })}</p>
      <p className="coins-earned">
        {coins === null
          ? t('coins.guest')
          : coinsEarned
            ? <Coins amount={coinsEarned} prefix="+" />
            : t('coins.min')}
      </p>
      {isNewBest && (
        <p className="ranking-status new-best">
          {t('result.newBestBefore')}
          <strong>#{rank}</strong>
          {t('result.newBestAfter')}
        </p>
      )}
    </>
  );
}
