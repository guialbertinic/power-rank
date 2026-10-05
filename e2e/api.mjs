// Testes e2e da API (sem navegador): nick, economia/loja e party por WebSocket.
// Uso: com `npm run dev` rodando, `npm run e2e:api`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BASE,
  ROOT,
  check,
  cleanTestData,
  MIN_GAME_MS,
  d1,
  ensureServer,
  finish,
  get,
  nick,
  partyClient,
  PASSWORD,
  TURNSTILE_TEST_TOKEN,
  perfectOrder,
  player,
  playDaily,
  playSolo,
  post,
  section,
  sleep,
} from './lib.mjs';

await ensureServer();
cleanTestData();

// ---------- Catálogo sem power ----------
if (section('Catálogo')) {
  const catalog = await get('/characters');
  check('catálogo público tem os personagens', Array.isArray(catalog) && catalog.length >= 100, `${catalog.length}`);
  check('catálogo público não tem power', !catalog.some((c) => 'power' in c));
  const names = catalog.map((c) => c.name);
  check('catálogo em ordem alfabética (a ordem não entrega o ranking)', names.every((n, i) => !i || names[i - 1].localeCompare(n) <= 0));
  const guestGame = await post('/games', { name: nick('Catalogo'), mode: 'anime' });
  check('partida traz os personagens sem power', guestGame.data.characters?.length === 10 && !guestGame.data.characters.some((c) => 'power' in c));
  const ids = perfectOrder(guestGame.data.characterIds);
  await sleep(MIN_GAME_MS + 100);
  const { data: scored } = await post('/scores', { gameId: guestGame.data.gameId, placements: ids });
  const ranksOk = ids.every((id, i) => i === 0 || scored.ranks[ids[i - 1]] <= scored.ranks[id]);
  check('resultado traz a ordem correta (ranks) e não o power', scored.score === 1000 && ranksOk && !JSON.stringify(scored).includes('"power":'));
}

// ---------- Pokémon: categoria própria com filtro de gerações ----------
if (section('Pokémon')) {
  const catalog = await get('/characters');
  const pokemon = catalog.filter((c) => c.category === 'pokemon');
  check('catálogo tem Pokémon com geração', pokemon.length >= 100 && pokemon.every((c) => c.generation >= 1 && c.generation <= 9));
  const gen = (ids) => ids.map((id) => catalog.find((c) => c.id === id)?.generation);
  const filtered = (await post('/games', { name: nick('Pokemon'), mode: 'pokemon', generations: [1, 3] })).data;
  check('filtro de gerações: só as escolhidas', gen(filtered.characterIds ?? []).every((g) => g === 1 || g === 3), JSON.stringify(gen(filtered.characterIds ?? [])));
  check('geração inválida é recusada', (await post('/games', { name: nick('Pokemon'), mode: 'pokemon', generations: [0] })).status === 400);
  check('filtro vazio é recusado', (await post('/games', { name: nick('Pokemon'), mode: 'pokemon', generations: [] })).status === 400);
  const ffa = (await post('/games', { name: nick('Pokemon'), mode: 'all' })).data;
  check('Free for All padrão não tem Pokémon', ffa.characters?.length === 10 && !ffa.characters.some((c) => c.category === 'pokemon'));
  const { data: room } = await post('/party', { mode: 'pokemon', pid: 'e2e-pkmn-pid-01', generations: [2] });
  const host = await player('PkmHost');
  const h = partyClient(room.code, 'e2e-pkmn-pid-01', host.name, host.token);
  await h.until((c) => c.state);
  check('sala Pokémon guarda o filtro', JSON.stringify(h.state?.generations) === '[2]', JSON.stringify(h.state?.generations));
  h.send({ type: 'start' });
  await h.until((c) => c.state?.phase === 'playing');
  check('partida da sala respeita o filtro', h.state?.characterIds.length === 10 && gen(h.state.characterIds).every((g) => g === 2));
  h.ws.close();
}

// ---------- Dificuldade: tier (fama) de cada personagem ----------
if (section('Dificuldade')) {
  const catalog = await get('/characters');
  const tierOf = (ids) => ids.map((id) => catalog.find((c) => c.id === id)?.tier);
  check('catálogo tem tier em anime e games', catalog.filter((c) => c.category !== 'pokemon').every((c) => [1, 2, 3].includes(c.tier)));
  const easy = (await post('/games', { name: nick('Dificil'), mode: 'all', difficulty: 'easy' })).data;
  check('fácil: só tier 1', easy.characterIds?.length === 10 && tierOf(easy.characterIds).every((t) => t === 1), JSON.stringify(tierOf(easy.characterIds ?? [])));
  const medium = (await post('/games', { name: nick('Dificil'), mode: 'anime', difficulty: 'medium' })).data;
  check('médio: tier 1 e 2', tierOf(medium.characterIds ?? []).every((t) => t <= 2));
  check('dificuldade inválida é recusada', (await post('/games', { name: nick('Dificil'), mode: 'anime', difficulty: 'insane' })).status === 400);
  const pkmn = await post('/games', { name: nick('Dificil'), mode: 'pokemon', difficulty: 'insane' });
  check('Pokémon ignora a dificuldade', pkmn.status === 200);
  const { data: room } = await post('/party', { mode: 'games', pid: 'e2e-diff-pid-01', difficulty: 'easy' });
  const host = await player('DiffHost');
  const h = partyClient(room.code, 'e2e-diff-pid-01', host.name, host.token);
  await h.until((c) => c.state);
  check('sala guarda a dificuldade', h.state?.difficulty === 'easy', String(h.state?.difficulty));
  h.send({ type: 'start' });
  await h.until((c) => c.state?.phase === 'playing');
  check('partida da sala respeita a dificuldade', h.state?.characterIds.length === 10 && tierOf(h.state.characterIds).every((t) => t === 1), JSON.stringify([h.state?.phase, tierOf(h.state?.characterIds ?? [])]));
  h.ws.close();
}

// ---------- Filmes e Séries; categorias do Free for All ----------
if (section('Filmes e Free for All')) {
  const catalog = await get('/characters');
  const categoryOf = (ids) => ids.map((id) => catalog.find((c) => c.id === id)?.category);
  check('catálogo tem Filmes e Séries com tier, sem power', catalog.filter((c) => c.category === 'movies').length >= 50 && catalog.filter((c) => c.category === 'movies').every((c) => [1, 2, 3].includes(c.tier) && !('power' in c)));
  const movies = (await post('/games', { name: nick('Filmes'), mode: 'movies' })).data;
  check('partida de Filmes e Séries', movies.characterIds?.length === 10 && categoryOf(movies.characterIds).every((c) => c === 'movies'));
  const result = await post('/scores', { gameId: movies.gameId, placements: perfectOrder(movies.characterIds) });
  check('pontuação de Filmes e Séries', result.status === 200 || result.data?.error === 'Partida rápida demais para valer.', JSON.stringify(result.data));

  const ffa = (await post('/games', { name: nick('Filmes'), mode: 'all' })).data;
  check('Free for All padrão: sem Pokémon', !categoryOf(ffa.characterIds ?? []).includes('pokemon'));
  const chosen = (await post('/games', { name: nick('Filmes'), mode: 'all', categories: ['movies', 'pokemon'] })).data;
  const cats = categoryOf(chosen.characterIds ?? []);
  check('Free for All com as categorias escolhidas', cats.length === 10 && cats.every((c) => c === 'movies' || c === 'pokemon'), JSON.stringify(cats));
  check('mistura equilibrada (não só Pokémon)', cats.includes('movies'), JSON.stringify(cats));
  check('categorias vazias: 400', (await post('/games', { name: nick('Filmes'), mode: 'all', categories: [] })).status === 400);
  check('categoria desconhecida: 400', (await post('/games', { name: nick('Filmes'), mode: 'all', categories: ['all'] })).status === 400);
  check('categorias fora do Free for All são ignoradas', (await post('/games', { name: nick('Filmes'), mode: 'anime', categories: 'x' })).status === 200);

  const { data: room } = await post('/party', { mode: 'all', pid: 'e2e-ffa-pid-0001', categories: ['games', 'movies'] });
  const host = await player('FfaHost');
  const h = partyClient(room.code, 'e2e-ffa-pid-0001', host.name, host.token);
  await h.until((c) => c.state);
  check('sala guarda as categorias', JSON.stringify(h.state?.categories) === '["games","movies"]', JSON.stringify(h.state?.categories));
  h.send({ type: 'settings', mode: 'all', categories: ['anime'] });
  await h.until((c) => JSON.stringify(c.state?.categories) === '["anime"]');
  h.send({ type: 'start' });
  await h.until((c) => c.state?.phase === 'playing');
  check('partida da sala usa as categorias novas', categoryOf(h.state?.characterIds ?? []).every((c) => c === 'anime'));
  h.ws.close();
}

