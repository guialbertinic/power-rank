import type { AchievementsState } from './game/achievements';
import type { Outcome, SymbolId } from './game/casino';
import type { CosmeticSlot, Look, Profile } from './game/cosmetics';
import type { Features } from './game/features';
import type { Rarity } from './game/gacha';
import type { Risk } from './game/plinko';
import type { Mode, PoolFilter } from './game/modes';
import type { ReportKind, ReportReason } from './game/reports';
import type { CharacterInfo } from './game/types';

/**
 * Ranking da categoria, só do Desafio Diário. "Desafio": a partida de cada um no desafio de hoje.
 * "Acumulado": soma de todos os desafios.
 */
export type Period = 'daily' | 'total';

export interface LeaderboardEntry {
  name: string;
  score: number;
  /** Tempo da partida (só em "Desafio"; desempata pontuações iguais). */
  durationMs?: number;
  /** Quantos dias somaram (só em "Acumulado"). */
  days?: number;
  look: Look;
}

export interface SubmitResult {
  score: number;
  /** Ordem correta dos 10: quantos são mais fortes que cada um (nunca o valor de `power`). */
  ranks: Record<string, number>;
  /** Tempo da partida medido no servidor. */
  durationMs: number;
  /** Posição no ranking do desafio (null em partida solo e para convidado, que não entram no ranking). */
  rank: number | null;
  /** Partida do Desafio Diário. */
  daily: boolean;
  /** Moedas que esta partida rendeu e o saldo depois dela (null para convidado). */
  coinsEarned: number;
  coins: number | null;
  /** Conquistas desbloqueadas por esta partida (ids). */
  achievements: string[];
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
export async function claimNick(
  name: string,
  token: string | null,
  password?: string,
  /** Token do anti-bot (Turnstile), exigido ao criar conta quando está ligado. */
  turnstile?: string | null,
): Promise<ClaimResult> {
  try {
    const data = await request<{ name: string; token: string }>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ name, token, password: password || undefined, turnstile: turnstile || undefined }),
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
/** `problem`: motivo para o nick não poder ser usado por conta nova nem convidado (ofensivo, imita outra conta). */
export function nickStatus(name: string): Promise<{ exists: boolean; hasPassword: boolean; problem: string | null }> {
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

/** Troca a senha (pedindo a atual); os outros aparelhos da conta são desconectados. */
export async function changePassword(token: string, current: string, password: string): Promise<void> {
  await request('/api/players/change-password', { method: 'POST', body: JSON.stringify({ token, current, password }) });
}

/** Desconecta todos os aparelhos da conta, inclusive este. */
export async function logoutAll(token: string): Promise<void> {
  await request('/api/players/logout-all', { method: 'POST', body: JSON.stringify({ token }) });
}

/** Denuncia um nick ou pede a remoção da imagem de um personagem (vai para a fila de moderação). */
export async function sendReport(token: string | null, kind: ReportKind, target: string, reason: ReportReason): Promise<void> {
  await request('/api/reports', { method: 'POST', body: JSON.stringify({ token, kind, target, reason }) });
}

/** Exclui a conta e os dados dela (a senha é pedida se a conta tiver uma). */
export async function deleteAccount(token: string, password: string): Promise<void> {
  await request('/api/players/delete', { method: 'POST', body: JSON.stringify({ token, password }) });
}

/**
 * Sorteia uma partida no servidor. `'unauthorized'` se o nick não for mais deste navegador;
 * null se a API não estiver disponível (o jogo sorteia localmente).
 */
export async function createGame(
  name: string,
  token: string | null,
  mode: Mode,
  /** Desafio Diário da categoria (uma tentativa por dia; recusado se já jogou). */
  daily = false,
  /** Gerações (modo pokemon) ou dificuldade (outros modos); o desafio diário ignora. */
  filter: PoolFilter = {},
): Promise<
  | { gameId: string; characterIds: string[]; characters: CharacterInfo[]; daily: boolean }
  | 'unauthorized'
  | { error: string }
  | null
> {
  try {
    return await request('/api/games', { method: 'POST', body: JSON.stringify({ name, token, mode, daily, ...filter }) });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return 'unauthorized';
    // Recusa do servidor (ex: nick não permitido, muitas partidas seguidas): mostra o motivo.
    if (err instanceof ApiError) return { error: err.message };
    return null;
  }
}

export interface DailyStatus {
  /** Já jogou (ou começou) o desafio de hoje desta categoria. */
  done: boolean;
  /** Pontuação no desafio de hoje (null se não terminou). */
  score: number | null;
}

/** Desafio Diário de hoje da categoria para este jogador: se ainda pode jogar. */
export function fetchDaily(name: string, token: string | null, mode: Mode): Promise<DailyStatus> {
  return request('/api/daily', { method: 'POST', body: JSON.stringify({ name, token, mode }) });
}

/** Configuração pública do servidor: chave do anti-bot (null = desligado) e chaves dos minigames. */
export function fetchConfig(): Promise<{ turnstileSiteKey: string | null; features: Features }> {
  return request('/api/config');
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
export async function createParty(mode: Mode, pid: string, filter: PoolFilter = {}): Promise<string> {
  const { code } = await request<{ code: string }>('/api/party', {
    method: 'POST',
    body: JSON.stringify({ mode, pid, ...filter }),
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

/** Contadores e conquistas desbloqueadas da conta. */
export function fetchAchievements(token: string): Promise<AchievementsState> {
  return request('/api/achievements', { method: 'POST', body: JSON.stringify({ token }) });
}

/** O jogador viu o aviso das conquistas novas. */
export async function markAchievementsSeen(token: string): Promise<void> {
  await request('/api/achievements/seen', { method: 'POST', body: JSON.stringify({ token }) });
}

/** A conta declara ter 18 anos ou mais (libera caça-níquel e Mystery Box). */
export function confirmAdult(auth: Auth): Promise<Profile> {
  return request('/api/profile/adult', { method: 'POST', body: JSON.stringify(auth) });
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

export interface BoxResult {
  rarity: Rarity;
  itemId: string;
  /** Já tinha o item: voltaram `refund` moedas. */
  duplicate: boolean;
  refund: number;
  /** Perfil depois da caixa (saldo e itens). */
  profile: Profile;
}

/** Abre uma Mystery Box: o servidor cobra, sorteia e entrega o item (ou devolve moedas, se repetido). */
export function openBox(token: string): Promise<BoxResult> {
  return request('/api/gacha/open', { method: 'POST', body: JSON.stringify({ token }) });
}

/** Pote acumulado e último ganhador do jackpot. */
export function fetchCasino(): Promise<CasinoState> {
  return request('/api/slots');
}

/** Gira o caça-níquel: o servidor debita a aposta, sorteia e credita o prêmio. */
export function spinCasino(token: string, bet: number): Promise<SpinResult> {
  return request('/api/slots/spin', { method: 'POST', body: JSON.stringify({ token, bet }) });
}

export interface PlinkoDrop {
  /** Uma direção por fileira (0 = esquerda, 1 = direita). */
  path: (0 | 1)[];
  slot: number;
  /** Em décimos (16 = 1,6×). */
  multiplier: number;
  prize: number;
  /** Saldo depois da bolinha (aposta e prêmio já contados). */
  coins: number;
}

/** Solta uma bolinha do Plinko: o servidor debita a aposta, sorteia o caminho e credita o prêmio. */
export function dropPlinko(token: string, bet: number, risk: Risk): Promise<PlinkoDrop> {
  return request('/api/plinko/drop', { method: 'POST', body: JSON.stringify({ token, bet, risk }) });
}

export interface ScratchCard {
  /** As 9 casas, linha por linha. */
  cells: SymbolId[];
  /** Símbolo do trio (null = sem prêmio). */
  symbol: SymbolId | null;
  multiplier: number;
  prize: number;
  /** Saldo depois da cartela (aposta e prêmio já contados). */
  coins: number;
}

/** Compra uma cartela da Raspadinha: o servidor debita a aposta, sorteia a cartela e credita o prêmio. */
export function buyScratch(token: string, bet: number): Promise<ScratchCard> {
  return request('/api/scratch/buy', { method: 'POST', body: JSON.stringify({ token, bet }) });
}

export async function fetchLeaderboard(mode: Mode, period: Period): Promise<LeaderboardEntry[]> {
  const { scores } = await request<{ scores: LeaderboardEntry[] }>(`/api/scores?mode=${mode}&period=${period}`);
  return scores;
}
