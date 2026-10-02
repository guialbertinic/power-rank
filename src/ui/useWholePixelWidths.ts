import { useLayoutEffect, type RefObject } from 'react';

/**
 * Arredonda para cima a largura de cada filho do grupo para px inteiros. Nos botões inclinados colados, a largura
 * vem do texto (ex: 144,78px) e o navegador encaixa a pintura de cada botão no pixel para um lado: numa fresta de
 * 3px, isso aparece como uma fresta maior que as outras. Com larguras inteiras, todas as bordas têm a mesma fração
 * de pixel e as frestas ficam iguais. Só em flex com largura pelo conteúdo: em grade ou com `flex: 1` (celular), a
 * largura vem do espaço disponível e é deixada livre.
 * `deps`: o que muda o texto dos botões (idioma, itens).
 */
export function useWholePixelWidths(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    let cancelled = false;
    const snap = () => {
      if (cancelled) return;
      const items = [...group.children] as HTMLElement[];
      // Mede todos sem a largura fixada antes de fixar (medir e escrever intercalado mediria já alterado).
      for (const item of items) item.style.width = '';
      const byContent =
        getComputedStyle(group).display === 'flex' && items.every((item) => getComputedStyle(item).flexGrow === '0');
      if (!byContent) return;
      const widths = items.map((item) => item.getBoundingClientRect().width);
      items.forEach((item, i) => (item.style.width = `${Math.ceil(widths[i])}px`));
    };
    snap();
    // A fonte do site pode chegar depois: a largura do texto muda.
    document.fonts?.ready.then(snap);
    window.addEventListener('resize', snap);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', snap);
    };
  }, deps);
}