// ---------- Segurança ----------
if (section('Segurança')) {
  const noBot = await post('/players', { name: nick('SemTurnstile'), password: PASSWORD });
  check('conta nova sem anti-bot é recusada (403)', noBot.status === 403 && noBot.data.code === 'turnstile');
  const rude = await post('/players', { name: 'E2eFuck', password: PASSWORD, turnstile: TURNSTILE_TEST_TOKEN });
  check('nick ofensivo é recusado', rude.status === 400);
  check('nick ofensivo disfarçado (c4r4lh0) é recusado', (await post('/players', { name: 'E2eC4r4lh0', password: PASSWORD, turnstile: TURNSTILE_TEST_TOKEN })).status === 400);
  check('palavra comum com trecho parecido passa (Computador)', !(await get('/players/status?name=E2eComputador')).problem);
  const original = await player('Original');
  const fake = await post('/players', { name: 'E2eOrlglnal', password: PASSWORD, turnstile: TURNSTILE_TEST_TOKEN });
  check('nick que imita outra conta é recusado (i → l)', fake.status === 409 && fake.data.code === 'nick_lookalike', JSON.stringify(fake.data));
  check('status avisa o problema do nick', Boolean((await get('/players/status?name=E2eOrlglnal')).problem));
  check('convidado com nick ofensivo não joga', (await post('/games', { name: 'E2eBitch', mode: 'anime' })).status === 400);
  check('convidado não imita conta', (await post('/games', { name: 'E2eOrlglnal', mode: 'anime' })).status === 401);
  check('renomear para nick ofensivo é recusado', (await post('/players/rename', { token: original.token, name: 'E2ePorra' })).status === 400);

  const fast = await post('/games', { ...original, mode: 'anime' });
  const tooFast = await post('/scores', { gameId: fast.data.gameId, placements: perfectOrder(fast.data.characterIds) });
  check('partida rápida demais é recusada', tooFast.status === 400 && tooFast.data.code === 'too_fast');

  // Limite por IP: no dev só vale com o cabeçalho de teste.
  const statuses = [];
  for (let i = 0; i < 25; i++) {
    const res = await fetch(`${BASE}/api/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rate-limit-test': '1' },
      body: JSON.stringify({ name: '' }),
    });
    statuses.push(res.status);
  }
  check('muitas tentativas seguidas → 429', statuses.includes(429), statuses.join(','));
}

// ---------- Conta e convidado ----------
if (section('Conta e convidado')) {
  const guest = nick('Convidado');
  check('nick livre: não existe', (await get(`/players/status?name=${guest}`)).exists === false);
  const guestResult = await playSolo({ name: guest }, 'perfect');
  check('convidado joga sem moedas e sem posição', guestResult.score === 1000 && guestResult.coins === null && guestResult.coinsEarned === 0 && guestResult.rank === null);
  const { scores: board } = await get('/scores?mode=anime');
  check('convidado não aparece no ranking', !board.some((s) => s.name === guest));
  check('convidado não reserva o nick', (await get(`/players/status?name=${guest}`)).exists === false);
  check('conta sem senha é recusada', (await post('/players', { name: guest })).status === 400);

  const name = nick('Dono');
  const { status, data: a } = await post('/players', { name, password: 'segredo1', turnstile: TURNSTILE_TEST_TOKEN });
  check('nick livre + senha cria a conta', status === 200 && Boolean(a.token));
  const st = await get(`/players/status?name=${name.toUpperCase()}`);
  check('status: existe e tem senha', st.exists === true && st.hasPassword === true);
  check('dono confirma com o token', (await post('/players', { name: name.toLowerCase(), token: a.token })).status === 200);
  check('convidado não joga com nick de conta', (await post('/games', { name, mode: 'anime' })).status === 401);
  const taken = await post('/players', { name: name.toUpperCase() });
  check('sem token nem senha: 409 com hasPassword', taken.status === 409 && taken.data.hasPassword === true);
  const login = await post('/players', { name: name.toUpperCase(), password: 'segredo1' });
  check('senha certa dá token novo em outro dispositivo', login.status === 200 && Boolean(login.data.token) && login.data.token !== a.token);
  check('token do outro dispositivo vale', (await post('/profile', { name, token: login.data.token })).status === 200);
  check('senha errada é recusada (403)', (await post('/players', { name, password: 'errada00' })).status === 403);
  check('conta com senha curta é recusada', (await post('/players', { name: nick('Curta'), password: '12' })).status === 400);

  const locked = await player('Bloqueio');
  for (let i = 0; i < 5; i++) await post('/players', { name: locked.name, password: 'errada00' });
  check('5 senhas erradas bloqueiam o nick (429)', (await post('/players', { name: locked.name, password: PASSWORD })).status === 429);

  // Conta antiga, criada antes da senha existir.
  const old = await player('Antiga');
  d1(`UPDATE players SET password_hash = NULL WHERE name_key = '${old.name.toLowerCase()}'`);
  const oldTaken = await post('/players', { name: old.name, password: 'qualquer1' });
  check('conta antiga sem senha: 409 com hasPassword false', oldTaken.status === 409 && oldTaken.data.hasPassword === false);
  check('senha curta é recusada', (await post('/players/password', { ...old, password: '123' })).status === 400);
  check('criar senha sem token é recusado', (await post('/players/password', { name: old.name, password: 'segredo1' })).status === 401);
  check('dono da conta antiga cria a senha', (await post('/players/password', { ...old, password: 'segredo1' })).status === 200);
  check('senha não é trocada sem a atual', (await post('/players/password', { ...old, password: 'outra123' })).status === 409);
  check('perfil diz que tem senha', (await post('/profile', old)).data.hasPassword === true);

  check('token inválido é recusado', (await post('/games', { name, token: 'token-falso', mode: 'anime' })).status === 401);

  // Registro de acesso (IP) para investigar abuso: criação, login, senha errada e partida (inclusive de convidado).
  const events = d1(`SELECT event, ip FROM access_log WHERE lower(name) IN ('${name.toLowerCase()}', '${guest.toLowerCase()}')`);
  check(
    'registro de acesso: signup, login, login_failed e score, com IP',
    ['signup', 'login', 'login_failed', 'score'].every((e) => events.includes(`"event": "${e}"`)) && /"ip": "[^"]+"/.test(events),
    [...new Set(events.match(/"event": "\w+"/g))].join(', '),
  );
}

// ---------- Trocar nick ----------
if (section('Trocar nick')) {
  const acc = await player('Renome');
  await playDaily(acc, 'perfect');
  const other = await player('Ocupado');
  const newName = nick('Renomeado');
  check('não troca para nick de outra conta (409)', (await post('/players/rename', { token: acc.token, name: other.name.toUpperCase() })).status === 409);
  check('trocar nick sem token é recusado', (await post('/players/rename', { name: newName })).status === 401);
  const renamed = await post('/players/rename', { token: acc.token, name: newName });
  check('troca para nick livre', renamed.status === 200 && renamed.data.name === newName);
  check('nick antigo fica livre', (await get(`/players/status?name=${acc.name}`)).exists === false);
  const { data: prof } = await post('/profile', { token: acc.token });
  check('mesma conta: perfil com o nick novo e as moedas', prof.name === newName && prof.coins === 60, `${prof.name} ${prof.coins}`);
  const { scores } = await get('/scores?mode=anime');
  check('ranking mostra o nick novo', scores.some((s) => s.name === newName) && !scores.some((s) => s.name === acc.name));
  const { scores: renamedTotal } = await get('/scores?mode=anime&period=total');
  check('Acumulado segue a conta depois de trocar o nick', renamedTotal.find((s) => s.name === newName)?.score === 1000);
  const guestOld = await playSolo({ name: acc.name }, 'reversed');
  check('convidado pode usar o nick antigo', typeof guestOld.score === 'number' && guestOld.coins === null);
  check('mudar só maiúsculas vale', (await post('/players/rename', { token: acc.token, name: newName.toUpperCase() })).status === 200);
  check('entra com o nick novo + senha', (await post('/players', { name: newName, password: PASSWORD })).status === 200);
}

// ---------- Economia e loja ----------
if (section('Economia e loja')) {
  const me = await player('Loja');
  const bad = await playSolo(me, 'reversed');
  check('abaixo de 400 não paga', bad.coinsEarned === 0, `${bad.score} pts`);
  const good = await playDaily(me, 'perfect');
  check('partida perfeita paga 60', good.coinsEarned === 60 && good.coins === 60);

  const noMoney = await post('/shop/buy', { ...me, itemId: 'frame-neon' });
  check('sem saldo: 402 e sem item', noMoney.status === 402);
  const [b1, b2] = await Promise.all([
    post('/shop/buy', { ...me, itemId: 'name-cyan' }),
    post('/shop/buy', { ...me, itemId: 'name-cyan' }),
  ]);
  const { data: profile } = await post('/profile', me);
  check('clique duplo cobra uma vez', [b1.status, b2.status].sort().join() === '200,409' && profile.coins === 0);
  check('não equipa o que não tem', (await post('/profile/equip', { ...me, slot: 'frame', itemId: 'frame-legend' })).status === 403);
  check('não equipa no espaço errado', (await post('/profile/equip', { ...me, slot: 'frame', itemId: 'name-cyan' })).status === 400);
  await post('/profile/equip', { ...me, slot: 'nameColor', itemId: 'name-cyan' });
  await playSolo(me, 'perfect');
  const avatar = await post('/shop/buy', { ...me, itemId: 'avatar:goku' });
  check('compra avatar (50)', avatar.status === 200 && avatar.data.coins === 10);
  await post('/profile/equip', { ...me, slot: 'avatar', itemId: 'avatar:goku' });
  check('avatar inexistente é recusado', (await post('/shop/buy', { ...me, itemId: 'avatar:nao-existe' })).status === 400);
  await playSolo(me, 'perfect');
  const title = await post('/shop/buy', { ...me, itemId: 'title-iniciante-prospero' });
  check('compra título (50)', title.status === 200 && title.data.coins === 20);
  check('título não vai no espaço da moldura', (await post('/profile/equip', { ...me, slot: 'frame', itemId: 'title-iniciante-prospero' })).status === 400);
  const equipped = await post('/profile/equip', { ...me, slot: 'title', itemId: 'title-iniciante-prospero' });
  check('equipa título', equipped.data.look?.title === 'title-iniciante-prospero');
  const { scores } = await get('/scores?mode=anime');
  const row = scores.find((s) => s.name === me.name);
  check(
    'ranking traz o visual (com título)',
    row?.look.avatar === 'goku' && row.look.nameColor === 'name-cyan' && row.look.title === 'title-iniciante-prospero',
  );
}

// ---------- Ranking: Hoje e Acumulado ----------
if (section('Conquistas e emblemas')) {
  const me = await player('Conquista');
  const where = `player_id = (SELECT id FROM players WHERE name = '${me.name}')`;
  // Dia do desafio (meia-noite de Brasília) de `daysAgo` dias atrás.
  const day = (daysAgo) => new Date(Date.now() - 3 * 3600_000 - daysAgo * 86400_000).toISOString().slice(0, 10);

  const empty = await post('/achievements', me);
  check('conta nova: nada desbloqueado', empty.status === 200 && !Object.keys(empty.data.unlocked).length && empty.data.stats.games === 0);
  check('conquistas pedem conta', (await post('/achievements', { token: 'token-falso' })).status === 401);
  const weak = await playSolo(me, 'reversed');
  check('primeira partida desbloqueia "Primeira Partida"', weak.achievements?.join() === 'first-game', weak.achievements?.join());
  const { data: afterFirst } = await post('/profile', me);
  check(
    'prêmio vai para os itens; sem aviso pendente (já apareceu no resultado)',
    afterFirst.owned.includes('title-recruta') && afterFirst.newAchievements.length === 0,
  );
  const perfect = await playDaily(me, 'perfect');
  check(
    '1000 pontos: 700+, 850+ e Perfeito de uma vez',
    ['score-700', 'score-850', 'perfect'].every((id) => perfect.achievements.includes(id)) && !perfect.achievements.includes('first-game'),
    perfect.achievements.join(),
  );
  check('conquista não dá moedas', perfect.coinsEarned === 60);
  check('não desbloqueia duas vezes', (await playSolo(me, 'perfect')).achievements.length === 0);
  const { data: state } = await post('/achievements', me);
  check(
    'contadores: partidas, melhor, sequência e categorias',
    state.stats.games === 3 && state.stats.bestScore === 1000 && state.stats.dailyStreak === 1 && state.stats.modes700 === 1,
    JSON.stringify(state.stats),
  );
  check('lista as desbloqueadas com a data', Object.keys(state.unlocked).length === 4 && state.unlocked.perfect > 0);

  // Sequência: finge que jogou ontem e anteontem; o desafio de hoje (outra categoria) fecha 3 dias.
  d1(`UPDATE player_stats SET daily_streak = 2, daily_last = '${day(1)}' WHERE ${where}`);
  const streak = await playDaily(me, 'perfect', 'games');
  check('3 dias seguidos de desafio: "Constante"', streak.achievements.includes('daily-3'), streak.achievements.join());
  check('mesmo dia em outra categoria não soma de novo', (await post('/achievements', me)).data.stats.dailyStreak === 3);
  d1(`UPDATE player_stats SET daily_last = '${day(2)}' WHERE ${where}`);
  check('dia sem desafio quebra a sequência', (await post('/achievements', me)).data.stats.dailyStreak === 0);
  d1(`UPDATE player_stats SET daily_last = '${day(1)}' WHERE ${where}`);

  // Emblemas: espaço novo na loja; prêmios de conquista não estão à venda.
  const star = await post('/shop/buy', { ...me, itemId: 'badge-star' });
  check('compra emblema', star.status === 200 && star.data.owned.includes('badge-star'));
  check('prêmio de conquista não está à venda', (await post('/shop/buy', { ...me, itemId: 'badge-veteran' })).status === 400);
  check('emblema não vai no espaço do título', (await post('/profile/equip', { ...me, slot: 'title', itemId: 'badge-star' })).status === 400);
  const equipped = await post('/profile/equip', { ...me, slot: 'badge', itemId: 'badge-perfect' });
  check('equipa emblema ganho na conquista', equipped.data.look?.badge === 'badge-perfect');
  const { scores } = await get('/scores?mode=anime');
  check('ranking traz o emblema', scores.find((r) => r.name === me.name)?.look.badge === 'badge-perfect');
}

if (section('Ranking')) {
  const slow = await player('Lento');
  const fast = await player('Rapido');
  const first = await playDaily(slow, 'perfect');
  check('envio traz o tempo da partida', typeof first.durationMs === 'number' && first.durationMs >= 0);
  await playDaily(fast, 'perfect');
  // Tempos controlados: os dois fizeram 1000, o "Rapido" em menos tempo.
  d1(`UPDATE scores SET duration_ms = 90000 WHERE player_id = (SELECT id FROM players WHERE name_key = '${slow.name.toLowerCase()}')`);
  d1(`UPDATE scores SET duration_ms = 30000 WHERE player_id = (SELECT id FROM players WHERE name_key = '${fast.name.toLowerCase()}')`);
  const { scores: daily } = await get('/scores?mode=anime');
  const pos = (list, p) => list.findIndex((s) => s.name === p.name);
  check('padrão é o desafio: empate em 1000, menor tempo na frente', pos(daily, fast) >= 0 && pos(daily, fast) < pos(daily, slow));
  check('Desafio mostra o tempo', daily[pos(daily, fast)]?.durationMs === 30000);

  // Partida solo não conta; desafio de ontem soma no Acumulado.
  await playSolo(slow, 'perfect');
  const soloOnly = await player('SoSolo');
  await playSolo(soloOnly, 'perfect');
  const yesterday = Date.now() - 26 * 60 * 60 * 1000;
  const yesterdayKey = new Date(yesterday - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const slowId = `(SELECT id FROM players WHERE name_key = '${slow.name.toLowerCase()}')`;
  d1(
    `INSERT INTO games (id, character_ids, created_at, submitted, name, player_id, mode, daily) VALUES ('e2e-ontem', '[]', ${yesterday}, 1, '${slow.name}', ${slowId}, 'anime', '${yesterdayKey}');` +
      `INSERT INTO scores (game_id, name, name_key, player_id, mode, score, placements, coins, daily, created_at) VALUES ('e2e-ontem', '${slow.name}', '${slow.name.toLowerCase()}', ${slowId}, 'anime', 700, '[]', 0, '${yesterdayKey}', ${yesterday});`,
  );
  const { scores: total } = await get('/scores?mode=anime&period=total');
  const slowTotal = total.find((s) => s.name === slow.name);
  check('Acumulado soma só os desafios (1000 hoje + 700 ontem)', slowTotal?.score === 1700 && slowTotal.days === 2, JSON.stringify(slowTotal));
  check('Acumulado ignora partida solo', total.find((s) => s.name === fast.name)?.score === 1000);
  const { scores: dailyAgain } = await get('/scores?mode=anime');
  check('só solo: fora do ranking', !dailyAgain.some((s) => s.name === soloOnly.name) && !total.some((s) => s.name === soloOnly.name));
  check('Desafio ignora o de ontem', dailyAgain.find((s) => s.name === slow.name)?.score === 1000);
  check('período "today" não existe mais', (await fetch(`${BASE}/api/scores?mode=anime&period=today`)).status === 400);
}

// ---------- Desafio Diário ----------
if (section('Desafio Diário')) {
  const acc = await player('Diario');
  const other = await player('Diario2');
  const guest = { name: nick('DiarioConv') };
  const status = async (p, mode = 'anime') => (await post('/daily', { ...p, mode })).data;
  const before = await status(acc);
  check('status: ainda não jogou', before.done === false && before.score === null);

  const solo = (await post('/games', { ...acc, mode: 'anime' })).data;
  check('partida solo não é o desafio', solo.daily === false);
  const { status: code, data: game } = await post('/games', { ...acc, mode: 'anime', daily: true });
  check('começa o desafio', code === 200 && game.daily === true && game.characterIds.length === 10);
  const again = await post('/games', { ...acc, mode: 'anime', daily: true });
  check('segunda tentativa é recusada (409)', again.status === 409 && again.data.code === 'daily_done');
  const started = await status(acc);
  check('começou e não terminou: já conta como feito', started.done === true && started.score === null);
  const otherGame = (await post('/games', { ...other, mode: 'anime', daily: true })).data;
  const guestGame = (await post('/games', { ...guest, mode: 'anime', daily: true })).data;
  const same = (g) => JSON.stringify(g?.characterIds) === JSON.stringify(game.characterIds);
  check('mesmos 10, na mesma ordem, para todo mundo (inclusive convidado)', same(otherGame) && same(guestGame));
  check('convidado também tem uma tentativa só', (await post('/games', { ...guest, mode: 'anime', daily: true })).status === 409);
  check('outra categoria: desafio ainda livre', (await status(acc, 'games')).done === false);
  const gamesGame = (await post('/games', { ...acc, mode: 'games', daily: true })).data;
  check('cada categoria tem o seu desafio', gamesGame.daily === true && !same(gamesGame));

  await sleep(MIN_GAME_MS + 100);
  const ids = perfectOrder(game.characterIds);
  const done = (await post('/scores', { gameId: game.gameId, placements: ids })).data;
  check('resultado do desafio: pontua e rende moedas', done.daily === true && done.score === 1000 && done.coinsEarned > 0);
  const guestDone = (await post('/scores', { gameId: guestGame.gameId, placements: ids })).data;
  check('convidado joga sem posição nem moedas', guestDone.daily === true && guestDone.rank === null && guestDone.coins === null);
  await post('/scores', { gameId: otherGame.gameId, placements: [...ids].reverse() });
  await post('/scores', { gameId: gamesGame.gameId, placements: perfectOrder(gamesGame.characterIds) });
  check('status depois: feito, com a pontuação', (await status(acc)).score === 1000);

  const { scores: board } = await get('/scores?mode=anime&period=daily');
  const pos = (p) => board.findIndex((s) => s.name === p.name);
  check('ranking do desafio: contas em ordem, com tempo', pos(acc) >= 0 && pos(acc) < pos(other) && typeof board[pos(acc)].durationMs === 'number');
  check('posição no resultado = posição no ranking do desafio', done.rank === pos(acc) + 1);
  check('convidado fora do ranking do desafio', pos(guest) === -1);
  const { scores: gamesBoard } = await get('/scores?mode=games&period=daily');
  check('ranking do desafio é por categoria', gamesBoard.some((s) => s.name === acc.name) && !gamesBoard.some((s) => s.name === other.name));
  const { scores: total } = await get('/scores?mode=anime&period=total');
  check('desafio soma no Acumulado da categoria', total.find((s) => s.name === acc.name)?.score === 1000);
}

// ---------- Caça-níquel ----------
if (section('Slots')) {
  const me = await player('Slots');
  check('convidado não joga (401)', (await post('/slots/spin', { bet: 1 })).status === 401);
  const underage = await post('/slots/spin', { ...me, bet: 1 });
  check('sem declarar 18+: 403', underage.status === 403 && underage.data.code === 'adult_required');
  check('perfil começa sem 18+', (await post('/profile', me)).data.adult === false);
  const adult = await post('/profile/adult', me);
  check('declara 18+ e o perfil mostra', adult.status === 200 && adult.data.adult === true);
  check('declarar 18+ pede a conta (401)', (await post('/profile/adult', {})).status === 401);
  check('aposta fora da regra é recusada', (await post('/slots/spin', { ...me, bet: 11 })).status === 400);
  check('sem saldo: 402', (await post('/slots/spin', { ...me, bet: 1 })).status === 402);

  d1(`UPDATE players SET coins = 2000 WHERE name_key = '${me.name.toLowerCase()}'`);
  const potCents = () => Number(/"amount_cents": (\d+)/.exec(d1('SELECT amount_cents FROM casino_pot'))?.[1]);
  const potBefore = potCents();
  const PAIR = { ss: 5, s: 3, a: 2, b: 1, c: 1, d: 0 };
  const THREE = { s: 60, a: 30, b: 18, c: 10, d: 5 };
  let expectedCoins = 2000;
  let prizesOk = true;
  let jackpots = 0;
  for (let i = 0; i < 25; i++) {
    const bet = i % 2 ? 1 : 10;
    const { status, data } = await post('/slots/spin', { ...me, bet });
    if (status !== 200) {
      prizesOk = false;
      break;
    }
    const [a, b, c] = data.reels;
    const pair = a === b || a === c ? a : b === c ? b : null;
    const expected = a === b && b === c ? (a === 'ss' ? null : THREE[a] * bet) : pair ? PAIR[pair] * bet : 0;
    if (expected === null) jackpots++;
    else if (data.prize !== expected) prizesOk = false;
    expectedCoins += data.prize - bet;
    if (data.coins !== expectedCoins) prizesOk = false;
  }
  check('prêmio segue a tabela e o saldo fecha giro a giro', prizesOk, `saldo esperado ${expectedCoins}`);
  const potAfter = potCents();
  // Em centésimos: 13 giros de 10 (+50 cada) e 12 de 1 (+5 cada) = +710, se não saiu jackpot. O pote é
  // compartilhado: se alguém jogar ao mesmo tempo (ex: no dev local), ele cresce mais.
  check('pote recebe 5% de cada aposta (em centésimos)', jackpots > 0 || potAfter - potBefore >= 710, `${potBefore} → ${potAfter}`);
  const logged = d1(`SELECT COUNT(*) AS n FROM casino_spins WHERE player_id = (SELECT id FROM players WHERE name_key = '${me.name.toLowerCase()}')`);
  check('todo giro fica registrado', /"n": 25/.test(logged));
}

// ---------- Plinko ----------
if (section('Plinko')) {
  const me = await player('Plinko');
  check('convidado não joga (401)', (await post('/plinko/drop', { bet: 1, risk: 'low' })).status === 401);
  const underage = await post('/plinko/drop', { ...me, bet: 1, risk: 'low' });
  check('sem declarar 18+: 403', underage.status === 403 && underage.data.code === 'adult_required');
  await post('/profile/adult', me);
  check('aposta fora da regra é recusada', (await post('/plinko/drop', { ...me, bet: 11, risk: 'low' })).status === 400);
  check('risco inexistente é recusado', (await post('/plinko/drop', { ...me, bet: 1, risk: 'extreme' })).status === 400);
  check('sem saldo: 402', (await post('/plinko/drop', { ...me, bet: 1, risk: 'low' })).status === 402);

  d1(`UPDATE players SET coins = 1000 WHERE name_key = '${me.name.toLowerCase()}'`);
  // Tabela (em décimos, da ponta ao meio) igual à de src/game/plinko.ts.
  const HALF = { low: [80, 30, 16, 14, 11, 9, 5], medium: [260, 90, 36, 20, 12, 5, 3], high: [1300, 220, 70, 22, 7, 2, 2] };
  const risks = Object.keys(HALF);
  let expectedCoins = 1000;
  let ok = true;
  let detail = '';
  for (let i = 0; i < 24; i++) {
    const bet = i % 2 ? 1 : 10;
    const risk = risks[i % 3];
    const { status, data } = await post('/plinko/drop', { ...me, bet, risk });
    const multiplier = HALF[risk][6 - Math.abs(data?.slot - 6)];
    const whole = Math.floor((bet * multiplier) / 10);
    const valid =
      status === 200 &&
      data.path.length === 12 &&
      data.path.every((s) => s === 0 || s === 1) &&
      data.path.reduce((a, b) => a + b, 0) === data.slot &&
      data.multiplier === multiplier &&
      (data.prize === whole || data.prize === whole + ((bet * multiplier) % 10 ? 1 : 0));
    expectedCoins += (data?.prize ?? 0) - bet;
    if (!valid || data.coins !== expectedCoins) {
      ok = false;
      detail = JSON.stringify({ status, risk, bet, data, expectedCoins });
      break;
    }
  }
  check('caminho, casa e prêmio seguem a tabela; o saldo fecha bolinha a bolinha', ok, detail);
  const logged = d1(`SELECT COUNT(*) AS n FROM plinko_drops WHERE player_id = (SELECT id FROM players WHERE name_key = '${me.name.toLowerCase()}')`);
  check('toda bolinha fica registrada', /"n": 24/.test(logged));
}

// ---------- Raspadinha ----------
if (section('Raspadinha')) {
  const me = await player('Raspa');
  check('convidado não joga (401)', (await post('/scratch/buy', { bet: 1 })).status === 401);
  const underage = await post('/scratch/buy', { ...me, bet: 1 });
  check('sem declarar 18+: 403', underage.status === 403 && underage.data.code === 'adult_required');
  await post('/profile/adult', me);
  check('aposta fora da regra é recusada', (await post('/scratch/buy', { ...me, bet: 11 })).status === 400);
  check('sem saldo: 402', (await post('/scratch/buy', { ...me, bet: 1 })).status === 402);

  d1(`UPDATE players SET coins = 1000 WHERE name_key = '${me.name.toLowerCase()}'`);
  // Tabela igual à de src/game/scratch.ts.
  const PRIZE = { ss: 100, s: 25, a: 10, b: 3, c: 2, d: 1 };
  let expectedCoins = 1000;
  let ok = true;
  let detail = '';
  for (let i = 0; i < 20; i++) {
    const bet = i % 2 ? 1 : 10;
    const { status, data } = await post('/scratch/buy', { ...me, bet });
    const counts = {};
    for (const c of data?.cells ?? []) counts[c] = (counts[c] ?? 0) + 1;
    const trios = Object.keys(counts).filter((c) => counts[c] >= 3);
    const multiplier = data?.symbol ? PRIZE[data.symbol] : 0;
    const valid =
      status === 200 &&
      data.cells.length === 9 &&
      data.cells.every((c) => c in PRIZE) &&
      Object.values(counts).every((n) => n <= 3) &&
      (data.symbol === null ? trios.length === 0 : trios.length === 1 && trios[0] === data.symbol) &&
      data.multiplier === multiplier &&
      data.prize === bet * multiplier;
    expectedCoins += (data?.prize ?? 0) - bet;
    if (!valid || data.coins !== expectedCoins) {
      ok = false;
      detail = JSON.stringify({ status, bet, data, expectedCoins });
      break;
    }
  }
  check('cartela coerente com o trio, prêmio da tabela e saldo fechando cartela a cartela', ok, detail);
  const logged = d1(`SELECT COUNT(*) AS n FROM scratch_cards WHERE player_id = (SELECT id FROM players WHERE name_key = '${me.name.toLowerCase()}')`);
  check('toda cartela fica registrada', /"n": 20/.test(logged));
}

// ---------- Chaves dos minigames (tabela features) ----------
if (section('Chaves')) {
  const me = await player('Chaves');
  await post('/profile/adult', me);
  d1(`UPDATE players SET coins = 500 WHERE name_key = '${me.name.toLowerCase()}'`);
  const on = (await get('/config')).features;
  check('config traz as chaves (ligadas por padrão)', on?.slots === true && on?.plinko === true && on?.scratch === true && on?.mystery_box === true, JSON.stringify(on));
  const setFlag = (id, enabled) => d1(`UPDATE features SET enabled = ${enabled} WHERE id = '${id}'`);
  try {
    setFlag('slots', 0);
    const off = (await get('/config')).features;
    check('config mostra o caça-níquel desligado', off.slots === false && off.mystery_box === true);
    const spun = await post('/slots/spin', { ...me, bet: 1 });
    check('caça-níquel desligado: 403', spun.status === 403 && spun.data.code === 'feature_disabled');
    check('pote do caça-níquel desligado: 403', (await get('/slots')).code === 'feature_disabled');
    check('a outra chave segue valendo', (await post('/gacha/open', me)).status === 200);
    setFlag('mystery_box', 0);
    const box = await post('/gacha/open', me);
    check('Mystery Box desligada: 403', box.status === 403 && box.data.code === 'feature_disabled');
    setFlag('plinko', 0);
    const dropped = await post('/plinko/drop', { ...me, bet: 1, risk: 'low' });
    check('Plinko desligado: 403', dropped.status === 403 && dropped.data.code === 'feature_disabled');
    setFlag('scratch', 0);
    const card = await post('/scratch/buy', { ...me, bet: 1 });
    check('Raspadinha desligada: 403', card.status === 403 && card.data.code === 'feature_disabled');
    const coins = (await post('/profile', me)).data.coins;
    check('desligado não cobra moedas', coins === 400, String(coins));
  } finally {
    setFlag('slots', 1);
    setFlag('mystery_box', 1);
    setFlag('plinko', 1);
    setFlag('scratch', 1);
  }
  check('religado: caça-níquel volta', (await post('/slots/spin', { ...me, bet: 1 })).status === 200);
}

// ---------- Admin (/api/admin/*; no dev local libera sem o Cloudflare Access) ----------
if (section('Admin')) {
  const me = await player('Admin');
  const other = await player('AdminOutro');
  const id = Number(/"id": (\d+)/.exec(d1(`SELECT id FROM players WHERE name_key = '${me.name.toLowerCase()}'`))?.[1]);
  const lastAction = Number(/"n": (\d+)/.exec(d1('SELECT COALESCE(MAX(id), 0) AS n FROM admin_actions'))?.[1]);
  check('dev local entra como admin', (await get('/admin/me')).email === 'local');
  const form = await fetch(`${BASE}/api/admin/features`, { method: 'POST', body: JSON.stringify({ id: 'slots', enabled: false }) });
  check('POST sem JSON é recusado (CSRF)', form.status === 400);

  try {
    const off = await post('/admin/features', { id: 'slots', enabled: false });
    check('desliga uma chave', off.status === 200 && off.data.find((f) => f.id === 'slots')?.enabled === false);
    check('o jogo vê a chave desligada', (await get('/config')).features.slots === false);
    check('chave inexistente: 400', (await post('/admin/features', { id: 'nada', enabled: true })).status === 400);
  } finally {
    await post('/admin/features', { id: 'slots', enabled: true });
  }
  check('religa a chave', (await get('/config')).features.slots === true);

  const found = await get(`/admin/players?q=${encodeURIComponent(me.name.slice(0, -2).toLowerCase())}`);
  check('busca acha a conta por parte do nick', found.some((p) => p.id === id));
  check('busca trata % como texto', (await get('/admin/players?q=%25')).length === 0);

  const plus = await post(`/admin/players/${id}/coins`, { delta: 150, reason: 'e2e' });
  check('dá moedas', plus.status === 200 && plus.data.coins === 150);
  check('motivo é obrigatório', (await post(`/admin/players/${id}/coins`, { delta: 10, reason: ' ' })).status === 400);
  check('quantidade fora do limite: 400', (await post(`/admin/players/${id}/coins`, { delta: 1e9, reason: 'x' })).status === 400);
  check('saldo não fica negativo (409)', (await post(`/admin/players/${id}/coins`, { delta: -151, reason: 'e2e' })).status === 409);
  const minus = await post(`/admin/players/${id}/coins`, { delta: -50, reason: 'e2e' });
  check('tira moedas', minus.data.coins === 100);
  const coinLog = minus.data.actions.filter((a) => a.action === 'coins');
  check('só as mudanças que valeram ficam no registro', coinLog.length === 2 && coinLog[0].details.coins === 100, JSON.stringify(coinLog));
  check('economia soma as moedas dadas', (await get('/admin/economy')).granted.total >= 100);

  const newName = nick('AdminNovo');
  const renamed = await post(`/admin/players/${id}/rename`, { name: newName });
  check('renomeia a conta', renamed.status === 200 && renamed.data.name === newName);
  check('nick de outra conta: 409', (await post(`/admin/players/${id}/rename`, { name: other.name })).status === 409);

  const reset = await post(`/admin/players/${id}/password`, {});
  check('gera senha temporária', reset.status === 200 && reset.data.password.length === 10 && reset.data.player.devices === 0);
  check('aparelhos antigos saem da conta', (await post('/profile', { token: me.token })).status === 401);
  const login = await post('/players', { name: newName, password: reset.data.password });
  check('entra com a senha temporária', login.status === 200 && Boolean(login.data.token));
  check('jogador inexistente: 404', (await post('/admin/players/999999999/rename', { name: nick('X') })).status === 404);

  const log = await get('/admin/actions');
  check('registro geral mostra as ações', log.some((a) => a.action === 'password' && a.playerId === id) && log.some((a) => a.action === 'feature'));
  // As chaves não apontam para jogador: apaga o que este teste gravou (o resto sai no cleanTestData).
  d1(`DELETE FROM admin_actions WHERE action = 'feature' AND id > ${lastAction}`);
}

// ---------- Mystery Box ----------
if (section('Mystery Box')) {
  const me = await player('Gacha');
  check('convidado não abre caixa (401)', (await post('/gacha/open', {})).status === 401);
  check('sem declarar 18+: 403', (await post('/gacha/open', me)).status === 403);
  await post('/profile/adult', me);
  check('sem saldo: 402', (await post('/gacha/open', me)).status === 402);
  check('exclusivo não está à venda', (await post('/shop/buy', { ...me, itemId: 'name-aurora' })).status === 400);

  d1(`UPDATE players SET coins = 1000 WHERE name_key = '${me.name.toLowerCase()}'`);
  let coins = 1000;
  let ok = true;
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const { status, data } = await post('/gacha/open', me);
    if (status !== 200) {
      ok = false;
      break;
    }
    const wasOwned = seen.has(data.itemId);
    seen.add(data.itemId);
    coins += data.refund - 100;
    const refundOk = data.duplicate === wasOwned && (data.duplicate ? data.refund > 0 : data.refund === 0);
    if (!refundOk || data.profile.coins !== coins || !data.profile.owned.includes(data.itemId)) ok = false;
  }
  check('caixa cobra 100, entrega o item e devolve moedas no repetido', ok, `saldo esperado ${coins}`);
  const logged = d1(`SELECT COUNT(*) AS n FROM gacha_openings WHERE player_id = (SELECT id FROM players WHERE name_key = '${me.name.toLowerCase()}')`);
  check('toda caixa fica registrada', /"n": 8/.test(logged));
}

// ---------- Party ----------
if (section('Party')) {
  const host = await player('Host');
  const guest = await player('Guest');
  const { data: created } = await post('/party', { mode: 'anime', pid: 'e2e-host-pid-01' });
  const code = created.code;
  check('cria sala com código de 6 letras', /^[A-HJ-NP-Z]{6}$/.test(code ?? ''), code);

  const h = partyClient(code, 'e2e-host-pid-01', host.name, host.token);
  await h.until((c) => c.state);
  check('dono entra e é host', h.state?.hostId === h.you);

  const intruder = partyClient(code, 'e2e-intr-pid-01', guest.name, 'token-falso');
  await intruder.until((c) => c.errors.length > 0);
  check('token errado é recusado', intruder.errors[0]?.startsWith('Nick não verificado'));

  // Duas conexões simultâneas do mesmo jogador (StrictMode, clique duplo): uma vaga só.
  const twin = await player('Twin');
  const t1 = partyClient(code, 'e2e-twin-pid-01', twin.name, twin.token);
  const t2 = partyClient(code, 'e2e-twin-pid-01', twin.name, twin.token);
  // As duas resolvidas: cada uma recebeu o estado ou foi fechada pela outra.
  await Promise.all([t1, t2].map((t) => t.until((c) => c.state || c.closed !== null)));
  await h.until((c) => c.state.players.length >= 2);
  check('conexões simultâneas não duplicam a vaga', h.state.players.length === 2, `${h.state.players.length} jogadores`);
  const partyLog = d1(`SELECT COUNT(*) AS n FROM access_log WHERE event = 'party' AND lower(name) = '${twin.name.toLowerCase()}'`);
  check('entrada na party fica no registro de acesso (uma vez)', /"n": 1\b/.test(partyLog), /"n": \d+/.exec(partyLog)?.[0]);
  t1.ws.close();
  t2.ws.close();
  await h.until((c) => c.state.players.length === 1);

  // Nick sem conta entra como convidado (e sai: quem cai no lobby sai da sala).
  const visitor = partyClient(code, 'e2e-visi-pid-01', nick('Visitante'), '');
  await h.until((c) => c.player(nick('Visitante')));
  check('nick sem conta entra como convidado', h.player(nick('Visitante'))?.guest === true);
  visitor.ws.close();
  await h.until((c) => c.state.players.length === 1);

  const g = partyClient(code, 'e2e-gues-pid-01', guest.name, guest.token);
  check('segundo jogador entra', await h.until((c) => c.state.players.length === 2));
  const dup = partyClient(code, 'e2e-dupe-pid-01', guest.name.toLowerCase(), guest.token);
  await dup.until((c) => c.errors.length > 0);
  check('nick repetido na sala é recusado', dup.errors[0] === 'Esse nick já está na sala');
  const missing = partyClient('ZZZZZZ', 'e2e-miss-pid-01', guest.name, guest.token);
  await missing.until((c) => c.errors.length > 0);
  check('sala inexistente é recusada (erro fatal)', missing.errors[0] === 'Sala não encontrada' && missing.fatal === 'Sala não encontrada');

  g.send({ type: 'start' });
  await g.untilError('Só o dono da sala pode iniciar');
  check('só o dono inicia', g.errors.includes('Só o dono da sala pode iniciar') && h.state.phase === 'lobby');

  // Categoria da sala: só o dono muda, e todos veem.
  g.send({ type: 'settings', mode: 'games', difficulty: 'easy' });
  await g.untilError('Só o dono da sala pode fazer isso');
  check('só o dono muda a categoria', h.state.mode === 'anime');
  h.send({ type: 'settings', mode: 'xyz' });
  check('categoria inválida é recusada', await h.untilError('Categoria inválida'));
  h.send({ type: 'settings', mode: 'pokemon', generations: [1], difficulty: 'easy' });
  await g.until((c) => c.state.mode === 'pokemon');
  check(
    'dono troca a categoria no lobby (todos veem)',
    JSON.stringify(g.state.generations) === '[1]' && g.state.difficulty === undefined,
    JSON.stringify([g.state.mode, g.state.generations, g.state.difficulty]),
  );
  h.send({ type: 'settings', mode: 'anime', difficulty: 'hard' });
  await g.until((c) => c.state.mode === 'anime');

  h.send({ type: 'start' });
  await g.until((c) => c.state.phase === 'playing');
  await h.until((c) => c.state.phase === 'playing');
  const ids = h.state.characterIds;
  check('mesmos 10 personagens para todos', ids.length === 10 && JSON.stringify(ids) === JSON.stringify(g.state.characterIds));

  g.send({ type: 'progress', placed: 4 });
  check('progresso aparece para os outros', await h.until((c) => c.player(guest.name)?.progress === 4));
  g.ws.close();
  check('queda aparece como desconectado', await h.until((c) => c.player(guest.name)?.connected === false));
  const g2 = partyClient(code, 'e2e-gues-pid-01', guest.name, guest.token);
  await g2.until((c) => c.you);
  await h.until((c) => c.player(guest.name)?.connected === true);
  check('reconecta na mesma vaga', g2.you === g.you && h.player(guest.name)?.connected === true);

  await sleep(MIN_GAME_MS); // o servidor não conta rodada terminada rápido demais
  h.send({ type: 'finish', placements: perfectOrder(ids) });
  await h.until((c) => c.player(host.name)?.finished);
  check('pontuação escondida até o pódio', h.state.phase === 'playing' && h.state.players.every((p) => p.score === undefined));
  check('ordem correta escondida até o pódio', h.state.ranks === undefined);
  g2.send({ type: 'finish', placements: ['x'] });
  check('posições inválidas são recusadas', await g2.untilError('Posições inválidas'));
  g2.send({ type: 'finish', placements: perfectOrder(ids).reverse() });
  await h.until((c) => c.state.phase === 'podium');
  const ph = h.player(host.name);
  const pg = h.player(guest.name);
  check('todos terminaram → pódio', h.state.phase === 'podium');
  check('pódio revela a ordem correta (ranks), sem power', Object.keys(h.state.ranks ?? {}).length === 10 && !JSON.stringify(h.state).includes('power'));
  check('1º com 1000 ganha 60 + 20 de pódio', ph.score === 1000 && ph.coinsEarned === 80);
  check('chute não ganha bônus de pódio', pg.score < 400 && pg.coinsEarned === 0, `${pg.score} pts`);
  check('primeira partida na categoria não é recorde', !ph.newRecord && !pg.newRecord);
  // Conquistas da party: o aviso fica pendente no perfil até o jogador ver (na home).
  const pending = async (auth, id) => {
    for (let i = 0; i < 20; i++) {
      const { data } = await post('/profile', auth);
      if (data.newAchievements.includes(id)) return data.newAchievements;
      await sleep(150);
    }
    return null;
  };
  check('vencedor da party ganha a conquista (aviso pendente)', Boolean(await pending(host, 'party-win')));
  const guestPending = await pending(guest, 'first-game');
  check('quem perdeu não ganha a de vitória', guestPending !== null && !guestPending.includes('party-win'), guestPending?.join());
  await post('/achievements/seen', host);
  check('visto: o aviso some', (await post('/profile', host)).data.newAchievements.length === 0);

  // Revanche: quem chutou e agora acerta bate o próprio recorde; quem já tinha 1000 não.
  h.send({ type: 'start' });
  await h.until((c) => c.state.round === 2 && c.state.phase === 'playing');
  check('revanche limpa a rodada', h.state.round === 2 && h.state.players.every((p) => !p.finished));
  const ids2 = h.state.characterIds;
  await sleep(MIN_GAME_MS);
  g2.send({ type: 'finish', placements: perfectOrder(ids2) });
  h.send({ type: 'finish', placements: perfectOrder(ids2).reverse() });
  await h.until((c) => c.state.phase === 'podium');
  check('bateu o próprio recorde → "novo recorde" no pódio', h.player(guest.name)?.newRecord === true && !h.player(host.name)?.newRecord);

  h.send({ type: 'start' });
  await h.until((c) => c.state.round === 3 && c.state.phase === 'playing');
  h.send({ type: 'end' });
  check('dono pode encerrar', await h.until((c) => c.state.phase === 'podium'));

  // Do pódio de volta ao lobby: só o dono; a rodada some (sorteio, ordem e pontuações).
  g2.send({ type: 'lobby' });
  check('só o dono volta ao lobby', await g2.untilError('Só o dono da sala pode fazer isso'));
  h.send({ type: 'lobby' });
  check(
    'dono volta todos ao lobby, sem a rodada anterior',
    (await g2.until((c) => c.state.phase === 'lobby')) &&
      g2.state.characterIds.length === 0 &&
      g2.state.ranks === undefined &&
      g2.state.players.every((p) => p.score === undefined),
  );

  // Passar a dona e expulsar.
  g2.send({ type: 'kick', id: h.you });
  check('só o dono expulsa', await g2.untilError('Só o dono da sala pode fazer isso'));
  h.send({ type: 'host', id: g2.you });
  check('dono passa a dona para outro jogador', await g2.until((c) => c.state.hostId === c.you));
  let t0 = Date.now();
  g2.send({ type: 'kick', id: h.you });
  await h.until((c) => c.fatal);
  const kickMs = Date.now() - t0;
  await g2.until((c) => c.state.players.length === 1);
  check('expulso recebe o aviso na hora (erro fatal)', h.fatal === 'Você foi removido da sala' && kickMs < 1000, `${kickMs} ms`);
  check('expulso sai da lista', g2.state.players.length === 1 && (await h.until((c) => c.closed !== null)));
  t0 = Date.now();
  const back = partyClient(code, 'e2e-host-pid-02', host.name, host.token);
  await back.until((c) => c.fatal);
  const backMs = Date.now() - t0;
  check('expulso não volta (nem por outra aba), e sabe na hora', back.fatal === 'Você foi removido da sala' && backMs < 1000, `${back.fatal} · ${backMs} ms`);
  for (const c of [g2, dup, missing, intruder, back]) c.ws.close();

  // Se o dono sai, o conectado mais antigo assume.
  const { data: room2 } = await post('/party', { mode: 'anime', pid: 'e2e-own2-pid-01' });
  const o = partyClient(room2.code, 'e2e-own2-pid-01', host.name, host.token);
  await o.until((c) => c.state);
  const o2 = partyClient(room2.code, 'e2e-gue2-pid-01', guest.name, guest.token);
  await o2.until((c) => c.state?.players.length === 2);
  o.ws.close();
  check('dono sai → outro vira dono', await o2.until((c) => c.state.hostId === c.you));
  o2.ws.close();

  const { scores } = await get('/scores?mode=anime');
  check('resultado da party não entra no ranking (só desafio)', !scores.some((s) => s.name === host.name));
}

// ---------- Excluir conta ----------
if (section('Excluir conta')) {
  const me = await player('Excluir');
  await playSolo(me);
  const key = me.name.toLowerCase();
  const wrong = await post('/players/delete', { token: me.token, password: 'senha-errada' });
  check('excluir com a senha errada é recusado', wrong.status === 403);
  check('excluir sem token é recusado', (await post('/players/delete', { token: 'x', password: PASSWORD })).status === 401);
  const ok = await post('/players/delete', { token: me.token, password: PASSWORD });
  check('excluir com a senha certa', ok.status === 200, JSON.stringify(ok.data));
  const left = d1(
    `SELECT (SELECT COUNT(*) FROM players WHERE name_key = '${key}') + (SELECT COUNT(*) FROM scores WHERE name_key = '${key}') + (SELECT COUNT(*) FROM games WHERE lower(name) = '${key}') AS n`,
  );
  check('conta, partidas e pontuações somem', /"n": 0\b/.test(left), /"n": \d+/.exec(left)?.[0]);
  check('o token da conta excluída deixa de valer', (await post('/profile', { token: me.token })).status === 401);
  check('o nick fica livre', (await get(`/players/status?name=${me.name}`)).exists === false);
}

// ---------- Conta: trocar senha e sair de todos os aparelhos ----------
if (section('Senha e aparelhos')) {
  const me = await player('Senha');
  const other = await post('/players', { name: me.name, password: PASSWORD });
  check('dois aparelhos conectados', (await post('/profile', me)).data.devices === 2);
  check('trocar senha com a atual errada: 403', (await post('/players/change-password', { token: me.token, current: 'errada00', password: 'nova-senha' })).status === 403);
  check('senha nova curta: 400', (await post('/players/change-password', { token: me.token, current: PASSWORD, password: '12' })).status === 400);
  const changed = await post('/players/change-password', { token: me.token, current: PASSWORD, password: 'nova-senha' });
  check('troca a senha com a atual', changed.status === 200, JSON.stringify(changed.data));
  check('este aparelho continua conectado', (await post('/profile', me)).data.devices === 1);
  check('o outro aparelho sai', (await post('/profile', { token: other.data.token })).status === 401);
  check('a senha antiga não entra mais', (await post('/players', { name: me.name, password: PASSWORD })).status === 403);
  const again = await post('/players', { name: me.name, password: 'nova-senha' });
  check('a senha nova entra', again.status === 200);

  const all = await post('/players/logout-all', { token: me.token });
  check('sair de todos os aparelhos', all.status === 200);
  check('nenhum token vale depois', (await post('/profile', me)).status === 401 && (await post('/profile', { token: again.data.token })).status === 401);
  check('sair de todos sem token: 401', (await post('/players/logout-all', { token: 'x' })).status === 401);
}

// ---------- Suspensão (admin) ----------
if (section('Suspensão')) {
  const me = await player('Suspensa');
  const id = Number(/"id": (\d+)/.exec(d1(`SELECT id FROM players WHERE name_key = '${me.name.toLowerCase()}'`))?.[1]);
  await playDaily(me);
  const onBoard = async () => (await get('/scores?mode=anime')).scores.some((s) => s.name === me.name);
  check('antes: aparece no ranking', await onBoard());
  check('suspender sem motivo: 400', (await post(`/admin/players/${id}/ban`, { days: 7, reason: ' ' })).status === 400);
  check('prazo fora da lista: 400', (await post(`/admin/players/${id}/ban`, { days: 3, reason: 'e2e' })).status === 400);
  const ban = await post(`/admin/players/${id}/ban`, { days: 7, reason: 'e2e' });
  check('suspende por 7 dias', ban.status === 200 && ban.data.bannedUntil > Date.now() + 6 * 864e5 && ban.data.banReason === 'e2e' && ban.data.devices === 0);
  check('o token deixa de valer', (await post('/profile', me)).status === 401);
  const login = await post('/players', { name: me.name, password: PASSWORD });
  check('login recusado com a data', login.status === 403 && login.data.code === 'banned' && /suspensa até \d{2}\/\d{2}\/\d{4}\./.test(login.data.error), login.data.error);
  check('some do ranking', !(await onBoard()));
  check('convidado não usa o nick', (await post('/games', { name: me.name, mode: 'anime' })).status === 401);

  const forever = await post(`/admin/players/${id}/ban`, { days: null, reason: 'e2e' });
  check('suspensão permanente', forever.status === 200 && (await post('/players', { name: me.name, password: PASSWORD })).data.error === 'Esta conta foi suspensa.');
  const unban = await post(`/admin/players/${id}/unban`, {});
  check('tira a suspensão', unban.status === 200 && unban.data.bannedUntil === 0);
  check('tirar de novo: 409', (await post(`/admin/players/${id}/unban`, {})).status === 409);
  check('volta a entrar', (await post('/players', { name: me.name, password: PASSWORD })).status === 200);
  check('volta ao ranking', await onBoard());
  const actions = unban.data.actions.map((a) => a.action);
  check('registro: ban, ban, unban', actions.filter((a) => a === 'ban').length === 2 && actions.includes('unban'), actions.join(','));
}

// ---------- Denúncias e moderação ----------
if (section('Denúncias')) {
  const reporter = await player('Denuncia');
  const target = await player('Denunciado');
  const id = Number(/"id": (\d+)/.exec(d1(`SELECT id FROM players WHERE name_key = '${target.name.toLowerCase()}'`))?.[1]);
  check('motivo inválido: 400', (await post('/reports', { token: reporter.token, kind: 'nick', target: target.name, reason: 'wrong' })).status === 400);
  check('tipo inválido: 400', (await post('/reports', { token: reporter.token, kind: 'x', target: target.name, reason: 'other' })).status === 400);
  check('denuncia o nick', (await post('/reports', { token: reporter.token, kind: 'nick', target: target.name, reason: 'offensive' })).status === 200);
  await post('/reports', { token: reporter.token, kind: 'nick', target: target.name.toUpperCase(), reason: 'other' });
  check('convidado também denuncia', (await post('/reports', { kind: 'nick', target: target.name, reason: 'impersonation' })).status === 200);

  const [charId] = (await post('/games', { ...reporter, mode: 'games' })).data.characterIds;
  check('personagem desconhecido: 400', (await post('/reports', { token: reporter.token, kind: 'image', target: 'nao-existe', reason: 'wrong' })).status === 400);
  check('pede remoção de imagem', (await post('/reports', { token: reporter.token, kind: 'image', target: charId, reason: 'rights' })).status === 200);

  const queue = await get('/admin/reports');
  const nickGroup = queue.find((g) => g.kind === 'nick' && g.target === target.name.toLowerCase());
  check('fila junta por nick: 2 denúncias (repetir não soma)', nickGroup?.count === 2 && nickGroup.playerId === id, JSON.stringify(nickGroup));
  check('motivos contados', nickGroup?.reasons.offensive === 1 && nickGroup?.reasons.impersonation === 1);
  const imageGroup = queue.find((g) => g.kind === 'image' && g.target === charId);
  check('imagem na fila com o personagem', imageGroup?.count >= 1 && imageGroup.character?.id === charId);

  const closed = await post('/admin/reports/close', { kind: 'nick', target: nickGroup.target, status: 'resolved' });
  check('resolve o nick', closed.status === 200 && !closed.data.some((g) => g.kind === 'nick' && g.target === nickGroup.target));
  check('fechar de novo: 409', (await post('/admin/reports/close', { kind: 'nick', target: nickGroup.target, status: 'resolved' })).status === 409);
  check('depois de fechar, pode denunciar de novo', (await post('/reports', { token: reporter.token, kind: 'nick', target: target.name, reason: 'other' })).status === 200);
  check('registro do admin', (await get(`/admin/players/${id}`)).actions.some((a) => a.action === 'report' && a.details.count === 2));
  await post('/admin/reports/close', { kind: 'image', target: charId, status: 'dismissed' });
  d1(`DELETE FROM admin_actions WHERE action = 'report' AND json_extract(details, '$.target') = '${charId}'`);
}

// ---------- Admin: personagens ----------
if (section('Admin personagens')) {
  const me = await player('Personagem');
  const id = 'abby';
  const before = await get(`/admin/characters/${id}`);
  const restore = () =>
    d1(
      `UPDATE characters SET power = ${before.power}, name = '${before.name}', active = 1, image = '${before.image}', image_version = ${before.imageVersion ? `'${before.imageVersion}'` : 'NULL'}, admin_fields = NULL WHERE id = '${id}'; ` +
        `DELETE FROM character_images WHERE character_id = '${id}'; DELETE FROM admin_actions WHERE action IN ('character', 'image') AND json_extract(details, '$.id') = '${id}';`,
    );
  try {
    check('busca acha o personagem', (await get('/admin/characters?q=Abby&category=games')).some((c) => c.id === id));
    check('busca filtra a categoria', !(await get('/admin/characters?q=Abby&category=anime')).some((c) => c.id === id));
    check('poder fora de 0–100: 400', (await post(`/admin/characters/${id}`, { power: 101 })).status === 400);
    check('fama inválida: 400', (await post(`/admin/characters/${id}`, { tier: 5 })).status === 400);
    const edited = await post(`/admin/characters/${id}`, { power: 42.5, name: before.name });
    check('edita o poder', edited.status === 200 && edited.data.power === 42.5 && edited.data.adminFields.join() === 'power', JSON.stringify(edited.data.adminFields));
    check('histórico com antes e depois', edited.data.history[0]?.details.changes.power?.join() === `${before.power},42.5`);
    check('o site continua sem o power', !('power' in ((await get('/characters')).find((c) => c.id === id) ?? { power: 1 })));

    const off = await post(`/admin/characters/${id}`, { active: false });
    check('desativa: sai do catálogo', off.data.active === false && !(await get('/characters')).some((c) => c.id === id));
    await post(`/admin/characters/${id}`, { active: true });

    check('imagem que não é WebP: 400', (await post(`/admin/characters/${id}/image`, { data: Buffer.from('oi').toString('base64') })).status === 400);
    const webp = readFileSync(join(ROOT, 'public/chars/abby.webp'));
    const up = await post(`/admin/characters/${id}/image`, { data: webp.toString('base64') });
    check('envia imagem nova', up.status === 200 && up.data.image === `api/img/${id}` && up.data.adminFields.includes('image'));
    const info = (await get('/characters')).find((c) => c.id === id);
    check('catálogo aponta para a imagem nova (versão nova)', info?.image === `api/img/${id}` && info.imageVersion !== before.imageVersion);
    const img = await fetch(`${BASE}/api/img/${id}?v=${info?.imageVersion}`);
    const bytes = Buffer.from(await img.arrayBuffer());
    check('imagem servida pelo Worker', img.status === 200 && img.headers.get('content-type') === 'image/webp' && bytes.equals(webp));
    check('imagem inexistente: 404', (await fetch(`${BASE}/api/img/nao-existe`)).status === 404);
    // A partida sorteada usa o poder novo (o admin pode corrigir sem deploy).
    check('jogo continua sorteando', (await post('/games', { ...me, mode: 'games' })).status === 200);
  } finally {
    restore();
  }
}

// ---------- Auto Battle (seção "Mais jogos") ----------
if (section('Auto Battle')) {
  const me = await player('AutoBattle');
  const rival = await player('AutoRival');
  const key = (who) => who.name.toLowerCase();
  const ab = (action, body = {}, who = me) => post(`/autobattle/${action}`, { ...who, ...body });
  // A chave nasce desligada (migração); o teste liga e, no fim, devolve como estava.
  const wasOn = /"enabled": 1/.test(d1("SELECT enabled FROM features WHERE id = 'autobattle'"));
  const setFlag = (enabled) => d1(`UPDATE features SET enabled = ${enabled} WHERE id = 'autobattle'`);
  try {
    setFlag(0);
    const off = await ab('start');
    check('chave desligada: 403', off.status === 403 && off.data.code === 'feature_disabled');
    check('config mostra a chave desligada', (await get('/config')).features.autobattle === false);
    setFlag(1);

    check('sem token: 401', (await post('/autobattle/state', { token: 'x' })).status === 401);
    check('sem run: state devolve null', (await ab('state')).data.run === null);
    check('ação sem run: 409', (await ab('reroll')).data.code === 'no_run');

    const { data: started } = await ab('start');
    const run = started.run;
    check(
      'começa na rodada 1 com 6 moedas, 5 ofertas e time vazio',
      run.round === 1 && run.gold === 6 && run.shop.length === 5 && run.team.length === 0 && run.bench.length === 0 && run.wins === 0,
      JSON.stringify(run),
    );
    check('fatores de força entre 0,85 e 1,15', Object.values(started.factors).every((f) => f >= 0.85 && f <= 1.15) && Object.keys(started.factors).length === 56);
    check('o power não vai junto', !JSON.stringify(started).includes('power'));
    check('começar de novo devolve a mesma run', JSON.stringify((await ab('start')).data.run.shop) === JSON.stringify(run.shop));

    check('lutar sem time: 400', (await ab('battle')).status === 400);
    check('oferta inexistente: 400', (await ab('buy', { offer: 9 })).status === 400);
    const { data: bought } = await ab('buy', { offer: 0 });
    const cost = run.gold - bought.run.gold;
    check(
      'comprar: debita de 1 a 3, entra no time e a oferta some',
      cost >= 1 && cost <= 3 && bought.run.team[0]?.id === run.shop[0] && bought.run.team[0].copies === 1 && bought.run.shop[0] === null,
      JSON.stringify(bought.run),
    );
    check('a mesma oferta de novo: 400', (await ab('buy', { offer: 0 })).status === 400);
    const { data: moved } = await ab('move', { id: run.shop[0] });
    check('mover manda para o banco', moved.run.team.length === 0 && moved.run.bench[0]?.id === run.shop[0]);
    check('lutar só com banco: 400', (await ab('battle')).status === 400);
    check('mover de volta para o time', (await ab('move', { id: run.shop[0] })).data.run.team.length === 1);
    check('ações da loja não mandam os fatores (resposta enxuta)', moved.factors === undefined);
    const { data: sold } = await ab('sell', { id: run.shop[0] });
    check('vender devolve o custo', sold.run.gold === run.gold && sold.run.team.length === 0);
    check('vender quem não está no time: 400', (await ab('sell', { id: run.shop[0] })).status === 400);
    const { data: rolled } = await ab('reroll');
    check('rolar a loja custa 1', rolled.run.gold === run.gold - 1 && rolled.run.shop.length === 5 && rolled.run.shop.every(Boolean));

    // Dois cliques ao mesmo tempo na mesma oferta: só um vale.
    const both = await Promise.all([ab('buy', { offer: 0 }), ab('buy', { offer: 0 })]);
    const afterBoth = (await ab('state')).data.run;
    check(
      'compra simultânea não cobra duas vezes',
      both.filter((r) => r.status === 200).length === 1 && afterBoth.team.length === 1 && afterBoth.team[0].copies === 1,
      both.map((r) => r.status).join(','),
    );

    const { data: fought } = await ab('battle');
    check(
      'luta: semente, adversário com time e resultado',
      Number.isInteger(fought.battle.seed) && fought.battle.opponent.team.length > 0 && ['win', 'loss', 'draw'].includes(fought.battle.outcome),
      JSON.stringify(fought.battle),
    );
    check(
      'depois da luta: rodada 2, moedas da rodada e loja nova',
      fought.run.round === 2 && fought.run.gold === afterBoth.gold + 7 && fought.run.shop.length === 5 &&
        fought.run.wins === (fought.battle.outcome === 'win' ? 1 : 0) && fought.run.losses === (fought.battle.outcome === 'loss' ? 1 : 0) &&
        fought.run.history.length === 1 && fought.run.history[0] === fought.battle.outcome,
      JSON.stringify(fought.run),
    );
    check('o time da rodada vira fantasma', /"n": 1/.test(d1(`SELECT COUNT(*) AS n FROM autobattle_ghosts WHERE round = 1 AND player_id = (SELECT id FROM players WHERE name_key = '${key(me)}')`)));

    // Outra conta, na mesma rodada, enfrenta um fantasma (time de jogador), nunca o próprio.
    await ab('start', {}, rival);
    await ab('buy', { offer: 0 }, rival);
    const { data: versus } = await ab('battle', {}, rival);
    check('adversário é o fantasma de outro jogador', typeof versus.battle.opponent.name === 'string' && versus.battle.opponent.name !== rival.name, JSON.stringify(versus.battle.opponent));

    // Desistir paga pelas vitórias que a run tinha.
    d1(`UPDATE autobattle_runs SET wins = 5 WHERE status = 'active' AND player_id = (SELECT id FROM players WHERE name_key = '${key(rival)}')`);
    const coinsBefore = (await post('/profile', rival)).data.coins;
    const { data: quit } = await ab('abandon', {}, rival);
    check('desistir com 5 vitórias paga 25', quit.run === null && quit.ended.reward === 25 && quit.ended.coins === coinsBefore + 25, JSON.stringify(quit.ended));
    check('run encerrada não volta', (await ab('state', {}, rival)).data.run === null);

    // Rodada 10 com 9 vitórias e o time no máximo: vence o chefe final, a run fecha completa e paga 100.
    const maxed = JSON.stringify(['goku', 'vegeta', 'luffy', 'naruto', 'ichigo', 'sukuna'].map((id) => ({ id, copies: 9 })));
    const myRun = `status = 'active' AND player_id = (SELECT id FROM players WHERE name_key = '${key(me)}')`;
    d1(`UPDATE autobattle_runs SET wins = 9, round = 10, team = '${maxed}' WHERE ${myRun}`);
    const mine = (await post('/profile', me)).data.coins;
    const { data: last } = await ab('battle');
    check(
      'rodada 10: o adversário é o chefe final, sozinho',
      last.battle.opponent.boss === 'final' && last.battle.opponent.name === null && last.battle.opponent.team.length === 1 && last.battle.opponent.team[0].id === 'saitama',
      JSON.stringify(last.battle.opponent),
    );
    check(
      'vencer o chefe final fecha a run completa e paga 100 moedas',
      last.battle.outcome === 'win' && last.run === null && last.ended.wins === 10 && last.ended.cleared === true &&
        last.ended.reward === 100 && last.ended.coins === mine + 100,
      JSON.stringify(last.ended),
    );
    check('rodada de chefe não vira fantasma', /"n": 0/.test(d1(`SELECT COUNT(*) AS n FROM autobattle_ghosts WHERE round = 10 AND player_id = (SELECT id FROM players WHERE name_key = '${key(me)}')`)));

    // Chefe da rodada 5 contra um personagem só: derrota, e a run acaba ali mesmo com as 3 vidas.
    await ab('start');
    d1(`UPDATE autobattle_runs SET round = 5, wins = 4, team = '[{"id":"nami","copies":1}]' WHERE ${myRun}`);
    const { data: lostBoss } = await ab('battle');
    check(
      'perder para o chefe encerra a run (sem completar)',
      lostBoss.battle.opponent.boss === 'mid' && lostBoss.battle.outcome === 'loss' && lostBoss.run === null &&
        lostBoss.ended.cleared === false && lostBoss.ended.reward === 15,
      JSON.stringify(lostBoss.ended),
    );
    check('saldo da conta bate (100 da run completa + 15 da que parou no chefe)', (await post('/profile', me)).data.coins === mine + 115);
    check('depois do fim dá para começar outra', (await ab('start')).data.run.round === 1);

    // Excluir a conta leva runs e fantasmas junto (chaves estrangeiras).
    check('excluir conta com run e fantasma', (await post('/players/delete', { token: rival.token, password: PASSWORD })).status === 200);
  } finally {
    setFlag(wasOn ? 1 : 0);
  }
}

// ---------- Saúde ----------
if (section('Saúde')) {
  const res = await fetch(`${BASE}/api/health`);
  const data = await res.json();
  check('health responde com o banco ok', res.status === 200 && data.ok === true && data.db === 'ok', JSON.stringify(data));
  check('health sem cache', res.headers.get('cache-control') === 'no-store');
}

finish();
