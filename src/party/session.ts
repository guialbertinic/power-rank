/**
 * Id secreto do jogador numa sala. Fica no sessionStorage da aba: recarregar a página reconecta na mesma vaga,
 * e outra aba ou dispositivo entra como outro jogador.
 */
const key = (code: string) => `power-rank:party-pid:${code}`;

export function newPid(): string {
  return crypto.randomUUID();
}

export function partyPid(code: string): string {
  try {
    const saved = sessionStorage.getItem(key(code));
    if (saved) return saved;
    const pid = newPid();
    sessionStorage.setItem(key(code), pid);
    return pid;
  } catch {
    return newPid();
  }
}

/** Associa um pid já usado (o de quem criou a sala) ao código recebido do servidor. */
export function rememberPartyPid(code: string, pid: string) {
  try {
    sessionStorage.setItem(key(code), pid);
  } catch {
    // Sem storage: a reconexão após recarregar a página não vai funcionar, mas o jogo segue.
  }
}

/** Link de convite: abre o jogo com o código já preenchido. */
export function inviteLink(code: string): string {
  return `${window.location.origin}/?sala=${code}`;
}

/** Código vindo de um link de convite (?sala=ABCDEF), se houver. */
export function codeFromUrl(): string {
  return new URLSearchParams(window.location.search).get('sala')?.toUpperCase() ?? '';
}

export function clearCodeFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('sala')) return;
  url.searchParams.delete('sala');
  window.history.replaceState(null, '', url);
}
