const NICK_KEY = 'power-rank:name';
export const NICK_MAX_LENGTH = 20;

/** Nick lembrado neste navegador (vazio se não houver ou se o storage estiver bloqueado). */
export function loadNick(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveNick(nick: string) {
  try {
    localStorage.setItem(NICK_KEY, nick);
  } catch {
    // Storage indisponível (modo privado etc.): só não lembra o nick.
  }
}

/** Mesma comparação do servidor: sem diferenciar maiúsculas/minúsculas. */
export function sameNick(a: string, b: string): boolean {
  return a.trim().normalize('NFC').toLocaleLowerCase('pt-BR') === b.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
}
