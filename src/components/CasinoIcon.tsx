import { SYMBOLS, type SymbolId } from '../game/casino';

const src = (id: SymbolId) => `/slots/${id}.webp`;

/** Ícone de um símbolo do caça-níquel: pixel art do Game Corner, ampliada 4× (public/slots/<id>.webp). */
export default function CasinoIcon({ id, size = 64 }: { id: SymbolId; size?: number }) {
  return <img className="casino-icon" src={src(id)} width={size} height={size} alt="" draggable={false} />;
}

/** Baixa os 7 ícones antes do primeiro giro (a fita dos rolos não pisca). */
export function preloadCasinoIcons() {
  for (const s of SYMBOLS) new Image().src = src(s.id);
}
