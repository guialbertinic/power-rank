import { loadCatalog } from './catalog';
import { badRequest, json, nameKey, sanitizeName, type Env } from './lib';
import { accountByToken } from './players';
import { isReportKind, isReportReason } from '../src/game/reports';

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * POST /api/reports { token?, kind, target, reason } → { ok }. Denúncia de nick (`target` = nick como aparece) ou
 * pedido de remoção de imagem (`target` = id do personagem). Vai para a fila de moderação do admin.
 * Quem denuncia: a conta (token) ou, para convidado, o hash do IP (o IP em si não fica guardado). Uma denúncia
 * aberta por pessoa e alvo: repetir não soma (o índice único ignora).
 */
export async function createReport(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { token?: unknown; kind?: unknown; target?: unknown; reason?: unknown }
    | null;
  const kind = body?.kind;
  if (!isReportKind(kind) || !isReportReason(kind, body?.reason)) return badRequest('Denúncia inválida');

  let target: string;
  let targetName: string;
  let playerId: number | null = null;
  if (kind === 'nick') {
    const name = sanitizeName(body?.target);
    if (!name) return badRequest('Nick inválido');
    target = nameKey(name);
    targetName = name;
    const owner = await env.DB.prepare('SELECT id FROM players WHERE name_key = ?').bind(target).first<{ id: number }>();
    playerId = owner?.id ?? null;
  } else {
    const character = typeof body?.target === 'string' ? (await loadCatalog(env)).byId.get(body.target) : undefined;
    if (!character) return badRequest('Personagem desconhecido');
    target = character.id;
    targetName = character.name;
  }

  const account = body?.token ? await accountByToken(env, body.token) : null;
  const reporter = account
    ? `p:${account.id}`
    : `ip:${(await sha256(request.headers.get('CF-Connecting-IP') ?? 'local')).slice(0, 32)}`;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO reports (kind, target, target_name, target_player_id, reason, reporter, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(kind, target, targetName, playerId, body!.reason, reporter, Date.now())
    .run();
  return json({ ok: true });
}

const IMAGE_ROUTE = /^\/api\/img\/([a-z0-9-]+)$/;

/**
 * GET /api/img/:id → imagem enviada pelo admin (tabela `character_images`). A URL leva ?v= da versão (troca de
 * imagem = URL nova), então pode ficar em cache por muito tempo.
 */
export async function characterImage(pathname: string, env: Env): Promise<Response | null> {
  const match = IMAGE_ROUTE.exec(pathname);
  if (!match) return null;
  const row = await env.DB.prepare('SELECT data, content_type FROM character_images WHERE character_id = ?')
    .bind(match[1])
    .first<{ data: ArrayBuffer | number[]; content_type: string }>();
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  const bytes = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data);
  return new Response(bytes, {
    headers: {
      'Content-Type': row.content_type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
