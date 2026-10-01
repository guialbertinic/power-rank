/** Cor da linha pela distância até a posição certa (0 = exata … 4 = 4 casas ou mais), as faixas da pontuação. */
export function hitLevel(distance: number): number {
  return Math.min(distance, 4);
}

/** Os mesmos níveis em emoji, para o texto compartilhado (um quadrado por posição, estilo Wordle). */
export const HIT_EMOJI = ['🟩', '🟦', '🟨', '🟥', '⬛'] as const;
