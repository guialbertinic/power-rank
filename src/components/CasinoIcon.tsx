import type { SymbolId } from '../game/casino';

/**
 * Ícone de um símbolo do caça-níquel. Por enquanto são SVGs desenhados aqui; quando houver imagens
 * (public/cassino/<id>.webp), basta trocar o conteúdo por <img>.
 */
export default function CasinoIcon({ id, size = 64 }: { id: SymbolId; size?: number }) {
  return (
    <svg className="casino-icon" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {ICONS[id]}
    </svg>
  );
}

/** Pontos de uma estrela de 5 pontas centrada em (cx, cy). */
function star(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

const ICONS: Record<SymbolId, React.ReactNode> = {
  dragonball: (
    <>
      <defs>
        <radialGradient id="casino-db" cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#fff2a8" />
          <stop offset="0.35" stopColor="#ffb52e" />
          <stop offset="1" stopColor="#e06a00" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#casino-db)" />
      {[
        [26, 26],
        [38, 26],
        [26, 38],
        [38, 38],
      ].map(([x, y]) => (
        <polygon key={`${x}-${y}`} points={star(x, y, 6)} fill="#d0021b" />
      ))}
      <ellipse cx="22" cy="16" rx="7" ry="3.5" fill="#fff" opacity="0.55" transform="rotate(-25 22 16)" />
    </>
  ),
  sharingan: (
    <>
      <circle cx="32" cy="32" r="28" fill="#c8001b" stroke="#2a0006" strokeWidth="2" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#2a0006" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="6.5" fill="#1a0003" />
      {[90, 210, 330].map((deg) => {
        const a = (deg * Math.PI) / 180;
        const x = 32 + 17 * Math.cos(a);
        const y = 32 - 17 * Math.sin(a);
        return (
          <g key={deg} transform={`rotate(${-deg} ${x} ${y})`}>
            <circle cx={x} cy={y} r="4.5" fill="#1a0003" />
            <path d={`M${x + 4.5} ${y} Q ${x + 6} ${y + 7} ${x - 1} ${y + 9}`} stroke="#1a0003" strokeWidth="2.2" fill="none" />
          </g>
        );
      })}
    </>
  ),
  deathnote: (
    <>
      <rect x="13" y="6" width="38" height="52" rx="3" fill="#121212" stroke="#4a4a4a" strokeWidth="1.5" />
      <rect x="13" y="6" width="5" height="52" fill="#050505" />
      <text x="34" y="30" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" fontWeight="700" fill="#e8e8e8">
        DEATH
      </text>
      <text x="34" y="40" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8" fontWeight="700" fill="#e8e8e8">
        NOTE
      </text>
    </>
  ),
  bandana: (
    <>
      <path d="M2 24 L62 24 L62 40 L2 40 Z" fill="#1f3a8a" />
      <path d="M2 40 L-2 56 L10 44 Z" fill="#1f3a8a" />
      <rect x="14" y="17" width="36" height="30" rx="4" fill="#cfd6e0" stroke="#7a8594" strokeWidth="1.5" />
      <circle cx="18" cy="21" r="1.4" fill="#7a8594" />
      <circle cx="46" cy="21" r="1.4" fill="#7a8594" />
      <circle cx="18" cy="43" r="1.4" fill="#7a8594" />
      <circle cx="46" cy="43" r="1.4" fill="#7a8594" />
      {/* Folha: espiral com a ponta */}
      <path
        d="M33 32 m0 0 a3 3 0 1 1 -3 -3 a6 6 0 1 1 -6 6 a9 9 0 0 0 9 9 L42 26"
        fill="none"
        stroke="#3a4556"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </>
  ),
  hat: (
    <>
      <ellipse cx="32" cy="44" rx="29" ry="9" fill="#e3b94f" stroke="#a9832a" strokeWidth="1.5" />
      <path d="M17 42 C17 22, 47 22, 47 42 Z" fill="#f0cd68" stroke="#a9832a" strokeWidth="1.5" />
      <path d="M17.5 37 C22 40.5, 42 40.5, 46.5 37 L47 42 C42 45.5, 22 45.5, 17 42 Z" fill="#d0021b" />
    </>
  ),
  shuriken: (
    <>
      <path
        d="M32 3 L38 26 L61 32 L38 38 L32 61 L26 38 L3 32 L26 26 Z"
        fill="#aab3c4"
        stroke="#5b6475"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M32 3 L38 26 L32 32 Z M61 32 L38 38 L32 32 Z M32 61 L26 38 L32 32 Z M3 32 L26 26 L32 32 Z" fill="#d9dfe8" />
      <circle cx="32" cy="32" r="5" fill="#2c3345" />
    </>
  ),
  pokeball: (
    <>
      <circle cx="32" cy="32" r="28" fill="#f4f4f4" stroke="#1a1a1a" strokeWidth="2.5" />
      <path d="M4 32 A28 28 0 0 1 60 32 Z" fill="#e3242b" stroke="#1a1a1a" strokeWidth="2.5" />
      <rect x="4" y="29.5" width="56" height="5" fill="#1a1a1a" />
      <circle cx="32" cy="32" r="8.5" fill="#f4f4f4" stroke="#1a1a1a" strokeWidth="3.5" />
      <circle cx="32" cy="32" r="3.5" fill="#fff" stroke="#bbb" strokeWidth="1" />
    </>
  ),
};
