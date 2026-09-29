export type Tier = 'ss' | 's' | 'a' | 'b' | 'c' | 'd';

/** Cor da posição no ranking (1 = SS … 10 = D). */
export function tierForPosition(position: number): Tier {
  if (position <= 1) return 'ss';
  if (position <= 3) return 's';
  if (position <= 5) return 'a';
  if (position <= 7) return 'b';
  if (position <= 9) return 'c';
  return 'd';
}

/** Tier pelo nível de poder (0–100), usado na revelação do resultado. */
export function tierForPower(power: number): Tier {
  if (power >= 95) return 'ss';
  if (power >= 85) return 's';
  if (power >= 75) return 'a';
  if (power >= 60) return 'b';
  if (power >= 45) return 'c';
  return 'd';
}

export const tierClass = (tier: Tier) => `tier-${tier}`;
