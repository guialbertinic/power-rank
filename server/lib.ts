import characters from '../data/characters.json';
import type { Character } from '../src/game/types';
import type { PartyRoom } from './party';

export interface Env {
  DB: D1Database;
  PARTY: DurableObjectNamespace<PartyRoom>;
}

export const CHARACTERS = characters as Character[];
export const CHARACTERS_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

/** Tempo máximo entre sortear a partida e enviar a pontuação. */
export const GAME_TTL_MS = 60 * 60 * 1000;
export const NAME_MAX_LENGTH = 20;
export const LEADERBOARD_SIZE = 20;

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, init);
}

export function badRequest(error: string): Response {
  return json({ error }, { status: 400 });
}

/** Remove caracteres de controle, junta espaços e corta no tamanho máximo. Retorna null se sobrar vazio. */
export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw
    .replace(/[\p{C}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX_LENGTH);
  return name || null;
}

/** Identidade do jogador no ranking: "Albertini" e "albertini" são o mesmo. */
export function nameKey(name: string): string {
  return name.normalize('NFC').toLocaleLowerCase('pt-BR');
}
