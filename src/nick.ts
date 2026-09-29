import { DEFAULT_MODE, isMode, type Mode } from './game/modes';

const NICK_KEY = 'power-rank:name';
const MODE_KEY = 'power-rank:mode';
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

/** Última categoria escolhida neste navegador. */
export function loadMode(): Mode {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    return isMode(mode) ? mode : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function saveMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage indisponível: só não lembra a categoria.
  }
}

/** Mesma comparação do servidor: sem diferenciar maiúsculas/minúsculas. */
export function sameNick(a: string, b: string): boolean {
  return a.trim().normalize('NFC').toLocaleLowerCase('pt-BR') === b.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
}
