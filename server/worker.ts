import { handleAdmin } from './admin';
import { getCasino, spin } from './casino';
import { getCharacters, getCharactersWithPower } from './catalog';
import { dailyStatus } from './daily';
import { createGame } from './games';
import { openBox } from './gacha';
import { json, type Env } from './lib';
import { connectParty, createParty } from './party';
import { claimPlayer, playerStatus, renamePlayer, setPassword } from './players';
import { drop } from './plinko';
import { buyItem, confirmAdult, equipItem, getProfile } from './profile';
import { getLeaderboard, submitScore } from './scores';
import { getConfig, rateLimit } from './security';

// O Durable Object das salas da Party precisa ser exportado pelo módulo principal do Worker.
export { PartyRoom } from './party';

const PARTY_SOCKET = /^\/api\/party\/([A-Za-z]+)\/ws$/;

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

      switch (route) {
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
        case 'POST /api/profile':
          return await getProfile(request, env);
        case 'POST /api/profile/adult':
          return await confirmAdult(request, env);
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
