import { useEffect, useState } from 'react';
import { SLOTS } from '../../game/scoring';
import type { Character } from '../../game/types';
import { preloadImages } from '../../ui/fallback';
import PlayingScreen from '../PlayingScreen';

interface Props {
  drawn: Character[];
  onProgress: (placed: number) => void;
  onFinish: (placements: string[]) => void;
}

/**
 * A partida de um jogador na party: mesma mecânica do solo, com as posições guardadas localmente.
 * Cada posicionamento avisa a sala (progresso) e, ao completar, envia as posições.
 * Montado com `key={round}`, então cada rodada começa do zero.
 */
export default function PartyPlay({ drawn, onProgress, onFinish }: Props) {
  const [slots, setSlots] = useState<(Character | null)[]>(() => Array(SLOTS).fill(null));
  const placed = slots.filter(Boolean).length;

  useEffect(() => {
    void preloadImages(drawn);
  }, [drawn]);

  useEffect(() => {
    onProgress(placed);
    if (placed === SLOTS) onFinish((slots as Character[]).map((c) => c.id));
    // Só reage a cada novo posicionamento.
  }, [placed]);

  const onPlace = (slot: number) => {
    setSlots((current) => {
      if (current[slot] || placed >= SLOTS) return current;
      const next = [...current];
      next[slot] = drawn[current.filter(Boolean).length];
      return next;
    });
  };

  if (placed >= SLOTS) return null;
  return <PlayingScreen current={drawn[placed]} index={placed} slots={slots} onPlace={onPlace} />;
}
