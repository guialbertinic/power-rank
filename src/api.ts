import type { Outcome, SymbolId } from './game/casino';
import type { CosmeticSlot, Look, Profile } from './game/cosmetics';
import type { Mode } from './game/modes';

/** "Hoje": melhor partida do dia (zera à meia-noite de Brasília). "Acumulado": soma do melhor de cada dia. */
export type Period = 'today' | 'total';

export interface LeaderboardEntry {
  name: string;
  score: number;
  /** Tempo da partida (só em "Hoje"; desempata pontuações iguais). */
  durationMs?: number;
  /** Quantos dias somaram (só em "Acumulado"). */
  days?: number;
  look: Look;
}

export interface SubmitResult {
  score: number;
  /** Tempo da partida medido no servidor. */
  durationMs: number;
  /** Melhor pontuação do jogador hoje, contando esta partida. */
  best: number;
  /** Bateu o próprio melhor de hoje. */
  isNewBest: boolean;
  /** Posição do jogador no ranking de hoje (null para convidado, que não entra no ranking). */
  rank: number | null;
  /** Moedas que esta partida rendeu e o saldo depois dela (null para convidado). */
  coinsEarned: number;
  coins: number | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `HTTP ${res.status}`, res.status, data);
  return data as T;
}

/** Erro de resposta da API (com o status HTTP); falhas de rede continuam sendo `TypeError`. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown,
  ) {
    super(message);
  }
}

export type ClaimResult =
  | { ok: true; name: string; token: string }
  | { ok: false; taken: boolean; hasPassword: boolean; error: string };

/**
 * Escolhe um nick: fica com ele se estiver livre (com a senha, se vier uma), confirma se o token for do dono,
 * ou entra com a senha num nick que já é seu em outro dispositivo.
 */
export async function claimNick(name: string, token: string | null, password?: string): Promise<ClaimResult> {
  try {
    const data = await request<{ name: string; token: string }>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ name, token, password: password || undefined }),
    });
    return { ok: true, ...data };
  } catch (err) {
    if (err instanceof ApiError) {
      const hasPassword = Boolean((err.data as { hasPassword?: boolean } | null)?.hasPassword);
      return { ok: false, taken: err.status === 409, hasPassword, error: err.message };
    }
    throw err;
  }
}

/** Consulta um nick sem ficar com ele: já tem dono? tem senha? */
export function nickStatus(name: string): Promise<{ exists: boolean; hasPassword: boolean }> {
  return request(`/api/players/status?name=${encodeURIComponent(name)}`);
}

/** Cria a senha de um nick que ainda não tem (depois ele entra com nick + senha em qualquer dispositivo). */
export async function setPassword(name: string, token: string, password: string): Promise<void> {
  await request('/api/players/password', { method: 'POST', body: JSON.stringify({ name, token, password }) });
}

/** Troca o nick da conta (se o novo não for de outra conta). Devolve o nick como ficou gravado. */
export async function renameNick(token: string, name: string): Promise<string> {
  const data = await request<{ name: string }>('/api/players/rename', {
    method: 'POST',
    body: JSON.stringify({ token, name }),
  });
  return data.name;
}

/**
 * Sorteia uma partida no servidor. `'unauthorized'` se o nick não for mais deste navegador;
 * null se a API não estiver disponível (o jogo sorteia localmente).
 */
export async function createGame(
  name: string,
  token: string | null,
  mode: Mode,
): Promise<{ gameId: string; characterIds: string[] } | 'unauthorized' | null> {
  try {
    return await request('/api/games', { method: 'POST', body: JSON.stringify({ name, token, mode }) });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return 'unauthorized';
    return null;
  }
}

const submissions = new Map<string, Promise<SubmitResult>>();

/** Envia o resultado da partida uma única vez, mesmo que seja chamado de novo (ex: StrictMode). */
export function submitScoreOnce(gameId: string, placements: string[]): Promise<SubmitResult> {
  let pending = submissions.get(gameId);
  if (!pending) {
    pending = request<SubmitResult>('/api/scores', {
      method: 'POST',
      body: JSON.stringify({ gameId, placements }),
    });
    submissions.set(gameId, pending);
  }
  return pending;
}

/** Cria uma sala da Party; o dono entra em seguida pelo WebSocket com o mesmo `pid`. */
export async function createParty(mode: Mode, pid: string): Promise<string> {
  const { code } = await request<{ code: string }>('/api/party', {
    method: 'POST',
    body: JSON.stringify({ mode, pid }),
  });
  return code;
}

interface Auth {
  name: string;
  token: string;
}

/** Saldo, itens comprados e visual equipado do próprio jogador. */
export function fetchProfile(auth: Auth): Promise<Profile> {
  return request('/api/profile', { method: 'POST', body: JSON.stringify(auth) });
}

export function buyItem(auth: Auth, itemId: string): Promise<Profile> {
  return request('/api/shop/buy', { method: 'POST', body: JSON.stringify({ ...auth, itemId }) });
}

export function equipItem(auth: Auth, slot: CosmeticSlot, itemId: string | null): Promise<Profile> {
  return request('/api/profile/equip', { method: 'POST', body: JSON.stringify({ ...auth, slot, itemId }) });
}

export interface CasinoState {
  pot: number;
  lastWinner: { name: string; prize: number; at: number } | null;
}

export interface SpinResult {
  reels: SymbolId[];
  outcome: Outcome;
  prize: number;
  /** Saldo depois do giro. */
  coins: number;
  pot: number;
  jackpot: boolean;
}

/** Pote acumulado e último ganhador do jackpot. */
export function fetchCasino(): Promise<CasinoState> {
  return request('/api/casino');
}

/** Gira o caça-níquel: o servidor debita a aposta, sorteia e credita o prêmio. */
export function spinCasino(token: string, bet: number): Promise<SpinResult> {
  return request('/api/casino/spin', { method: 'POST', body: JSON.stringify({ token, bet }) });
}

export async function fetchLeaderboard(mode: Mode, period: Period): Promise<LeaderboardEntry[]> {
  const { scores } = await request<{ scores: LeaderboardEntry[] }>(`/api/scores?mode=${mode}&period=${period}`);
  return scores;
}
