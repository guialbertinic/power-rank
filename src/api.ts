export interface LeaderboardEntry {
  name: string;
  score: number;
  createdAt: number;
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

/** Sorteia uma partida no servidor. Retorna null se a API não estiver disponível (ex: `npm run dev` sem backend). */
export async function createGame(): Promise<{ gameId: string; characterIds: string[] } | null> {
  try {
    return await request('/api/games', { method: 'POST' });
  } catch {
    return null;
  }
}

export function submitScore(gameId: string, name: string, placements: string[]) {
  return request<{ score: number; rank: number }>('/api/scores', {
    method: 'POST',
    body: JSON.stringify({ gameId, name, placements }),
  });
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { scores } = await request<{ scores: LeaderboardEntry[] }>('/api/scores');
  return scores;
}
