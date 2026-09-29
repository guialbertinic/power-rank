import { createGame } from './games';
import { json, type Env } from './lib';
import { getLeaderboard, submitScore } from './scores';

/**
 * Worker da API. Só recebe /api/* (ver `run_worker_first` no wrangler.jsonc);
 * o resto é servido direto dos assets estáticos do build do Vite.
 */
export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const route = `${request.method} ${pathname}`;

    try {
      switch (route) {
        case 'POST /api/games':
          return await createGame(request, env, ctx);
        case 'GET /api/scores':
          return await getLeaderboard(request, env);
        case 'POST /api/scores':
          return await submitScore(request, env);
        default:
          return json({ error: 'Not found' }, { status: 404 });
      }
    } catch (err) {
      console.error(route, err);
      return json({ error: 'Erro interno' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
