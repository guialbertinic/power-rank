import type { Mode } from './game/modes';

export interface LeaderboardEntry {
  name: string;
  score: number;
  createdAt: number;
}

export interface SubmitResult {
  score: number;
  /** Melhor pontuação do jogador, contando esta partida. */
  best: number;
  isNewBest: boolean;
  /** Posição do melhor resultado do jogador no ranking global. */
  rank: number;
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
  | { ok: false; taken: boolean; error: string };

/** Escolhe um nick: fica com ele se estiver livre, ou confirma se o token for do dono. */
export async function claimNick(name: string, token: string | null): Promise<ClaimResult> {
  try {
    const data = await request<{ name: string; token: string }>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ name, token }),
    });
    return { ok: true, ...data };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, taken: err.status === 409, error: err.message };
    throw err;
  }
}

/** Usa o código de sincronização (gerado no outro aparelho) para ter o nick neste. */
/** Gera um novo código de sincronização para levar o nick a outro aparelho (o anterior deixa de valer). */
export async function createSyncCode(name: string, token: string): Promise<string> {
  const { code } = await request<{ code: string }>('/api/players/sync-code', {
    method: 'POST',
    body: JSON.stringify({ name, token }),
  });
  return code;
}

export async function recoverNick(name: string, recoveryCode: string): Promise<{ name: string; token: string }> {
  return request('/api/players/recover', { method: 'POST', body: JSON.stringify({ name, recoveryCode }) });
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
  if (!token) return null;
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

export async function fetchLeaderboard(mode: Mode): Promise<LeaderboardEntry[]> {
  const { scores } = await request<{ scores: LeaderboardEntry[] }>(`/api/scores?mode=${mode}`);
  return scores;
}
