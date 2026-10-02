import { getAchievements, markAchievementsSeen } from './achievements';
import { handleAdmin } from './admin';
import { getCasino, spin } from './casino';
import { getCharacters, getCharactersWithPower } from './catalog';
import { dailyStatus } from './daily';
import { createGame } from './games';
import { openBox } from './gacha';
import { json, type Env } from './lib';
import { connectParty, createParty } from './party';
import { changePassword, claimPlayer, deletePlayer, logoutAll, playerStatus, renamePlayer, setPassword } from './players';
import { drop } from './plinko';
import { buyItem, confirmAdult, equipItem, getProfile } from './profile';
import { getLeaderboard, submitScore } from './scores';
import { characterImage, createReport } from './reports';
import { buyCard } from './scratch';
import { getConfig, rateLimit } from './security';

// O Durable Object das salas da Party precisa ser exportado pelo módulo principal do Worker.
export { PartyRoom } from './party';

const PARTY_SOCKET = /^\/api\/party\/([A-Za-z]+)\/ws$/;

/**
 * GET /api/health: o Worker e o D1 respondem? Para um monitor externo (ex: UptimeRobot) avisar quando o site
 * cair. 503 se o banco não responder. Sem cache.
 */
async function health(env: Env): Promise<Response> {
  const started = Date.now();
  const headers = { 'Cache-Control': 'no-store' };
  try {
    await env.DB.prepare('SELECT 1').first();
    return json({ ok: true, db: 'ok', ms: Date.now() - started }, { headers });
  } catch (err) {
    console.error('health: D1 não respondeu', err);
    return json({ ok: false, db: 'error' }, { status: 503, headers });
  }
}

/**
 * Worker da API. Só recebe /api/* (ver `run_worker_first` no wrangler.jsonc);
 * o resto é servido direto dos assets estáticos do build do Vite.
 */
export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const route = `${request.method} ${pathname}`;

    try {
      const limited = await rateLimit(request, env, route);
      if (limited) return limited;

      const partySocket = request.method === 'GET' ? PARTY_SOCKET.exec(pathname) : null;
      if (partySocket) return await connectParty(request, env, partySocket[1].toUpperCase());
      if (pathname.startsWith('/api/admin/')) return await handleAdmin(request, env);
      if (request.method === 'GET' && pathname.startsWith('/api/img/')) {
        const image = await characterImage(pathname, env);
        if (image) return image;
      }

      switch (route) {
        case 'GET /api/health':
          return await health(env);
        case 'GET /api/config':
          return await getConfig(env);
        case 'GET /api/characters':
          return await getCharacters(env);
        case 'GET /api/dev/characters':
          return await getCharactersWithPower(request, env);
        case 'GET /api/slots':
          return await getCasino(env);
        case 'POST /api/slots/spin':
          return await spin(request, env);
        case 'POST /api/plinko/drop':
          return await drop(request, env);
        case 'POST /api/scratch/buy':
          return await buyCard(request, env);
        case 'POST /api/gacha/open':
          return await openBox(request, env);
        case 'POST /api/games':
          return await createGame(request, env, ctx);
        case 'POST /api/daily':
          return await dailyStatus(request, env);
        case 'GET /api/scores':
          return await getLeaderboard(request, env);
        case 'POST /api/scores':
          return await submitScore(request, env);
        case 'POST /api/party':
          return await createParty(request, env);
        case 'POST /api/players':
          return await claimPlayer(request, env);
        case 'GET /api/players/status':
          return await playerStatus(request, env);
        case 'POST /api/players/rename':
          return await renamePlayer(request, env);
        case 'POST /api/players/password':
          return await setPassword(request, env);
        case 'POST /api/players/delete':
          return await deletePlayer(request, env);
        case 'POST /api/players/change-password':
          return await changePassword(request, env);
        case 'POST /api/players/logout-all':
          return await logoutAll(request, env);
        case 'POST /api/reports':
          return await createReport(request, env);
        case 'POST /api/profile':
          return await getProfile(request, env);
        case 'POST /api/profile/adult':
          return await confirmAdult(request, env);
        case 'POST /api/achievements':
          return await getAchievements(request, env);
        case 'POST /api/achievements/seen':
          return await markAchievementsSeen(request, env);
        case 'POST /api/profile/equip':
          return await equipItem(request, env);
        case 'POST /api/shop/buy':
          return await buyItem(request, env);
        default:
          return json({ error: 'Not found' }, { status: 404 });
      }
    } catch (err) {
      console.error(route, err);
      return json({ error: 'Erro interno' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
