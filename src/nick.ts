import {
  DEFAULT_DIFFICULTY,
  DEFAULT_MODE,
  GENERATIONS,
  isDifficulty,
  isMode,
  parseGenerations,
  type Difficulty,
  type Mode,
} from './game/modes';

export const NICK_MAX_LENGTH = 20;

/** Quem está jogando neste navegador: dono de uma conta (com token) ou convidado (ver server/players.ts). */
export interface Identity {
  name: string;
  /** null = convidado: o nick não é reservado e não ganha moedas (só pode usar nicks sem conta). */
  token: string | null;
}

const IDENTITY_KEY = 'power-rank:player';
/** Tokens de todos os nicks já usados neste navegador, para poder trocar de nick e voltar. */
const TOKENS_KEY = 'power-rank:tokens';
/** Versões antigas guardavam só o nick. */
const LEGACY_NICK_KEY = 'power-rank:name';
const MODE_KEY = 'power-rank:mode';
const GENERATIONS_KEY = 'power-rank:generations';
const DIFFICULTY_KEY = 'power-rank:difficulty';

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

/** Esquece o token de um nick (saiu da conta ou trocou o nick dela). */
export function forgetToken(nick: string) {
  const tokens = read<Record<string, string>>(TOKENS_KEY);
  if (!tokens) return;
  delete tokens[nickKey(nick)];
  write(TOKENS_KEY, tokens);
}

/** Sai da conta neste navegador: volta para a tela do nick sem guardar o token. */
export function clearIdentity(identity: Identity) {
  forgetToken(identity.name);
  try {
    localStorage.removeItem(IDENTITY_KEY);
  } catch {
    // Storage indisponível: nada a limpar.
  }
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

/** Gerações ligadas no modo Pokémon neste navegador (padrão: todas). */
export function loadGenerations(): number[] {
  try {
    const saved = parseGenerations(JSON.parse(localStorage.getItem(GENERATIONS_KEY) ?? 'null'));
    return saved ?? [...GENERATIONS];
  } catch {
    return [...GENERATIONS];
  }
}

export function saveGenerations(generations: number[]) {
  try {
    localStorage.setItem(GENERATIONS_KEY, JSON.stringify(generations));
  } catch {
    // Storage indisponível: só não lembra o filtro.
  }
}

/** Dificuldade escolhida neste navegador (Animes, Games e Free for All). */
export function loadDifficulty(): Difficulty {
  try {
    const saved = localStorage.getItem(DIFFICULTY_KEY);
    return isDifficulty(saved) ? saved : DEFAULT_DIFFICULTY;
  } catch {
    return DEFAULT_DIFFICULTY;
  }
}

export function saveDifficulty(difficulty: Difficulty) {
  try {
    localStorage.setItem(DIFFICULTY_KEY, difficulty);
  } catch {
    // Storage indisponível: só não lembra a dificuldade.
  }
}

export function saveMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage indisponível: só não lembra a categoria.
  }
}
