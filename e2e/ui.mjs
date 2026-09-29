// Testes e2e de interface com navegador headless (Edge/Chrome). Sem screenshots: tudo é checado por seletor/texto.
// Uso: com `npm run dev` rodando, `npm run e2e:ui`.
import {
  chooseGuest,
  chooseNick,
  check,
  cleanTestData,
  d1,
  ensureServer,
  finish,
  launchBrowser,
  nick,
  overflowX,
  PASSWORD,
  PHONE,
  placeAll,
  section,
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
  check('botão de login avisa que também cria conta', (await text(ana, '.nick-login small')) === '(criar conta)');
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

  // ---------- Party ----------
  section('Party');
  await ana.click('.btn-party');
  await ana.click('.party-entry .btn-secondary');
  await ana.waitForSelector('.party-code');
  const room = await text(ana, '.party-code');

  const bruno = await b.page(PHONE);
  await bruno.goto(`http://localhost:5173/?sala=${room}`, { waitUntil: 'networkidle0' });
  check('convite sem nick mostra a sala', (await text(bruno, '.nick-screen-invite'))?.includes(room));
  check('tela do nick sem scroll horizontal no celular', (await overflowX(bruno)) <= 0);
  await chooseGuest(bruno, nick('Bruno'), '.party-lobby');
  check('convidado entra direto na sala', (await text(bruno, '.party-code')) === room);
  check('URL do convite é limpa', !bruno.url().includes('sala='));

  const carla = await b.page();
  await carla.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await carla.type('#nick', nick('ana'));
  await carla.click('.nick-guest');
  await carla.waitForSelector('.nick-screen .error');
  const carlaError = await text(carla, '.nick-screen .error');
  check('convidado não usa nick de conta', carlaError === 'Esse nick já está em uso.', carlaError ?? '');
  await carla.close();

  await ana.click('.party-actions .btn-primary');
  await ana.waitForSelector('.power-card');
  await bruno.waitForSelector('.power-card');
  check('mesmo primeiro personagem para os dois', (await text(ana, '.power-card-name')) === (await text(bruno, '.power-card-name')));
  await placeAll(ana);
  await ana.waitForSelector('.party-waiting');
  await placeAll(bruno);
  await ana.waitForSelector('.podium');
  await sleep(1200);
  check('resultado sem valores de poder', !(await ana.$('.row-power')) && !(await ana.$('.result-columns .power-meter')));
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
  /** Item da lista pelo texto (nome do item ou, nos títulos, o próprio título). */
  async function shopItem(label) {
    for (const item of await ana.$$('.shop-list .shop-item')) {
      const texts = await item.$$eval('.shop-item-label, .player-title', (els) => els.map((e) => e.textContent));
      if (texts.includes(label)) return item;
    }
    throw new Error(`Item não encontrado na loja: ${label}`);
  }
  const tabs = async (i) => (await ana.$$('.shop-tabs .mode-option'))[i].click();

  await ana.waitForSelector('.shop-list .shop-item .shop-action');
  const nameColor = await buyAndEquip(await shopItem('Fogo'));
  check('compra e equipa cor do nick (Fogo)', nameColor === 'Equipado', nameColor ?? '');
  await tabs(1);
  await sleep(200);
  check('compra e equipa moldura (Lendária)', (await buyAndEquip(await shopItem('Lendária'))) === 'Equipado');
  await tabs(2);
  await sleep(200);
  check('títulos separados por grupo', (await ana.$$('.shop-group')).length >= 5);
  check('compra e equipa título', (await buyAndEquip(await shopItem('Iniciante Próspero'))) === 'Equipado');
  await tabs(3);
  await ana.type('.shop-search', 'son goku');
  await sleep(300);
  check('compra e equipa avatar', (await buyAndEquip((await ana.$$('.shop-avatars .shop-avatar'))[0])) === 'Equipado');
  const balance = await text(ana, '.shop-balance .coins');
  check('saldo descontado (2000 − 250 − 600 − 50 − 50)', balance === '1050', balance ?? '');

  await ana.click('.home-button');
  await ana.waitForSelector('.profile-bar .player-tag img');
  const tag = await ana.$eval('.profile-bar .player-tag', (el) => el.innerHTML);
  check('barra de perfil mostra o visual', tag.includes('cosmetic-name-fire') && tag.includes('cosmetic-frame-legend') && tag.includes('goku'));
  check('título aparece embaixo do nick', (await text(ana, '.profile-bar .player-title')) === 'Iniciante Próspero');

  // ---------- Conta e sincronização ----------
  section('Conta e sincronização');
  // Bruno (convidado, celular) cria a conta pelo menu.
  await bruno.click('.profile-bar-me');
  await (await bruno.waitForSelector('.profile-menu ::-p-text(Sincronizar dispositivo)')).click();
  await bruno.waitForSelector('.sync-password-form');
  await bruno.type('input[aria-label="Nova senha"]', PASSWORD);
  await bruno.type('input[aria-label="Repita a senha"]', PASSWORD);
  await bruno.click('.sync-password-form .btn-primary');
  await bruno.waitForSelector('.sync-panel ::-p-text(Conta pronta)');
  check('convidado cria a conta pelo menu', Boolean(await bruno.$('.profile-bar .coins')) && !(await bruno.$('.profile-guest')));
  await bruno.keyboard.press('Escape');

  // Ana força a sincronização depois de uma mudança feita "em outro dispositivo".
  d1(`UPDATE players SET coins = 777 WHERE name_key = '${nick('ana').toLowerCase()}'`);
  await ana.click('.profile-bar-me');
  await (await ana.waitForSelector('.profile-menu ::-p-text(Sincronizar dispositivo)')).click();
  await ana.click('.sync-force .btn');
  await ana.waitForSelector('.sync-force ::-p-text(Pronto)');
  check('forçar sincronização traz o saldo do servidor', (await text(ana, '.profile-bar .coins')) === '777');
  await ana.keyboard.press('Escape');

  // Ana entra no celular com Login + senha.
  const celular = await b.page(PHONE);
  await celular.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await celular.type('#nick', nick('ana'));
  await celular.click('.nick-login');
  await celular.waitForSelector('input[aria-label="Senha"]');
  check('Login em nick com conta pede só a senha', !(await celular.$('input[aria-label="Confirmar senha"]')));
  await celular.type('input[aria-label="Senha"]', 'errada00');
  await celular.click('.nick-screen .btn-primary');
  await celular.waitForSelector('.nick-screen .error');
  check('senha errada mostra erro', (await text(celular, '.nick-screen .error')) === 'Senha incorreta');
  await celular.$eval('input[aria-label="Senha"]', (el) => (el.value = ''));
  await celular.type('input[aria-label="Senha"]', PASSWORD);
  await celular.click('.nick-screen .btn-primary');
  await celular.waitForSelector('.profile-bar .coins');
  check('entra com nick + senha em outro dispositivo', (await text(celular, '.profile-bar .coins')) === '777');
  await celular.close();

  // ---------- Solo ----------
  section('Solo');
  await ana.click('.play-buttons .btn-primary');
  await placeAll(ana);
  await ana.waitForSelector('.coins-earned');
  await sleep(1000);
  check('resultado mostra moedas (ou o aviso de 500+)', /^\+\d+$|500\+/.test((await text(ana, '.coins-earned')) ?? ''));
  check('resultado solo sem valores de poder', !(await ana.$('.row-power')));
  check('ranking mostra o visual do jogador', Boolean(await ana.$('.leaderboard .row.highlight .cosmetic-frame-legend')));

  // ---------- Trocar nick e sair ----------
  section('Trocar nick e sair');
  await ana.click('.home-button');
  await ana.waitForSelector('.profile-bar .coins');
  await sleep(800);
  const coinsBefore = await text(ana, '.profile-bar .coins');
  await ana.click('.profile-bar-me');
  await (await ana.waitForSelector('.profile-menu ::-p-text(Trocar nick)')).click();
  await ana.$eval('input[aria-label="Novo nick"]', (el) => (el.value = ''));
  await ana.type('input[aria-label="Novo nick"]', nick('Bruno'));
  await ana.click('.change-nick .btn-primary');
  await ana.waitForSelector('.change-nick .error');
  check('não troca para nick de outra conta', (await text(ana, '.change-nick .error')) === 'Esse nick já é de outra conta');
  await ana.$eval('input[aria-label="Novo nick"]', (el) => (el.value = ''));
  await ana.type('input[aria-label="Novo nick"]', nick('AnaNova'));
  await ana.click('.change-nick .btn-primary');
  await ana.waitForSelector(`.profile-bar-me ::-p-text(${nick('AnaNova')})`);
  await sleep(800);
  const coinsAfter = await text(ana, '.profile-bar .coins');
  check('troca o nick da conta e mantém as moedas', coinsAfter === coinsBefore, `${coinsBefore} → ${coinsAfter}`);

  await ana.click('.profile-leave');
  await ana.waitForSelector('#nick');
  check('sair da conta volta para a tela do nick', Boolean(await ana.$('.nick-login')));
  await ana.type('#nick', nick('AnaNova'));
  await ana.click('.nick-login');
  await ana.waitForSelector('input[aria-label="Senha"]');
  check('depois de sair, entrar pede a senha', !(await ana.$('input[aria-label="Confirmar senha"]')));

  // ---------- Celular ----------
  section('Celular');
  await bruno.reload({ waitUntil: 'networkidle0' });
  await bruno.waitForSelector('.profile-bar');
  check('home sem scroll horizontal', (await overflowX(bruno)) <= 0);

  check('sem erros no console', b.errors.length === 0, b.errors.join(' | '));
} catch (err) {
  check('fluxo completo sem exceção', false, err.message);
} finally {
  await b.close();
}

finish();
