import type { ReactNode } from 'react';

export type NavId = 'home' | 'shop' | 'achievements' | 'arcade';

/**
 * Ícones da navegação da barra de perfil (SVG 24×24, `currentColor`). Os furos (janela da casa, controles do
 * joystick) são subcaminhos com `evenodd`: ficam transparentes, na cor do botão.
 */
const SHAPES: Record<NavId, ReactNode> = {
  home: <path fillRule="evenodd" d="M12 2.5l10 8.8h-3V21h-5.2v-6h-3.6v6H5v-9.7H2z" />,
  shop: (
    <>
      <path d="M4.5 8h15l-1.2 13.5H5.7z" />
      <path className="nav-icon-line" d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  achievements: (
    <>
      <path d="M6.5 2.5h11V9a5.5 5.5 0 0 1-11 0z" />
      <path className="nav-icon-line" d="M6.5 4.5H3.5v1.5a3.5 3.5 0 0 0 3.5 3.5M17.5 4.5h3v1.5A3.5 3.5 0 0 1 17 9.5" />
      <path d="M10.8 14h2.4v3.5h-2.4zM6.5 18h11v3.5h-11z" />
    </>
  ),
  arcade: (
    <path
      fillRule="evenodd"
      d="M7 6.5h10a5.5 5.5 0 0 1 5.5 5.5v1.5a4 4 0 0 1-7.2 2.4L14 14.5h-4l-1.3 1.4a4 4 0 0 1-7.2-2.4V12A5.5 5.5 0 0 1 7 6.5zM6.6 9.5v2h-2v1.6h2v2h1.6v-2h2v-1.6h-2v-2zM15 11a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0zM17.4 13.6a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0z"
    />
  ),
};

/** Decorativo: o botão já tem o nome (visível no desktop, só para leitor de tela no celular). */
export default function NavIcon({ id }: { id: NavId }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {SHAPES[id]}
    </svg>
  );
}
