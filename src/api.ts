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
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

/** Sorteia uma partida no servidor. Retorna null se a API não estiver disponível. */
export async function createGame(
  name: string,
  mode: Mode,
): Promise<{ gameId: string; characterIds: string[] } | null> {
  try {
    return await request('/api/games', { method: 'POST', body: JSON.stringify({ name, mode }) });
  } catch {
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
