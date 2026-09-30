/** Cor da linha pela quantidade de pares errados envolvendo o personagem (0 = todos certos … 4 = quase tudo errado). */
export function hitLevel(pairsWrong: number): number {
  if (pairsWrong === 0) return 0;
  if (pairsWrong <= 2) return 1;
  if (pairsWrong <= 4) return 2;
  if (pairsWrong <= 6) return 3;
  return 4;
}

/** Os mesmos níveis em emoji, para o texto compartilhado (um quadrado por posição, estilo Wordle). */
export const HIT_EMOJI = ['🟩', '🟦', '🟨', '🟥', '⬛'] as const;
