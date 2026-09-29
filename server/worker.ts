import { createGame } from './games';
import { json, type Env } from './lib';
import { connectParty, createParty } from './party';
import { claimPlayer, recoverPlayer } from './players';
import { getLeaderboard, submitScore } from './scores';

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
      const partySocket = request.method === 'GET' ? PARTY_SOCKET.exec(pathname) : null;
      if (partySocket) return await connectParty(request, env, partySocket[1].toUpperCase());

      switch (route) {
        case 'POST /api/games':
          return await createGame(request, env, ctx);
        case 'GET /api/scores':
          return await getLeaderboard(request, env);
        case 'POST /api/scores':
          return await submitScore(request, env);
        case 'POST /api/party':
          return await createParty(request, env);
        case 'POST /api/players':
          return await claimPlayer(request, env);
        case 'POST /api/players/recover':
          return await recoverPlayer(request, env);
        default:
          return json({ error: 'Not found' }, { status: 404 });
      }
    } catch (err) {
      console.error(route, err);
      return json({ error: 'Erro interno' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
