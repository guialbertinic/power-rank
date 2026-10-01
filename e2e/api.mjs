// Testes e2e da API (sem navegador): nick, economia/loja e party por WebSocket.
// Uso: com `npm run dev` rodando, `npm run e2e:api`.
import {
  BASE,
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
  check('Free for All não tem Pokémon', ffa.characters?.length === 10 && !ffa.characters.some((c) => c.category === 'pokemon'));
  const { data: room } = await post('/party', { mode: 'pokemon', pid: 'e2e-pkmn-pid-01', generations: [2] });
  const host = await player('PkmHost');
  const h = partyClient(room.code, 'e2e-pkmn-pid-01', host.name, host.token);
  await h.ready;
  await sleep(300);
  check('sala Pokémon guarda o filtro', JSON.stringify(h.state?.generations) === '[2]', JSON.stringify(h.state?.generations));
  h.send({ type: 'start' });
  await sleep(500);
  check('partida da sala respeita o filtro', h.state?.characterIds.length === 10 && gen(h.state.characterIds).every((g) => g === 2));
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
  check('abaixo de 500 não paga', bad.coinsEarned === 0, `${bad.score} pts`);
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

// ---------- Chaves dos minigames (tabela features) ----------
if (section('Chaves')) {
  const me = await player('Chaves');
  await post('/profile/adult', me);
  d1(`UPDATE players SET coins = 500 WHERE name_key = '${me.name.toLowerCase()}'`);
  const on = (await get('/config')).features;
  check('config traz as chaves (ligadas por padrão)', on?.slots === true && on?.plinko === true && on?.mystery_box === true, JSON.stringify(on));
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
    const coins = (await post('/profile', me)).data.coins;
    check('desligado não cobra moedas', coins === 400, String(coins));
  } finally {
    setFlag('slots', 1);
    setFlag('mystery_box', 1);
    setFlag('plinko', 1);
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
  await h.ready;
  await sleep(300);
  check('dono entra e é host', h.state?.hostId === h.you);

  const intruder = partyClient(code, 'e2e-intr-pid-01', guest.name, 'token-falso');
  await intruder.ready;
  await sleep(300);
  check('token errado é recusado', intruder.errors[0]?.startsWith('Nick não verificado'));

  // Duas conexões simultâneas do mesmo jogador (StrictMode, clique duplo): uma vaga só.
  const twin = await player('Twin');
  const t1 = partyClient(code, 'e2e-twin-pid-01', twin.name, twin.token);
  const t2 = partyClient(code, 'e2e-twin-pid-01', twin.name, twin.token);
  await Promise.all([t1.ready, t2.ready]);
  await sleep(500);
  check('conexões simultâneas não duplicam a vaga', h.state.players.length === 2, `${h.state.players.length} jogadores`);
  const partyLog = d1(`SELECT COUNT(*) AS n FROM access_log WHERE event = 'party' AND lower(name) = '${twin.name.toLowerCase()}'`);
  check('entrada na party fica no registro de acesso (uma vez)', /"n": 1\b/.test(partyLog), /"n": \d+/.exec(partyLog)?.[0]);
  t1.ws.close();
  t2.ws.close();
  await sleep(400);

  // Nick sem conta entra como convidado (e sai: quem cai no lobby sai da sala).
  const visitor = partyClient(code, 'e2e-visi-pid-01', nick('Visitante'), '');
  await visitor.ready;
  await sleep(300);
  check('nick sem conta entra como convidado', h.state.players.some((p) => p.name === nick('Visitante') && p.guest === true));
  visitor.ws.close();
  await sleep(400);

  const g = partyClient(code, 'e2e-gues-pid-01', guest.name, guest.token);
  await g.ready;
  await sleep(300);
  check('segundo jogador entra', h.state.players.length === 2);
  const dup = partyClient(code, 'e2e-dupe-pid-01', guest.name.toLowerCase(), guest.token);
  await dup.ready;
  await sleep(300);
  check('nick repetido na sala é recusado', dup.errors[0] === 'Esse nick já está na sala');
  const missing = partyClient('ZZZZZZ', 'e2e-miss-pid-01', guest.name, guest.token);
  await missing.ready;
  await sleep(300);
  check('sala inexistente é recusada', missing.errors[0] === 'Sala não encontrada');

  g.send({ type: 'start' });
  await sleep(300);
  check('só o dono inicia', g.errors.includes('Só o dono da sala pode iniciar') && h.state.phase === 'lobby');
  h.send({ type: 'start' });
  await sleep(400);
  const ids = h.state.characterIds;
  check('mesmos 10 personagens para todos', ids.length === 10 && JSON.stringify(ids) === JSON.stringify(g.state.characterIds));

  g.send({ type: 'progress', placed: 4 });
  await sleep(300);
  check('progresso aparece para os outros', h.player(guest.name)?.progress === 4);
  g.ws.close();
  await sleep(400);
  check('queda aparece como desconectado', h.player(guest.name)?.connected === false);
  const g2 = partyClient(code, 'e2e-gues-pid-01', guest.name, guest.token);
  await g2.ready;
  await sleep(400);
  check('reconecta na mesma vaga', g2.you === g.you && h.player(guest.name)?.connected === true);

  await sleep(MIN_GAME_MS); // o servidor não conta rodada terminada rápido demais
  h.send({ type: 'finish', placements: perfectOrder(ids) });
  await sleep(400);
  check('pontuação escondida até o pódio', h.state.phase === 'playing' && h.state.players.every((p) => p.score === undefined));
  check('ordem correta escondida até o pódio', h.state.ranks === undefined);
  g2.send({ type: 'finish', placements: ['x'] });
  await sleep(300);
  check('posições inválidas são recusadas', g2.errors.includes('Posições inválidas'));
  g2.send({ type: 'finish', placements: perfectOrder(ids).reverse() });
  await sleep(600);
  const ph = h.player(host.name);
  const pg = h.player(guest.name);
  check('todos terminaram → pódio', h.state.phase === 'podium');
  check('pódio revela a ordem correta (ranks), sem power', Object.keys(h.state.ranks ?? {}).length === 10 && !JSON.stringify(h.state).includes('power'));
  check('1º com 1000 ganha 60 + 20 de pódio', ph.score === 1000 && ph.coinsEarned === 80);
  check('chute não ganha bônus de pódio', pg.score < 500 && pg.coinsEarned === 0, `${pg.score} pts`);

  h.send({ type: 'start' });
  await sleep(400);
  check('revanche limpa a rodada', h.state.round === 2 && h.state.players.every((p) => !p.finished));
  h.send({ type: 'end' });
  await sleep(300);
  check('dono pode encerrar', h.state.phase === 'podium');
  h.ws.close();
  await sleep(400);
  check('dono sai → outro vira dono', g2.state.hostId === g2.you);
  for (const c of [g2, dup, missing, intruder]) c.ws.close();

  const { scores } = await get('/scores?mode=anime');
  check('resultado da party não entra no ranking (só desafio)', !scores.some((s) => s.name === host.name));
}

finish();
