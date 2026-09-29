import { tierClass, tierForPower } from '../ui/tiers';

const SEGMENTS = 10;

/** Barra de poder segmentada e inclinada; os segmentos acendem em sequência a partir de `delay` ms. */
export default function PowerMeter({ power, delay = 0 }: { power: number; delay?: number }) {
  const filled = Math.ceil((power / 100) * SEGMENTS);
  return (
    <span
      className={`power-meter ${tierClass(tierForPower(power))}`}
      role="meter"
      aria-label="Poder"
      aria-valuenow={power}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={i < filled ? 'seg on' : 'seg'}
          style={i < filled ? { animationDelay: `${delay + i * 45}ms` } : undefined}
        />
      ))}
    </span>
  );
}
