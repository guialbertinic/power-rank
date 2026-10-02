import type { ReactNode } from 'react';

/**
 * Desenho de cada emblema (SVG 24×24, preenchido com `currentColor`). A cor, o brilho e a animação vêm da classe
 * `cosmetic-<id>` em styles.css. `.badge-cut` = recorte na cor do fundo (olhos, números, facetas).
 */
const SHAPES: Record<string, ReactNode> = {
  'badge-star': <path d="M12 2l3 7 7 .5-5.5 4.5 2 7.5-6.5-4-6.5 4 2-7.5L2 9.5 9 9z" />,
  'badge-bolt': <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  'badge-heart': <path d="M12 21s-8.5-5.3-8.5-11.2A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.5 2.6C20.5 15.7 12 21 12 21z" />,
  'badge-flame': <path d="M12 2c.6 3.6 5.8 6.1 5.8 11.6a5.8 5.8 0 0 1-11.6 0c0-2.6 1.4-4.2 2.6-5.7.3 1.9 1.3 3.1 2.6 3.6C10.8 9 10.4 5 12 2z" />,
  'badge-skull': (
    <>
      <path d="M12 2a8 8 0 0 0-8 8c0 3 1.4 5 3 6.2V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.8c1.6-1.2 3-3.2 3-6.2a8 8 0 0 0-8-8z" />
      <circle className="badge-cut" cx="9" cy="11" r="2.1" />
      <circle className="badge-cut" cx="15" cy="11" r="2.1" />
      <path className="badge-cut" d="M12 14l-1.2 2h2.4z" />
    </>
  ),
  'badge-sword': (
    <>
      <path d="M21 3v4l-9.5 9.5-4-4L17 3z" />
      <path d="M4.5 11l8.5 8.5-1.5 1.5L3 12.5z" />
      <path d="M6.5 16l1.5 1.5L4.5 21 3 19.5z" />
    </>
  ),
  'badge-shield': (
    <>
      <path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" />
      <path className="badge-cut" d="M12 6.5l1.4 3 3.1.3-2.4 2 .8 3.1-2.9-1.7-2.9 1.7.8-3.1-2.4-2 3.1-.3z" />
    </>
  ),
  'badge-moon': <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  'badge-eye': (
    <>
      <path d="M1.5 12S5.3 4.8 12 4.8 22.5 12 22.5 12 18.7 19.2 12 19.2 1.5 12 1.5 12z" />
      <circle className="badge-cut" cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.8" />
    </>
  ),
  'badge-diamond': (
    <>
      <path d="M7 3h10l5 6-10 12L2 9z" />
      <path className="badge-cut-line" d="M2 9h20M9 3l3 6 3-6M12 9v11" />
    </>
  ),
  'badge-crown': (
    <>
      <path d="M2.5 7.5l5 4.2L12 4.5l4.5 7.2 5-4.2-2 11.5h-15z" />
      <path d="M4.8 20.5h14.4V22H4.8z" />
    </>
  ),
  // Recompensas de conquistas.
  'badge-veteran': (
    <>
      <path d="M4 3l8 5 8-5v4.5l-8 5-8-5z" />
      <path d="M4 11l8 5 8-5v4.5l-8 5-8-5z" />
    </>
  ),
  'badge-scouter': (
    <>
      <circle className="badge-line" cx="12" cy="12" r="7" />
      <path className="badge-line" d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  'badge-perfect': (
    <>
      <path d="M12 1l2.6 2.7 3.6-.9 1 3.6 3.6 1-.9 3.6L23 12l-2.7 2.6.9 3.6-3.6 1-1 3.6-3.6-.9L12 23l-2.6-2.7-3.6.9-1-3.6-3.6-1 .9-3.6L1 12l2.7-2.6-.9-3.6 3.6-1 1-3.6 3.6.9z" />
      <text className="badge-cut badge-text" x="12" y="15.6" textAnchor="middle" fontSize="10">
        10
      </text>
    </>
  ),
  'badge-streak7': (
    <>
      <path d="M12 1c.7 3.9 7 6.6 7 12.6a7 7 0 0 1-14 0c0-3 1.7-4.8 3-6.4.4 2 1.4 3.3 2.8 3.9C10.6 8 10.2 4.2 12 1z" />
      <text className="badge-cut badge-text" x="12" y="19.5" textAnchor="middle" fontSize="9">
        7
      </text>
    </>
  ),
  'badge-streak30': (
    <>
      <path d="M12 1c.7 3.9 7 6.6 7 12.6a7 7 0 0 1-14 0c0-3 1.7-4.8 3-6.4.4 2 1.4 3.3 2.8 3.9C10.6 8 10.2 4.2 12 1z" />
      <text className="badge-cut badge-text" x="12" y="19.3" textAnchor="middle" fontSize="7.5">
        30
      </text>
    </>
  ),
  'badge-trophy': (
    <>
      <path d="M7 2.5h10V7a5 5 0 0 1-3.8 4.9V15H16v3H8v-3h2.8v-3.1A5 5 0 0 1 7 7z" />
      <path className="badge-line" d="M7 4.5H3.8v1.2A3.3 3.3 0 0 0 7 9M17 4.5h3.2v1.2A3.3 3.3 0 0 1 17 9" />
      <path d="M6 19.5h12V22H6z" />
    </>
  ),
  'badge-eclectic': (
    <>
      <circle className="badge-dot-1" cx="12" cy="4.5" r="3.2" />
      <circle className="badge-dot-2" cx="19.2" cy="9.7" r="3.2" />
      <circle className="badge-dot-3" cx="16.4" cy="18.2" r="3.2" />
      <circle className="badge-dot-4" cx="7.6" cy="18.2" r="3.2" />
      <circle className="badge-dot-5" cx="4.8" cy="9.7" r="3.2" />
      <circle cx="12" cy="12.2" r="2.6" />
    </>
  ),
};

interface Props {
  id: string;
  /** Nome do emblema (leitor de tela e dica ao passar o mouse); sem nome, é decorativo. */
  label?: string;
  className?: string;
}

/** Emblema equipado (ao lado do nick) ou prévia na loja. Id desconhecido: nada. */
export default function BadgeIcon({ id, label, className = '' }: Props) {
  const shape = SHAPES[id];
  if (!shape) return null;
  return (
    <svg
      className={`badge-icon cosmetic-${id} ${className}`.trim()}
      viewBox="0 0 24 24"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}
      {shape}
    </svg>
  );
}
