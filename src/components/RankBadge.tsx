import { tierClass, tierForPosition } from '../ui/tiers';

/** Indicador angular da posição, colorido pelo tier da posição (#1 = SS … #10 = D). */
export default function RankBadge({ position, small }: { position: number; small?: boolean }) {
  return (
    <span className={`rank-badge ${small ? 'rank-badge-sm ' : ''}${tierClass(tierForPosition(position))}`}>
      {position}
    </span>
  );
}
