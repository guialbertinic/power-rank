import type { Look } from './cosmetics';
import type { Difficulty, Mode } from './modes';

/**
 * Protocolo da Party (multiplayer). Compartilhado entre o front e o Durable Object `PartyRoom`,
 * por isso sem dependência de DOM.
 *
 * Fluxo: lobby → playing → podium → (dono inicia de novo) → playing ...
 */

export const PARTY_MAX_PLAYERS = 8;
export const PARTY_CODE_LENGTH = 6;
/** Sem I e O, para não confundir com 1 e 0. */
export const PARTY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export type PartyPhase = 'lobby' | 'playing' | 'podium';

export interface PartyPlayer {
  /** Id público (o id secreto do jogador nunca sai do servidor). */
  id: string;
  name: string;
  connected: boolean;
  /** Quantos personagens já posicionou na partida atual. */
  progress: number;
  finished: boolean;
  /** Visual equipado do jogador. */
  look: Look;
  /** Jogando como convidado (nick sem conta): não ganha moedas. */
  guest?: boolean;
  /** Só aparecem no pódio. */
  score?: number;
  placements?: string[];
  finishedAt?: number;
  /** Moedas ganhas na rodada (pontuação + bônus de pódio). */
  coinsEarned?: number;
}

export interface PartyState {
  code: string;
  mode: Mode;
  /** Filtro de gerações do modo pokemon, escolhido por quem criou a sala (ausente = todas). */
  generations?: number[];
  /** Dificuldade dos outros modos, escolhida por quem criou a sala (ausente = todos os personagens). */
  difficulty?: Difficulty;
  phase: PartyPhase;
  /** Incrementa a cada partida iniciada na sala. */
  round: number;
  hostId: string;
  /** Os 10 personagens sorteados da partida atual (vazio no lobby). */
  characterIds: string[];
  /** Só no pódio: quantos sorteados são mais fortes que cada um (a ordem correta, nunca o `power`). */
  ranks?: Record<string, number>;
  players: PartyPlayer[];
}

export type ClientMessage =
  | { type: 'start' }
  | { type: 'progress'; placed: number }
  | { type: 'finish'; placements: string[] }
  | { type: 'end' };

export type ServerMessage =
  | { type: 'state'; state: PartyState; you: string }
  | { type: 'error'; message: string };

export function isPartyCode(value: string): boolean {
  return new RegExp(`^[${PARTY_CODE_ALPHABET}]{${PARTY_CODE_LENGTH}}$`).test(value);
}

export function normalizePartyCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, PARTY_CODE_LENGTH);
}

/** Classificação do pódio: maior pontuação primeiro; empate, quem terminou antes. */
export function podiumOrder(players: PartyPlayer[]): PartyPlayer[] {
  return players
    .filter((p) => p.finished && p.score !== undefined)
    .sort((a, b) => b.score! - a.score! || (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
}
