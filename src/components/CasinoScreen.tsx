import { useState } from 'react';
import { confirmAdult } from '../api';
import type { Profile } from '../game/cosmetics';
import { serverText, useI18n } from '../i18n';
import type { Identity } from '../nick';
import { LegalLink } from './Legal';
import MysteryBox from './MysteryBox';
import SlotMachine from './SlotMachine';

interface Props {
  identity: Identity & { token: string };
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
}

type Game = 'slots' | 'box';

const GAMES: { id: Game; label: string }[] = [
  { id: 'slots', label: 'Slots' },
  { id: 'box', label: 'Mystery Box' },
];

/**
 * Cassino (só contas): abas com os jogos. Cada jogo é uma "máquina" (gabinete .casino).
 * Só para maiores de 18: a conta declara uma vez (o servidor também recusa giros e caixas sem a declaração).
 */
export default function CasinoScreen(props: Props) {
  const [game, setGame] = useState<Game>('slots');
  if (!props.profile.adult) return <AdultGate {...props} />;
  return (
    <div className="casino-screen">
      <div className="shop-tabs casino-tabs" role="tablist">
        {GAMES.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={game === g.id}
            className={`mode-option${game === g.id ? ' selected' : ''}`}
            onClick={() => setGame(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>
      {game === 'slots' ? <SlotMachine {...props} /> : <MysteryBox {...props} />}
    </div>
  );
}

function AdultGate({ identity, onProfileChange }: Props) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      onProfileChange(await confirmAdult(identity));
    } catch (err) {
      setError(serverText(err instanceof Error ? err.message : 'Erro interno', lang));
      setBusy(false);
    }
  };

  return (
    <section className="panel adult-gate">
      <p className="adult-badge" aria-hidden="true">
        18+
      </p>
      <h2 className="section-title">{t('adult.title')}</h2>
      <p>{t('adult.text')}</p>
      <button className="btn btn-primary adult-confirm" onClick={confirm} disabled={busy} aria-busy={busy}>
        {t('adult.confirm')}
      </button>
      {error && <p className="error">{error}</p>}
      <p className="legal-notice">
        {t('adult.noticeBefore')}
        <LegalLink doc="terms">{t('legal.terms')}</LegalLink>
        {t('adult.noticeAfter')}
      </p>
    </section>
  );
}
