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
  playSolo,
  post,
  section,
  sleep,
} from './lib.mjs';

await ensureServer();
cleanTestData();

// ---------- Catálogo sem power ----------
section('Catálogo');
{
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
  check('resultado traz a ordem correta (ranks) e não o power', scored.score === 1000 && ranksOk && !JSON.stringify(scored).includes('power'));
}

// ---------- Segurança ----------
section('Segurança');
{
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
section('Conta e convidado');
{
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
section('Trocar nick');
{
  const acc = await player('Renome');
  await playSolo(acc, 'perfect');
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
  const again = await playSolo({ name: newName, token: acc.token }, 'reversed');
  check('recorde segue a conta depois de trocar o nick', again.isNewBest === false && again.best === 1000);
  const guestOld = await playSolo({ name: acc.name }, 'reversed');
  check('convidado pode usar o nick antigo', typeof guestOld.score === 'number' && guestOld.coins === null);
  check('mudar só maiúsculas vale', (await post('/players/rename', { token: acc.token, name: newName.toUpperCase() })).status === 200);
  check('entra com o nick novo + senha', (await post('/players', { name: newName, password: PASSWORD })).status === 200);
}

// ---------- Economia e loja ----------
section('Economia e loja');
{
  const me = await player('Loja');
  const bad = await playSolo(me, 'reversed');
  check('abaixo de 500 não paga', bad.coinsEarned === 0, `${bad.score} pts`);
  const good = await playSolo(me, 'perfect');
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
section('Ranking');
{
  const slow = await player('Lento');
  const fast = await player('Rapido');
  const first = await playSolo(slow, 'perfect');
  check('envio traz o tempo da partida', typeof first.durationMs === 'number' && first.durationMs >= 0);
  await playSolo(fast, 'perfect');
  // Tempos controlados: os dois fizeram 1000, o "Rapido" em menos tempo.
  d1(`UPDATE scores SET duration_ms = 90000 WHERE player_id = (SELECT id FROM players WHERE name_key = '${slow.name.toLowerCase()}')`);
  d1(`UPDATE scores SET duration_ms = 30000 WHERE player_id = (SELECT id FROM players WHERE name_key = '${fast.name.toLowerCase()}')`);
  const { scores: today } = await get('/scores?mode=anime&period=today');
  const pos = (list, p) => list.findIndex((s) => s.name === p.name);
  check('empate em 1000: menor tempo na frente', pos(today, fast) >= 0 && pos(today, fast) < pos(today, slow));
  check('Hoje mostra o tempo', today[pos(today, fast)]?.durationMs === 30000);

  // Mais uma partida hoje e uma de ontem para o "Lento".
  await playSolo(slow, 'perfect');
  const yesterday = Date.now() - 26 * 60 * 60 * 1000;
  const slowId = `(SELECT id FROM players WHERE name_key = '${slow.name.toLowerCase()}')`;
  d1(
    `INSERT INTO games (id, character_ids, created_at, submitted, name, player_id, mode) VALUES ('e2e-ontem', '[]', ${yesterday}, 1, '${slow.name}', ${slowId}, 'anime');` +
      `INSERT INTO scores (game_id, name, name_key, player_id, mode, score, placements, coins, created_at) VALUES ('e2e-ontem', '${slow.name}', '${slow.name.toLowerCase()}', ${slowId}, 'anime', 700, '[]', 0, ${yesterday});`,
  );
  const { scores: total } = await get('/scores?mode=anime&period=total');
  const slowTotal = total.find((s) => s.name === slow.name);
  check('Acumulado soma o melhor de cada dia (1000 hoje + 700 ontem)', slowTotal?.score === 1700 && slowTotal.days === 2, JSON.stringify(slowTotal));
  check('Acumulado não soma 2 partidas do mesmo dia', total.find((s) => s.name === fast.name)?.score === 1000);
  const { scores: todayAgain } = await get('/scores?mode=anime&period=today');
  check('Hoje ignora partidas de ontem', todayAgain.find((s) => s.name === slow.name)?.score === 1000);
  check('período inválido é recusado', (await fetch(`${BASE}/api/scores?mode=anime&period=ano`)).status === 400);
}

// ---------- Cassino ----------
section('Cassino');
{
  const me = await player('Cassino');
  check('convidado não joga (401)', (await post('/casino/spin', { bet: 1 })).status === 401);
  const underage = await post('/casino/spin', { ...me, bet: 1 });
  check('sem declarar 18+: 403', underage.status === 403 && underage.data.code === 'adult_required');
  check('perfil começa sem 18+', (await post('/profile', me)).data.adult === false);
  const adult = await post('/profile/adult', me);
  check('declara 18+ e o perfil mostra', adult.status === 200 && adult.data.adult === true);
  check('declarar 18+ pede a conta (401)', (await post('/profile/adult', {})).status === 401);
  check('aposta fora da regra é recusada', (await post('/casino/spin', { ...me, bet: 11 })).status === 400);
  check('sem saldo: 402', (await post('/casino/spin', { ...me, bet: 1 })).status === 402);

  d1(`UPDATE players SET coins = 2000 WHERE name_key = '${me.name.toLowerCase()}'`);
  const potCents = () => Number(/"amount_cents": (\d+)/.exec(d1('SELECT amount_cents FROM casino_pot'))?.[1]);
  const potBefore = potCents();
  const PAIR = { seven: 5, galactic: 3, replay: 2, cherry: 1, pikachu: 1, moonstone: 0 };
  const THREE = { galactic: 60, replay: 30, cherry: 18, pikachu: 10, moonstone: 5 };
  let expectedCoins = 2000;
  let prizesOk = true;
  let jackpots = 0;
  for (let i = 0; i < 25; i++) {
    const bet = i % 2 ? 1 : 10;
    const { status, data } = await post('/casino/spin', { ...me, bet });
    if (status !== 200) {
      prizesOk = false;
      break;
    }
    const [a, b, c] = data.reels;
    const pair = a === b || a === c ? a : b === c ? b : null;
    const expected = a === b && b === c ? (a === 'seven' ? null : THREE[a] * bet) : pair ? PAIR[pair] * bet : 0;
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

// ---------- Mystery Box ----------
section('Mystery Box');
{
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
section('Party');
{
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
  check('resultado da party entra no ranking', scores.some((s) => s.name === host.name && s.score === 1000));
}

finish();
