import { useEffect, useRef, useState } from 'react';

/**
 * Loading de um botão que só envia uma mensagem (party): fica "carregando" do clique até a tela mudar
 * (o componente desmonta) ou, se o servidor recusar, até o tempo limite.
 */
export function usePendingClick(timeoutMs = 5000): [boolean, (action: () => void) => void] {
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = (action: () => void) => {
    setPending(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPending(false), timeoutMs);
    action();
  };
  return [pending, run];
}
