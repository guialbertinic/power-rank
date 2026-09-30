import { useState } from 'react';
import { confirmAdult } from '../api';
import type { Profile } from '../game/cosmetics';
import type { FeatureId, Features } from '../game/features';
import { serverText, useI18n } from '../i18n';
import type { Identity } from '../nick';
import { LegalLink } from './Legal';
import MysteryBox from './MysteryBox';
import PlinkoBoard from './PlinkoBoard';
import SlotMachine from './SlotMachine';

interface Props {
  identity: Identity & { token: string };
  profile: Profile;
  /** Chaves do banco: só os minigames ligados viram aba. */
  features: Features;
  onProfileChange: (profile: Profile) => void;
}

/** Minigames na ordem das abas; cada um tem a sua chave (feature flag) no banco. */
const GAMES: { id: FeatureId; label: string }[] = [
  { id: 'slots', label: 'Slots' },
  { id: 'plinko', label: 'Plinko' },
  { id: 'mystery_box', label: 'Mystery Box' },
];

/**
 * Arcade (só contas): abas com os minigames ligados. Cada jogo é uma "máquina" (gabinete .casino).
 * Só para maiores de 18: a conta declara uma vez (o servidor também recusa giros, bolinhas e caixas sem a declaração).
 */
export default function ArcadeScreen(props: Props) {
  const games = GAMES.filter((g) => props.features[g.id]);
  const [selected, setGame] = useState<FeatureId | null>(null);
  // A aba escolhida pode ter sido desligada: cai na primeira ligada.
  const game = games.find((g) => g.id === selected)?.id ?? games[0]?.id;
  if (!props.profile.adult) return <AdultGate {...props} />;
  if (!game) return <ArcadeClosed />;
  return (
    <div className="arcade-screen">
      <div className="shop-tabs arcade-tabs" role="tablist">
        {games.map((g) => (
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
      {game === 'slots' ? (
        <SlotMachine {...props} />
      ) : game === 'plinko' ? (
        <PlinkoBoard {...props} />
      ) : (
        <MysteryBox {...props} />
      )}
    </div>
  );
}

function ArcadeClosed() {
  const { t } = useI18n();
  return (
    <section className="panel arcade-closed">
      <p>{t('arcade.closed')}</p>
    </section>
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
