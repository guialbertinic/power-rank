// Testes e2e da API (sem navegador): nick, economia/loja e party por WebSocket.
// Uso: com `npm run dev` rodando, `npm run e2e:api`.
import {
  check,
  cleanTestData,
  ensureServer,
  finish,
  get,
  nick,
  partyClient,
  perfectOrder,
  player,
  playSolo,
  post,
  section,
  sleep,
} from './lib.mjs';

await ensureServer();
cleanTestData();

// ---------- Nick com dono ----------
section('Nick');
{
  const name = nick('Dono');
  const { status, data: a } = await post('/players', { name });
  check('nick livre vira seu (token)', status === 200 && Boolean(a.token));
  check('mesmo dono confirma', (await post('/players', { name: name.toLowerCase(), token: a.token })).status === 200);
  const taken = await post('/players', { name: name.toUpperCase() });
  check('outro navegador é recusado (409)', taken.status === 409 && taken.data.taken === true);

  const { data: s1 } = await post('/players/sync-code', { name, token: a.token });
  const { data: s2 } = await post('/players/sync-code', { name, token: a.token });
  check('código de sincronização no formato XXXX-XXXX-XXXX', /^[A-Z2-9]{4}(-[A-Z2-9]{4}){2}$/.test(s2.code), s2.code);
  check('código antigo deixa de valer', (await post('/players/recover', { name, recoveryCode: s1.code })).status === 403);
  const rec = await post('/players/recover', { name, recoveryCode: s2.code.toLowerCase().replace(/-/g, ' ') });
  check('código novo (digitado diferente) dá token', rec.status === 200 && rec.data.token !== a.token);
  check('partida solo sem token é recusada', (await post('/games', { name, mode: 'anime' })).status === 401);
  const other = await player('Outro');
  check('token de um nick não serve para outro', (await post('/games', { name, token: other.token, mode: 'anime' })).status === 401);
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
  const { scores } = await get('/scores?mode=anime');
  const row = scores.find((s) => s.name === me.name);
  check('ranking traz o visual', row?.look.avatar === 'goku' && row.look.nameColor === 'name-cyan');
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

  const g = partyClient(code, 'e2e-gues-pid-01', guest.name, guest.token);
  await g.ready;
  await sleep(300);
  check('convidado entra', h.state.players.length === 2);
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
