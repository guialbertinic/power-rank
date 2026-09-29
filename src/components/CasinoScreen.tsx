import { useState } from 'react';
import type { Profile } from '../game/cosmetics';
import type { Identity } from '../nick';
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

/** Cassino (só contas): abas com os jogos. Cada jogo é uma "máquina" (gabinete .casino). */
export default function CasinoScreen(props: Props) {
  const [game, setGame] = useState<Game>('slots');
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
