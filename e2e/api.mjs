// Testes e2e da API (sem navegador): nick, economia/loja e party por WebSocket.
// Uso: com `npm run dev` rodando, `npm run e2e:api`.
import {
  BASE,
  check,
  cleanTestData,
  d1,
  ensureServer,
  finish,
  get,
  nick,
  partyClient,
  PASSWORD,
  perfectOrder,
  player,
  playSolo,
  post,
  section,
  sleep,
} from './lib.mjs';

await ensureServer();
cleanTestData();

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
  const { status, data: a } = await post('/players', { name, password: 'segredo1' });
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

  h.send({ type: 'finish', placements: perfectOrder(ids) });
  await sleep(400);
  check('pontuação escondida até o pódio', h.state.phase === 'playing' && h.state.players.every((p) => p.score === undefined));
  g2.send({ type: 'finish', placements: ['x'] });
  await sleep(300);
  check('posições inválidas são recusadas', g2.errors.includes('Posições inválidas'));
  g2.send({ type: 'finish', placements: perfectOrder(ids).reverse() });
  await sleep(600);
  const ph = h.player(host.name);
  const pg = h.player(guest.name);
  check('todos terminaram → pódio', h.state.phase === 'podium');
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
