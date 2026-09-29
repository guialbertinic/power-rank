import { useI18n } from '../i18n';

/** Quantidade de moedas com o ícone do jogo (moeda chanfrada dourada). */
export default function Coins({ amount, prefix = '' }: { amount: number; prefix?: string }) {
  const { t } = useI18n();
  return (
    <span className="coins" aria-label={t('coins.aria', { amount: `${prefix}${amount}` })}>
      <svg className="coin-icon" viewBox="0 0 16 16" aria-hidden="true">
        <polygon points="5,1 11,1 15,5 15,11 11,15 5,15 1,11 1,5" />
        <polygon className="coin-inner" points="6,4 10,4 12,6 12,10 10,12 6,12 4,10 4,6" />
      </svg>
      {prefix}
      {amount}
    </span>
  );
}
