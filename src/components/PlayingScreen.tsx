import { useEffect } from 'react';
import type { Character } from '../game/types';
import Avatar from './Avatar';

interface Props {
  current: Character;
  index: number;
  slots: (Character | null)[];
  onPlace: (slot: number) => void;
}

export default function PlayingScreen({ current, index, slots, onPlace }: Props) {
  // Atalho: teclas 1-9 e 0 (= posição 10).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!/^[0-9]$/.test(e.key)) return;
      const slot = e.key === '0' ? 9 : Number(e.key) - 1;
      if (slot < slots.length) onPlace(slot);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slots.length, onPlace]);

  return (
    <section className="playing">
      <div className="panel current">
        <p className="counter">
          Personagem {index + 1} de {slots.length}
        </p>
        <div key={current.id} className="current-card">
          <Avatar character={current} size={160} />
          <h2>{current.name}</h2>
          <p className="anime">{current.anime}</p>
          {current.version && <p className="version">{current.version}</p>}
        </div>
        <p className="hint">Escolha uma posição ao lado (ou tecle 1–9, 0 = 10)</p>
      </div>

      <ol className="panel slots">
        {slots.map((character, i) => (
          <li key={i}>
            <button className="slot" disabled={character !== null} onClick={() => onPlace(i)}>
              <span className="slot-pos">#{i + 1}</span>
              {character ? (
                <>
                  <Avatar character={character} size={36} />
                  <span className="slot-name">{character.name}</span>
                </>
              ) : (
                <span className="slot-empty">Colocar aqui</span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
