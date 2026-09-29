import { DEFAULT_MODE, isMode, type Mode } from './game/modes';

export const NICK_MAX_LENGTH = 20;

/** Nick verificado neste navegador: o token prova que ele é o dono (ver server/players.ts). */
export interface Identity {
  name: string;
  /** null quando o nick foi escolhido sem conexão com o servidor (partidas não contam para o ranking). */
  token: string | null;
}

const IDENTITY_KEY = 'power-rank:player';
/** Tokens de todos os nicks já usados neste navegador, para poder trocar de nick e voltar. */
const TOKENS_KEY = 'power-rank:tokens';
/** Versões antigas guardavam só o nick. */
const LEGACY_NICK_KEY = 'power-rank:name';
const MODE_KEY = 'power-rank:mode';

/** Mesma normalização do servidor: sem diferenciar maiúsculas/minúsculas. */
export const nickKey = (nick: string) => nick.trim().normalize('NFC').toLocaleLowerCase('pt-BR');

export function sameNick(a: string, b: string): boolean {
  return nickKey(a) === nickKey(b);
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage indisponível (modo privado etc.): só não lembra entre visitas.
  }
}

export function loadIdentity(): Identity | null {
  const identity = read<Identity>(IDENTITY_KEY);
  return identity?.name ? identity : null;
}

export function saveIdentity(identity: Identity) {
  write(IDENTITY_KEY, identity);
  if (identity.token) write(TOKENS_KEY, { ...read<Record<string, string>>(TOKENS_KEY), [nickKey(identity.name)]: identity.token });
}

/** Token guardado para um nick que este navegador já usou. */
export function tokenFor(nick: string): string | null {
  return read<Record<string, string>>(TOKENS_KEY)?.[nickKey(nick)] ?? null;
}

/** Sugestão para o campo de nick: o atual ou o da versão antiga do jogo. */
export function suggestedNick(): string {
  try {
    return loadIdentity()?.name ?? localStorage.getItem(LEGACY_NICK_KEY) ?? '';
  } catch {
    return '';
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
