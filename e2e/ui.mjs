// Testes e2e de interface com navegador headless (Edge/Chrome). Screenshots em e2e/screenshots/.
// Uso: com `npm run dev` rodando, `npm run e2e:ui`. Veja só os screenshots que interessam para a mudança.
import {
  chooseNick,
  check,
  cleanTestData,
  d1,
  ensureServer,
  finish,
  launchBrowser,
  nick,
  overflowX,
  PHONE,
  placeAll,
  section,
  shot,
  sleep,
  text,
} from './lib.mjs';

await ensureServer();
cleanTestData();
const b = await launchBrowser();

try {
  // ---------- Nick e home ----------
  section('Nick e home');
  const ana = await b.page();
  await ana.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  check('primeira visita abre a tela do nick', Boolean(await ana.$('.nick-screen')));
  await chooseNick(ana, nick('Ana'));
  const bar = await ana.$eval('.profile-bar', (el) => {
    const r = el.getBoundingClientRect();
    return { right: Math.round(innerWidth - r.right), top: Math.round(r.top) };
  });
  check('barra de perfil no canto superior direito', bar.right <= 20 && bar.top <= 20, JSON.stringify(bar));
  const centers = await ana.evaluate(() =>
    ['.play-buttons', '.leaderboard'].map((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return Math.round(r.left + r.width / 2 - innerWidth / 2);
    }),
  );
  check('SOLO/PARTY e ranking centralizados', centers.every((c) => Math.abs(c) <= 2), centers.join(', '));
  await shot(ana, 'home');

  // ---------- Party ----------
  section('Party');
  await ana.click('.btn-party');
  await ana.click('.party-entry .btn-secondary');
  await ana.waitForSelector('.party-code');
  const room = await text(ana, '.party-code');

  const bruno = await b.page(PHONE);
  await bruno.goto(`http://localhost:5173/?sala=${room}`, { waitUntil: 'networkidle0' });
  check('convite sem nick mostra a sala', (await text(bruno, '.nick-screen-invite'))?.includes(room));
  await chooseNick(bruno, nick('Bruno'), '.party-lobby');
  check('depois do nick entra direto na sala', (await text(bruno, '.party-code')) === room);
  check('URL do convite é limpa', !bruno.url().includes('sala='));
  await shot(bruno, 'party-lobby-celular');

  const carla = await b.page();
  await carla.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await chooseNick(carla, nick('ana'), 'input[aria-label="Código de sincronização"]');
  check('nick de outra pessoa pede código de sincronização', (await text(carla, '.nick-screen .score-label')) === 'Esse nick já tem dono');

  await ana.click('.party-actions .btn-primary');
  await ana.waitForSelector('.power-card');
  await bruno.waitForSelector('.power-card');
  check('mesmo primeiro personagem para os dois', (await text(ana, '.power-card-name')) === (await text(bruno, '.power-card-name')));
  await placeAll(ana);
  await ana.waitForSelector('.party-waiting');
  await shot(ana, 'party-espera');
  await placeAll(bruno);
  await ana.waitForSelector('.podium');
  await sleep(1200);
  check('resultado sem valores de poder', !(await ana.$('.row-power')) && !(await ana.$('.result-columns .power-meter')));
  await shot(ana, 'party-podio', true);
  await bruno.click('.home-button');
  await bruno.waitForSelector('.play-buttons');
  await sleep(500);
  check('"Início" sai da sala', (await text(ana, '.row.offline .player-name')) === nick('Bruno'));

  // ---------- Loja ----------
  section('Loja');
  await ana.click('.home-button');
  await ana.waitForSelector('.profile-bar');
  d1(`UPDATE players SET coins = 2000 WHERE name_key = '${nick('ana').toLowerCase()}'`);
  await ana.reload({ waitUntil: 'networkidle0' });
  await ana.waitForSelector('.profile-bar .coins');
  await ana.click('.profile-bar .btn');
  await ana.waitForSelector('.shop');

  /** Compra (comprar → confirmar) e equipa um item de uma lista da loja. */
  async function buyAndEquip(item) {
    const btn = await item.$('.shop-action');
    await btn.click();
    await sleep(100);
    await btn.click();
    await sleep(600);
    await (await item.$('.shop-action')).click();
    await sleep(600);
    return text(item, '.shop-action');
  }
  await ana.waitForSelector('.shop-list .shop-item:nth-child(5) .shop-action');
  const nameColor = await buyAndEquip((await ana.$$('.shop-list .shop-item'))[4]);
  check('compra e equipa cor do nick (Fogo)', nameColor === 'Equipado', nameColor ?? '');
  await (await ana.$$('.shop-tabs .mode-option'))[1].click();
  await sleep(200);
  check('compra e equipa moldura (Lendária)', (await buyAndEquip((await ana.$$('.shop-list .shop-item'))[4])) === 'Equipado');
  await (await ana.$$('.shop-tabs .mode-option'))[2].click();
  await ana.type('.shop-search', 'son goku');
  await sleep(300);
  check('compra e equipa avatar', (await buyAndEquip((await ana.$$('.shop-avatars .shop-avatar'))[0])) === 'Equipado');
  const balance = await text(ana, '.shop-balance .coins');
  check('saldo descontado (2000 − 250 − 600 − 50)', balance === '1100', balance ?? '');
  await shot(ana, 'loja');

  await ana.click('.home-button');
  await ana.waitForSelector('.profile-bar .player-tag img');
  const tag = await ana.$eval('.profile-bar .player-tag', (el) => el.innerHTML);
  check('barra de perfil mostra o visual', tag.includes('cosmetic-name-fire') && tag.includes('cosmetic-frame-legend') && tag.includes('goku'));

  // ---------- Solo ----------
  section('Solo');
  await ana.click('.play-buttons .btn-primary');
  await placeAll(ana);
  await ana.waitForSelector('.coins-earned');
  await sleep(1000);
  check('resultado mostra moedas (ou o aviso de 500+)', /^\+\d+$|500\+/.test((await text(ana, '.coins-earned')) ?? ''));
  check('resultado solo sem valores de poder', !(await ana.$('.row-power')));
  check('ranking mostra o visual do jogador', Boolean(await ana.$('.leaderboard .row.highlight .cosmetic-frame-legend')));
  await shot(ana, 'solo-resultado', true);

  // ---------- Celular ----------
  section('Celular');
  await bruno.reload({ waitUntil: 'networkidle0' });
  await bruno.waitForSelector('.profile-bar');
  check('home sem scroll horizontal', (await overflowX(bruno)) <= 0);
  await shot(bruno, 'home-celular');

  check('sem erros no console', b.errors.length === 0, b.errors.join(' | '));
} catch (err) {
  check('fluxo completo sem exceção', false, err.message);
} finally {
  await b.close();
}

finish();
