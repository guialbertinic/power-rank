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
export async function createGame(name: string): Promise<{ gameId: string; characterIds: string[] } | null> {
  try {
    return await request('/api/games', { method: 'POST', body: JSON.stringify({ name }) });
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

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { scores } = await request<{ scores: LeaderboardEntry[] }>('/api/scores');
  return scores;
}
