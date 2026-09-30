import type { Env } from './lib';

/** Quanto tempo o registro de acesso fica guardado (está na política de privacidade: mudou aqui, muda lá). */
export const ACCESS_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const USER_AGENT_MAX_LENGTH = 200;

export type AccessEvent = 'signup' | 'login' | 'login_failed' | 'score' | 'party';

/**
 * Grava quem fez o quê e de qual IP, para investigar abuso e trapaça (várias contas no mesmo IP, scripts,
 * tentativa de senha). Nunca atrapalha a requisição: se falhar, só registra no log do Worker.
 * Aproveita para apagar o que passou do prazo de retenção (índice em created_at: é barato).
 */
export async function logAccess(
  env: Env,
  request: Request,
  event: AccessEvent,
  who: { playerId?: number | null; name?: string | null } = {},
): Promise<void> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  const userAgent = request.headers.get('User-Agent')?.slice(0, USER_AGENT_MAX_LENGTH) ?? null;
  const now = Date.now();
  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO access_log (event, player_id, name, ip, country, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(event, who.playerId ?? null, who.name ?? null, ip, cf?.country ?? null, userAgent, now),
      env.DB.prepare('DELETE FROM access_log WHERE created_at < ?').bind(now - ACCESS_LOG_RETENTION_MS),
    ]);
  } catch (err) {
    console.error('access_log', err);
  }
}
