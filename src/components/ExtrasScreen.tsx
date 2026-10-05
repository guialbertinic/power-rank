import { useState } from 'react';
import type { Profile } from '../game/cosmetics';
import { EXTRA_FEATURES, type Features } from '../game/features';
import { useI18n, type Key } from '../i18n';
import type { Identity } from '../nick';
import AutoBattle from './autobattle/AutoBattle';

interface Props {
  identity: Identity & { token: string };
  profile: Profile;
  /** Chaves do banco: só os jogos ligados aparecem na lista. */
  features: Features;
  onProfileChange: (profile: Profile) => void;
}

type GameId = (typeof EXTRA_FEATURES)[number];

/** Jogos da seção, na ordem da lista; cada um tem a sua chave (feature flag) no banco. */
const GAMES: { id: GameId; name: Key; description: Key }[] = [
  { id: 'autobattle', name: 'ab.name', description: 'ab.tagline' },
];

/**
 * "Mais jogos" (só contas): jogos que não são o ranking de poder. Uma lista com os jogos ligados; escolher um abre
 * o jogo no lugar da lista, com um link para voltar.
 */
export default function ExtrasScreen(props: Props) {
  const { t } = useI18n();
  const games = GAMES.filter((g) => props.features[g.id]);
  const [open, setOpen] = useState<GameId | null>(null);
  // O jogo aberto pode ter sido desligado.
  const game = games.find((g) => g.id === open)?.id ?? null;

  if (game) {
    return (
      <div className="extras-screen">
        <button className="link-button extras-back" onClick={() => setOpen(null)}>
          ‹ {t('extras.title')}
        </button>
        {game === 'autobattle' && <AutoBattle {...props} />}
      </div>
    );
  }

  return (
    <div className="extras-screen">
      {games.length === 0 && (
        <section className="panel">
          <p>{t('extras.closed')}</p>
        </section>
      )}
      {games.map((g) => (
        <section key={g.id} className="panel extras-game" data-game={g.id}>
          <h2 className="section-title">{t(g.name)}</h2>
          <p>{t(g.description)}</p>
          <button className="btn btn-primary" onClick={() => setOpen(g.id)}>
            {t('extras.play')}
          </button>
        </section>
      ))}
    </div>
  );
}
