import { useEffect } from 'react';
import type { CharacterInfo } from '../game/types';
import { useI18n } from '../i18n';
import { tierClass, tierForPosition } from '../ui/tiers';
import Avatar from './Avatar';
import PowerCard from './PowerCard';
import RankBadge from './RankBadge';

interface Props {
  current: CharacterInfo;
  index: number;
  slots: (CharacterInfo | null)[];
  onPlace: (slot: number) => void;
}

export default function PlayingScreen({ current, index, slots, onPlace }: Props) {
  const { t } = useI18n();
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

  const counter = `${String(index + 1).padStart(2, '0')}/${String(slots.length).padStart(2, '0')}`;

  return (
    <section className="playing">
      <div className="playing-card">
        <PowerCard key={current.id} character={current} badge={counter} />
        <p className="hint">{t('playing.keysHint')}</p>
      </div>

      <ol className="rank-slots">
        {slots.map((character, i) => (
          <li key={i}>
            <button
              className={`rank-slot ${tierClass(tierForPosition(i + 1))}${character ? ' filled' : ''}`}
              disabled={character !== null}
              onClick={() => onPlace(i)}
              aria-label={
                character
                  ? t('playing.slotFilled', { n: i + 1, name: character.name })
                  : t('playing.slotEmpty', { n: i + 1 })
              }
            >
              <RankBadge position={i + 1} />
              <span className="rank-slot-body">
                {character && (
                  <>
                    <Avatar character={character} size={36} />
                    <span className="rank-slot-name">{character.name}</span>
                  </>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
