import type { SymbolId } from '../game/casino';
import { tierClass } from '../ui/tiers';

/**
 * Símbolo do caça-níquel: o badge chanfrado do tier (SS … D), nas cores do tier. Desenhado em CSS, sem imagem.
 * O tamanho vem do CSS (--icon-size: rolo, fita, tabela); `small` = versão da tabela de prêmios.
 * Duas camadas: o brilho de vitória (filter) fica na de fora, porque o clip-path da de dentro cortaria a sombra.
 */
export default function CasinoIcon({ id, small }: { id: SymbolId; small?: boolean }) {
  return (
    <span
      className={`casino-icon ${tierClass(id)}${small ? ' casino-icon-sm' : ''}`}
      // Na tabela de prêmios o ícone é o nome do símbolo; nos rolos é decoração (o resultado sai em texto).
      {...(small ? { role: 'img', 'aria-label': id.toUpperCase() } : { 'aria-hidden': true })}
    >
      <span className="casino-icon-face">{id.toUpperCase()}</span>
    </span>
  );
}
