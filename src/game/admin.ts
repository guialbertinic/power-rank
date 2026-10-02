import type { FeatureId } from './features';
import type { Rarity } from './gacha';

/** Respostas das rotas /api/admin/* (compartilhadas entre o Worker e a tela de admin). */

export interface AdminFeature {
  id: FeatureId;
  enabled: boolean;
  /** Última mudança (null = sem linha no banco, conta como desligada). */
  updatedAt: number | null;
}

export type AdminActionKind = 'feature' | 'coins' | 'rename' | 'password';

export interface AdminAction {
  id: number;
  admin: string;
  action: AdminActionKind;
  playerId: number | null;
  /** Nick atual do jogador afetado. */
  playerName: string | null;
  details: Record<string, unknown>;
  createdAt: number;
}

/** Somas de um período (tudo e últimos 7 dias). */
export interface Period<T> {
  total: T;
  week: T;
}

export interface Economy {
  accounts: number;
  /** Moedas nos saldos de todas as contas agora. */
  circulating: number;
  /** Maior saldo e a média. */
  maxBalance: number;
  avgBalance: number;
  /** Moedas ganhas em partidas. */
  earned: Period<number>;
  /** Moedas dadas (positivo) ou tiradas (negativo) pelo admin. */
  granted: Period<number>;
  slots: Period<{ spins: number; bet: number; prize: number; jackpots: number }> & { pot: number };
  plinko: Period<{ drops: number; bet: number; prize: number }>;
  scratch: Period<{ cards: number; bet: number; prize: number }>;
  box: Period<{ openings: number; spent: number; refunded: number }> & {
    /** Aberturas por raridade (tudo) e a chance configurada, para comparar. */
    rarities: { rarity: Rarity; count: number; chance: number }[];
  };
  /** Itens com mais donos (compra na loja ou Mystery Box). */
  topItems: { itemId: string; owners: number }[];
}

export interface AdminPlayerRow {
  id: number;
  name: string;
  coins: number;
  createdAt: number;
  hasPassword: boolean;
  adult: boolean;
  /** Bloqueado por senha errada até (0 = não). */
  lockedUntil: number;
}

export interface AdminPlayer extends AdminPlayerRow {
  items: number;
  devices: number;
  games: number;
  /** Moedas ganhas em partidas. */
  earned: number;
  slots: { spins: number; bet: number; prize: number };
  plinko: { drops: number; bet: number; prize: number };
  scratch: { cards: number; bet: number; prize: number };
  box: { openings: number; spent: number; refunded: number };
  recentScores: { mode: string; score: number; coins: number; daily: boolean; createdAt: number }[];
  recentAccess: { event: string; ip: string; country: string | null; createdAt: number }[];
  actions: AdminAction[];
}

/** Limite do ajuste de moedas numa ação (evita erro de digitação com zeros a mais). */
export const ADMIN_COINS_MAX = 100_000;
