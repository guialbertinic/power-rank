// Testes e2e de interface com navegador headless (Edge/Chrome). Sem screenshots: tudo é checado por seletor/texto.
// Uso: com `npm run dev` rodando, `npm run e2e:ui`.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  DESKTOP,
  placeAll,
  section,
  sleep,
  text,
} from './lib.mjs';

await ensureServer();
cleanTestData();
// Voltar ao início: na barra de perfil (home, loja, conquistas, Arcade, conta) ou no cabeçalho (partida, party).
const HOME = ':is(.home-button, .profile-nav [data-nav="home"])';
const b = await launchBrowser();

try {
  // ---------- Nick e home ----------
  section('Nick e home');
  const ana = await b.page();
  await ana.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  check('primeira visita abre a tela do nick', Boolean(await ana.$('.nick-screen')));
  check('botão de login avisa que também cria conta', (await text(ana, '.nick-login small')) === '(criar conta)');
  check('tela do nick avisa dos termos (13+)', /13 anos ou mais/.test((await text(ana, '.nick-screen .legal-notice')) ?? ''));
  await ana.click('.nick-screen .legal-notice .legal-link');
  await ana.waitForSelector('.legal-overlay');
  check('link abre os termos por cima da tela', (await text(ana, '#legal-title')) === 'Termos de uso');
  await ana.click('.legal-tabs button:last-child');
  check('troca para a privacidade', (await text(ana, '#legal-title')) === 'Política de privacidade');
  check('privacidade fala do IP e dos 90 dias', /IP/.test((await text(ana, '.legal')) ?? '') && /90 dias/.test((await text(ana, '.legal')) ?? ''));
  await ana.keyboard.press('Escape');
  check('Esc fecha e volta para a tela do nick', !(await ana.$('.legal-overlay')) && Boolean(await ana.$('#nick')));
  await chooseNick(ana, nick('Ana'));
  check('home tem rodapé com termos e privacidade', (await ana.$$('.app-footer .legal-link')).length === 2);
  const bar = await ana.$eval('.profile-bar', (el) => {
    const r = el.getBoundingClientRect();
    return { right: Math.round(document.documentElement.clientWidth - r.right), top: Math.round(r.top) };
  });
  check('barra de perfil no canto superior direito', bar.right <= 20 && bar.top <= 20, JSON.stringify(bar));
  // Engrenagem no fim da barra, depois da navegação, centralizada na altura.
  const gearInBar = await ana.evaluate(() => {
    const [g, b, n] = ['.settings-toggle', '.profile-bar', '.profile-nav'].map((s) => document.querySelector(s).getBoundingClientRect());
    return { afterNav: g.left >= n.right, inside: g.right <= b.right && g.top >= b.top && g.bottom <= b.bottom, off: Math.round(g.top + g.height / 2 - (b.top + b.height / 2)) };
  });
  check('engrenagem das configurações dentro da barra de perfil', gearInBar.afterNav && gearInBar.inside && Math.abs(gearInBar.off) <= 2, JSON.stringify(gearInBar));
  const centers = await ana.evaluate(() =>
    ['.play-setup', '.leaderboard'].map((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return Math.round(r.left + r.width / 2 - document.documentElement.clientWidth / 2);
    }),
  );
  const [title, categories, modes] = await ana.evaluate(() =>
    ['.app-header h1', '.mode-picker', '.play-buttons'].map((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    }),
  );
  check('título, categorias e SOLO/PARTY nessa ordem', title.bottom <= categories.top && categories.bottom <= modes.top);
  check('modos, SOLO/PARTY e ranking centralizados', centers.every((c) => Math.abs(c) <= 2), centers.join(', '));

  // ---------- Idioma ----------
  section('Idioma');
  await ana.click('.settings-toggle');
  await (await ana.waitForSelector('.settings-langs ::-p-text(English)')).click();
  await ana.waitForSelector('.profile-bar ::-p-text(Shop)');
  check('menu de configurações troca para inglês', (await text(ana, '.leaderboard .section-title'))?.startsWith('Ranking') && Boolean(await ana.$('.leaderboard-periods ::-p-text(Challenge)')));
  check('html lang acompanha o idioma', (await ana.evaluate(() => document.documentElement.lang)) === 'en');
  await ana.reload({ waitUntil: 'networkidle0' });
  await ana.waitForSelector('.profile-bar');
  check('idioma fica salvo no navegador', Boolean(await ana.$('.profile-bar ::-p-text(Shop)')));
  await ana.click('.settings-toggle');
  await (await ana.waitForSelector('.settings-langs ::-p-text(Português)')).click();
  await ana.waitForSelector('.profile-bar ::-p-text(Loja)');
  await ana.keyboard.press('Escape');

  // ---------- Modo gravação ----------
  section('Modo gravação');
  await ana.click('.settings-toggle');
  await (await ana.waitForSelector('.settings-check input')).click();
  await ana.waitForFunction(() => !document.querySelector('.profile-bar'));
  check('modo gravação esconde a barra de perfil e o rodapé', !(await ana.$('.app-footer')) && Boolean(await ana.$('.app.recording')));
  await ana.reload({ waitUntil: 'networkidle0' });
  await ana.waitForSelector('.play-buttons');
  check('modo gravação fica salvo no navegador', !(await ana.$('.profile-bar')));
  await ana.click('.settings-toggle');
  await (await ana.waitForSelector('.settings-check input')).click();
  await ana.waitForSelector('.profile-bar');
  check('desligar o modo gravação traz a barra de volta', Boolean(await ana.$('.app-footer')));
  await ana.keyboard.press('Escape');

  // ---------- Party ----------
  section('Party');
  await ana.click('.btn-party');
  await ana.waitForSelector('.party-entry .difficulty-picker');
  await ana.click('.difficulty-option:nth-child(1)');
  await ana.click('.party-entry .btn-secondary');
  await ana.waitForSelector('.party-code');
  const room = await text(ana, '.party-code');
  check('sala mostra a dificuldade escolhida', (await text(ana, '.party-code-panel .score-label'))?.includes('Fácil'), await text(ana, '.party-code-panel .score-label'));

  const bruno = await b.page(PHONE);
  await bruno.goto(`http://localhost:5173/?sala=${room}`, { waitUntil: 'networkidle0' });
  check('convite sem nick mostra a sala', (await text(bruno, '.nick-screen-invite'))?.includes(room));
  check('tela do nick sem scroll horizontal no celular', (await overflowX(bruno)) <= 0);
  // Link direto para a política (ex: bio, rede de anúncios); abre por cima e ao fechar a URL fica limpa.
  const legalPage = await b.page(PHONE);
  await legalPage.goto('http://localhost:5173/?privacidade', { waitUntil: 'networkidle0' });
  await legalPage.waitForSelector('.legal-overlay');
  check('/?privacidade abre a política', (await text(legalPage, '#legal-title')) === 'Política de privacidade');
  const legalOverflow = await legalPage.$eval('.legal-overlay', (el) => el.scrollWidth - el.clientWidth);
  check('política sem scroll horizontal no celular', legalOverflow <= 0, String(legalOverflow));
  await legalPage.click('.legal-close');
  check('fechar limpa a URL', !legalPage.url().includes('privacidade'));
  await legalPage.close();
  await chooseGuest(bruno, nick('Bruno'), '.party-lobby');
  check('convidado entra direto na sala', (await text(bruno, '.party-code')) === room);
  check('URL do convite é limpa', !bruno.url().includes('sala='));

  // Configuração da sala e ações nos jogadores: só o dono.
  check('dono vê a configuração da sala; convidado não', Boolean(await ana.$('.party-settings')) && !(await bruno.$('.party-settings')));
  await ana.click('.party-settings .mode-option:nth-child(2)');
  await bruno.waitForFunction(() => document.querySelector('.party-code-panel .score-label')?.textContent.includes('Games'));
  check('dono troca a categoria e o outro vê', (await text(bruno, '.party-code-panel .score-label'))?.includes('Games'));
  await ana.click('.party-player-menu');
  await ana.waitForSelector('.party-player-actions');
  check('dono abre as ações do jogador (denunciar / dono / expulsar)', (await ana.$$('.party-player-actions button')).length === 3);
  await ana.click('.party-player-menu');
  // Quem não é dono só denuncia o nick.
  await bruno.click('.party-player-menu');
  await bruno.waitForSelector('.party-player-actions');
  check('convidado só tem "Denunciar nick"', (await bruno.$$eval('.party-player-actions button', (els) => els.map((el) => el.textContent))).join() === 'Denunciar nick');
  await bruno.click('.party-player-actions button');
  await bruno.waitForSelector('.party-players + .report-form');
  check('denunciar abre o formulário com o nick', (await text(bruno, '.report-form .report-target')) === nick('Ana'));
  await bruno.click('.report-form .link-button');
  check('lobby sem scroll horizontal no celular', (await overflowX(bruno)) <= 0);

  // Expulsar: quem sai vê o aviso na hora, e ao tentar voltar também.
  const eva = await b.page();
  await eva.goto(`http://localhost:5173/?sala=${room}`, { waitUntil: 'networkidle0' });
  await chooseGuest(eva, nick('Eva'), '.party-lobby');
  await ana.click(`.party-player-menu[aria-label="Opções de ${nick('Eva')}"]`);
  await ana.waitForSelector('.party-action-danger');
  let kickStart = Date.now();
  await ana.click('.party-action-danger');
  const removed = () => document.querySelector('.party-message')?.textContent.includes('Você foi removido da sala');
  await eva.waitForFunction(removed, { timeout: 5000 });
  const kickMs = Date.now() - kickStart;
  check('expulso vê "removido da sala" na hora', kickMs < 1500, `${kickMs} ms`);
  await ana.waitForFunction((n) => !document.querySelector('.party-players')?.textContent.includes(n), {}, nick('Eva'));
  kickStart = Date.now();
  await eva.goto(`http://localhost:5173/?sala=${room}`, { waitUntil: 'domcontentloaded' });
  await eva.waitForFunction(removed, { timeout: 5000 });
  const backMs = Date.now() - kickStart;
  check('expulso que volta pelo convite vê o aviso logo', backMs < 2500, `${backMs} ms`);
  await eva.close();

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
  check('resultado sem valores de poder', !(await ana.$('.row-power')) && !(await ana.$('.result-compare .power-meter')));
  // Todos os palpites de uma vez: tira de acertos na classificação e matriz personagem × jogador.
  check('classificação com a tira de acertos de cada um', (await ana.$$('.party-podium .hit-strip .seg')).length === 20);
  const matrix = await ana.$$eval('.party-matrix tbody tr', (rows) => rows.map((r) => r.querySelectorAll('td .hit-chip').length));
  check('matriz: 10 personagens × 2 jogadores', matrix.length === 10 && matrix.every((n) => n === 2), matrix.join(','));
  // Lista detalhada: uma por vez, a sua por padrão; tocar no jogador (classificação ou matriz) troca.
  const listTitle = () => text(ana, '.party-comparison .compare-pick-label');
  const matrixSelected = () => ana.$eval('.matrix-player[aria-pressed="true"]', (el) => el.getAttribute('aria-label'));
  check('pódio mostra a sua lista por padrão', (await listTitle()) === 'Seu ranking', await listTitle());
  await ana.click(`.party-podium .row-selectable ::-p-text(${nick('Bruno')})`);
  await sleep(300);
  const brunoList = await ana.$$eval('.party-comparison .row-compare .hit-chip', (els) => els.length);
  check('tocar no jogador mostra a lista dele', (await listTitle()) === `Ranking de ${nick('Bruno')}` && brunoList === 10, await listTitle());
  check('matriz marca o jogador escolhido', (await matrixSelected()) === nick('Bruno'), await matrixSelected());
  await ana.click(`.matrix-player[aria-label="${nick('Ana')}"]`);
  await sleep(300);
  check('tocar no jogador da matriz troca a lista', (await listTitle()) === 'Seu ranking', await listTitle());
  check('uma lista por vez', (await ana.$$('.party-comparison .result-compare')).length === 1);
  check('pódio da party sem scroll horizontal no celular', (await overflowX(bruno)) <= 0);
  await bruno.click(HOME);
  await bruno.waitForSelector('.play-buttons');
  await sleep(500);
  check('"Início" sai da sala', (await text(ana, '.row.offline .player-name')) === nick('Bruno'));
  // Dono: "Voltar para o lobby" ao lado de "Nova partida"; no lobby, quem saiu já não aparece.
  await ana.click('.party-actions-row ::-p-text(Voltar para o lobby)');
  await ana.waitForSelector('.party-settings');
  check('dono volta ao lobby, sem quem saiu', (await ana.$$('.party-player')).length === 1, String((await ana.$$('.party-player')).length));

  // ---------- Loja ----------
  section('Loja');
  await ana.click(HOME);
  await ana.waitForSelector('.profile-bar');
  // A party rendeu conquistas: o aviso aparece na home até a Ana fechar.
  const toast = await ana.waitForSelector('.achievement-unlocked [data-achievement="first-game"]', { timeout: 8000 }).catch(() => null);
  check('conquista da party: aviso na home', Boolean(toast));
  if (toast) {
    await ana.click('.achievement-unlocked .btn');
    await sleep(200);
    check('fechar o aviso some com ele', !(await ana.$('.achievement-unlocked')));
  }
  d1(`UPDATE players SET coins = 2000 WHERE name_key = '${nick('ana').toLowerCase()}'`);
  await ana.reload({ waitUntil: 'networkidle0' });
  await ana.waitForSelector('.profile-bar .coins');
  await ana.click('.profile-nav [data-nav="shop"]');
  await ana.waitForSelector('.shop');
  // Fora da home a barra continua no canto (com o Início): não pode cobrir o título nem a loja.
  const overlaps = await ana.evaluate(() => {
    const bar = document.querySelector('.profile-bar').getBoundingClientRect();
    const hit = (sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return r.left < bar.right && bar.left < r.right && r.top < bar.bottom && bar.top < r.bottom;
    };
    return { title: hit('.app-header h1'), shop: hit('.shop') };
  });
  check(
    'loja: barra com a loja destacada, sem cobrir título nem conteúdo',
    !overlaps.title && !overlaps.shop && Boolean(await ana.$('.profile-nav [data-nav="shop"][aria-current="page"]')),
    JSON.stringify(overlaps),
  );

  /** Espera o botão do item mostrar `label` (e não estar carregando). Devolve o texto final, mesmo se não chegar. */
  async function waitAction(item, label) {
    await ana
      .waitForFunction(
        (el, want) => {
          const b = el.querySelector('.shop-action');
          return b && b.getAttribute('aria-busy') !== 'true' && !b.disabled && b.textContent.trim() === want;
        },
        { timeout: 8000 },
        item,
        label,
      )
      .catch(() => {});
    return text(item, '.shop-action');
  }

  /** Compra (comprar → confirmar) e equipa um item da loja, esperando cada passo terminar no servidor. */
  async function buyAndEquip(item) {
    await (await item.$('.shop-action')).click();
    await waitAction(item, 'Confirmar?');
    await (await item.$('.shop-action')).click();
    await waitAction(item, 'Equipar');
    await (await item.$('.shop-action')).click();
    return waitAction(item, 'Equipado');
  }
  /** Item da loja (cor, moldura ou título) pelo nome. */
  async function shopItem(label) {
    const item = await ana.$(`[data-label="${label}"]`);
    if (!item) throw new Error(`Item não encontrado na loja: ${label}`);
    return item;
  }
  const tabs = async (i) => (await ana.$$('.shop-tabs .mode-option'))[i].click();
  const filterBy = async (i) => (await ana.$$('.shop-filter-option'))[i].click();

  await ana.waitForSelector('.shop-list .shop-item .shop-action');
  check('cor do nick sem avatar repetido', !(await ana.$('.shop-list .player-frame')));
  const nameColor = await buyAndEquip(await shopItem('Fogo'));
  check('compra e equipa cor do nick (Fogo)', nameColor === 'Equipado', nameColor ?? '');
  await filterBy(1);
  check('filtro "Obtidos" mostra só o que tem', (await ana.$$('.shop-list .shop-item')).length === 1);
  await filterBy(2);
  check('filtro "Não obtidos" esconde o que tem', !(await ana.$('[data-label="Fogo"]')));
  await filterBy(0);
  await tabs(1);
  await sleep(200);
  check('moldura sem avatar do jogador', Boolean(await ana.$('.shop-frame-empty')) && !(await ana.$('.shop-list .avatar')));
  check('compra e equipa moldura (Lendária)', (await buyAndEquip(await shopItem('Lendária'))) === 'Equipado');
  await tabs(2);
  await sleep(200);
  check('títulos separados por categoria', (await ana.$$('.shop-group')).length === 6);
  check('prêmio de conquista mostra qual conquista dá', (await text(ana, '[data-label="Constante"] .shop-lock')) === 'Conquista: Constante');
  const [row1, row2] = await ana.$$eval('.shop-rows .shop-row', (els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().top));
  check('2 títulos por linha no computador', Math.abs(row1 - row2) < 2, `${row1} / ${row2}`);
  check('compra e equipa título', (await buyAndEquip(await shopItem('Iniciante Próspero'))) === 'Equipado');
  await tabs(3);
  await sleep(200);
  check('emblemas: ícone SVG', Boolean(await ana.$('[data-label="Estrela"] .shop-badge-sample svg')));
  check('compra e equipa emblema', (await buyAndEquip(await shopItem('Estrela'))) === 'Equipado');
  await tabs(4);
  await sleep(200);
  check(
    'avatares por categoria, recolhidos',
    (await ana.$$('.shop-cat-header')).length === 4 && !(await ana.$('.shop-avatars')),
  );
  await ana.click('.shop-cat-header[data-group="Animes"]');
  await (await ana.waitForSelector('.shop-subcat-header[data-group="One Piece"]')).click();
  await sleep(200);
  check('abrir uma obra mostra os avatares dela', (await ana.$$('.shop-avatars .shop-avatar')).length > 5);
  await ana.type('.shop-search', 'son goku');
  await sleep(300);
  check('compra e equipa avatar', (await buyAndEquip((await ana.$$('.shop-avatars .shop-avatar'))[0])) === 'Equipado');
  const balance = await text(ana, '.shop-balance .coins');
  check('saldo descontado (2000 − 250 − 600 − 50 − 60 − 50)', balance === '990', balance ?? '');

  await ana.click(HOME);
  await ana.waitForSelector('.profile-bar .player-tag img');
  const tag = await ana.$eval('.profile-bar .player-tag', (el) => el.innerHTML);
  check('barra de perfil mostra o visual', tag.includes('cosmetic-name-fire') && tag.includes('cosmetic-frame-legend') && tag.includes('goku'));
  check('título aparece embaixo do nick', (await text(ana, '.profile-bar .player-title')) === 'Iniciante Próspero');
  check('emblema aparece ao lado do nick', Boolean(await ana.$('.profile-bar .player-name-line .cosmetic-badge-star')));

  /** Abre a tela Minha conta pelo menu do perfil (convidado: "Nick e criar conta"). */
  async function openAccount(page, label = 'Minha conta') {
    if (!(await page.$('.profile-bar'))) {
      await page.click(HOME);
      await page.waitForSelector('.profile-bar');
    }
    await page.waitForSelector('.profile-bar-me:not([disabled])');
    if (!(await page.$('.profile-menu'))) await page.click('.profile-bar-me');
    await (await page.waitForSelector(`.profile-menu ::-p-text(${label})`)).click();
    await page.waitForSelector('.account');
  }

  // ---------- Conta e sincronização ----------
  section('Conta e sincronização');
  // Bruno (convidado, celular) cria a conta pela tela Minha conta.
  await openAccount(bruno, 'Nick e criar conta');
  await bruno.waitForSelector('.sync-password-form');
  check('celular: tela da conta sem scroll horizontal', (await overflowX(bruno)) <= 0);
  await bruno.type('input[aria-label="Nova senha"]', PASSWORD);
  await bruno.type('input[aria-label="Repita a senha"]', PASSWORD);
  await bruno.waitForSelector('.sync-password-form .btn-primary:not([disabled])', { timeout: 15000 }); // anti-bot
  await bruno.click('.sync-password-form .btn-primary');
  await bruno.waitForSelector('.account-devices');
  check('convidado cria a conta: a tela vira a da conta (senha, aparelhos)', Boolean(await bruno.$('input[aria-label="Senha atual"]')));
  check('celular: tela da conta (logada) sem scroll horizontal', (await overflowX(bruno)) <= 0);
  await bruno.click(HOME);
  await bruno.waitForSelector('.profile-bar .coins');
  check('depois de criar a conta, a home tem saldo', !(await bruno.$('.profile-guest')));
  // Celular: no topo só nick (inteiro) e saldo; a navegação é uma barra de abas fixa no rodapé, com os nomes.
  const rect = (sel) => bruno.$eval(sel, (el) => el.getBoundingClientRect().toJSON());
  const me = await rect('.profile-bar-me');
  const coins = await rect('.profile-bar .coins');
  const nav = await rect('.profile-nav');
  const nameFits = await bruno.$eval('.profile-bar .player-name', (el) => el.scrollWidth <= el.clientWidth);
  const labels = await bruno.$$eval('.profile-nav-label', (els) => els.every((el) => el.getBoundingClientRect().width > 1));
  check(
    'celular: nick inteiro ao lado do saldo, abas fixas no rodapé com nome',
    me.right <= coins.left && nameFits && labels && Math.round(nav.bottom) === 844 && nav.left === 0 && nav.right === 390,
    JSON.stringify({ me: me.right, coins: coins.left, nameFits, labels, nav: [nav.left, nav.right, nav.bottom] }),
  );
  // Engrenagem dentro da faixa do perfil, depois do saldo (embaixo ela cobria a aba do Arcade).
  const gear = await rect('.settings-toggle');
  const strip = await rect('.profile-bar');
  const gearOff = Math.round(gear.top + gear.height / 2 - (coins.top + coins.height / 2));
  check(
    'celular: engrenagem na faixa do perfil, ao lado do saldo, longe das abas',
    gear.left >= coins.right && gear.right <= strip.right && gear.top >= strip.top && Math.abs(gearOff) <= 2 && gear.bottom < nav.top,
    JSON.stringify({ gear: [gear.left, gear.top, gear.right, gear.bottom], coins: [coins.right, coins.top, coins.bottom], strip: [strip.top, strip.right, strip.bottom], gearOff }),
  );
  await bruno.click('.settings-toggle');
  const panel = await (await bruno.waitForSelector('.settings-panel')).evaluate((el) => el.getBoundingClientRect().toJSON());
  check('celular: painel das configurações abre para baixo, dentro da tela', panel.top >= gear.bottom && panel.left >= 0 && panel.right <= 390 && (await overflowX(bruno)) <= 0, JSON.stringify([panel.left, panel.top, panel.right]));
  await bruno.keyboard.press('Escape');
  await bruno.click('.profile-bar-me');
  await bruno.waitForSelector('.profile-menu', { visible: true });
  check('celular: menu abre como sanfona', (await bruno.$eval('.profile-menu', (el) => getComputedStyle(el).position)) === 'static');
  await bruno.keyboard.press('Escape');

  // Ana força a sincronização depois de uma mudança feita "em outro dispositivo".
  d1(`UPDATE players SET coins = 777 WHERE name_key = '${nick('ana').toLowerCase()}'`);
  await openAccount(ana);
  check('conta: um aparelho conectado', (await text(ana, '.account-devices')) === 'Conectada só neste aparelho.');
  await ana.click('.account-actions ::-p-text(Forçar sincronização)');
  await ana.waitForSelector('.account-section ::-p-text(Sincronizado)');
  await ana.click(HOME);
  await ana.waitForSelector('.profile-bar .coins');
  check('forçar sincronização traz o saldo do servidor', (await text(ana, '.profile-bar .coins')) === '777');

  // Conquistas: botão ao lado da Loja, cartões por grupo.
  await ana.click('.profile-nav ::-p-text(Conquistas)');
  // Abre na hora com o skeleton (cartões vazios pulsando): espera os de verdade.
  await ana.waitForSelector('.achievements[aria-busy="false"] .achievements-grid');
  check(
    'conquistas: 11 cartões em 5 grupos, a da primeira partida desbloqueada',
    (await ana.$$('.achievement-card')).length === 11 &&
      (await ana.$$('.achievements-group')).length === 5 &&
      Boolean(await ana.$('.achievement-card.done[data-achievement="first-game"]')),
  );
  const [card1, card2] = await ana.$$eval('.achievements-group:first-of-type .achievement-card', (els) => els.map((e) => e.getBoundingClientRect().top));
  check('conquistas: 2 cartões por linha no computador', Math.abs(card1 - card2) < 2, `${card1} / ${card2}`);
  await ana.click(HOME);
  await ana.waitForSelector('.profile-bar .coins');
  const barLayout = await ana.$eval('.profile-bar', (el) => {
    const r = el.getBoundingClientRect();
    const title = document.querySelector('.app-header h1').getBoundingClientRect();
    return { fits: r.right <= window.innerWidth, clear: r.bottom <= title.top || r.left >= title.right || r.right <= title.left };
  });
  check('barra com Loja, Conquistas e Arcade cabe sem cobrir o título', barLayout.fits && barLayout.clear, JSON.stringify(barLayout));

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
  await celular.waitForSelector('.profile-bar-me:not([disabled])');
  await celular.click('.profile-nav [data-nav="achievements"]');
  await celular.waitForSelector('.achievements[aria-busy="false"] .achievements-grid');
  check('celular: conquistas sem scroll horizontal', (await overflowX(celular)) <= 0);
  // Da tela de conquistas direto para a loja, pela barra (a tela atual fica destacada).
  check('celular: conquistas destacada na barra', Boolean(await celular.$('.profile-nav [data-nav="achievements"][aria-current="page"]')));
  await celular.click('.profile-nav [data-nav="shop"]');
  await celular.waitForSelector('.shop-tabs');
  const shopTabs = await celular.$$eval('.shop-tabs .mode-option', (els) => els.map((e) => [e.textContent, e.scrollWidth, e.clientWidth]));
  check(
    'celular: as 5 abas da loja cabem',
    shopTabs.length === 5 && shopTabs.every(([, scroll, client]) => scroll <= client) && (await overflowX(celular)) <= 0,
    JSON.stringify(shopTabs),
  );
  await celular.close();

  // ---------- Desafio diário e resultado ----------
  section('Desafio diário e resultado');
  // O Edge no Windows tem Web Share de arquivos (abriria o menu do sistema): testa o caminho de baixar o PNG.
  await ana.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }));
  // O Diário é uma aba como Solo e Party: abre o painel com a regra e o Jogar.
  await ana.click('.btn-daily');
  await ana.waitForSelector('.daily-entry .daily-rules');
  check('Diário abre o painel com a regra e o tempo até o próximo', /^Novo desafio em /.test((await text(ana, '.daily-next')) ?? ''));
  await (await ana.waitForSelector('.daily-entry .btn-daily-play:not([disabled])')).click();
  await placeAll(ana);
  await ana.waitForSelector('.coins-earned');
  check('título mostra o desafio', (await text(ana, '.title-eyebrow')) === 'Desafio diário · Animes');
  check('resultado mostra a posição no desafio', /^Desafio diário · #\d+$/.test((await text(ana, '.ranking-status')) ?? ''));
  check('ranking abre na aba Desafio', (await text(ana, '.leaderboard-periods [aria-selected="true"]')) === 'Desafio');
  check('desafio sem "Jogar de novo"', !(await ana.$('.score-actions')));
  await sleep(1000);
  // placeAll coloca na ordem do sorteio: a pontuação varia e pode ficar abaixo do mínimo para ganhar moedas.
  check('resultado mostra moedas (ou o aviso do mínimo)', /^\+\d+$|\d+\+ pontos/.test((await text(ana, '.coins-earned')) ?? ''), await text(ana, '.coins-earned'));
  check('resultado solo sem valores de poder', !(await ana.$('.row-power')));

  // Compartilhar imagem: sem Web Share de arquivos, baixa o PNG de story.
  await ana.waitForSelector('.share-image:not([disabled])', { timeout: 8000 });
  const shareLabels = `${await text(ana, '.share-image')} / ${await text(ana, '.share-text')}`;
  check('botões de compartilhar', shareLabels === 'Compartilhar imagem / Compartilhar resultado', shareLabels);
  const downloads = mkdtempSync(join(tmpdir(), 'e2e-share-'));
  const cdp = await ana.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloads,
    browserContextId: ana.browserContext().id,
  });
  await ana.click('.share-image');
  let png = null;
  for (let i = 0; i < 25 && !png; i++) {
    await sleep(200);
    const done = readdirSync(downloads).find((f) => f.endsWith('.png'));
    if (done) png = readFileSync(join(downloads, done));
  }
  // Largura e altura ficam no cabeçalho IHDR do PNG (bytes 16–23).
  const size = png ? `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}` : 'sem arquivo';
  check('imagem de compartilhar é um PNG 1080x1920', size === '1080x1920', size);
  rmSync(downloads, { recursive: true, force: true });

  // Compartilhar resultado: copia o texto (sem nomes, para não dar spoiler).
  await ana.browserContext().overridePermissions('http://localhost:5173', ['clipboard-read', 'clipboard-sanitized-write']);
  await ana.bringToFront();
  await ana.click('.share-text');
  await sleep(300);
  check('compartilhar resultado confirma a cópia', (await text(ana, '.share-text')) === 'Copiado!', await text(ana, '.share-text'));
  const copied = await ana.evaluate(() => navigator.clipboard.readText()).catch((e) => e.message);
  check(
    'texto copiado tem pontuação, 10 quadrados e o link',
    /^Fiz \d+\/1000 no Powerdle/.test(copied) && [...(copied.split(/\r?\n/)[1] ?? '')].length === 10 && copied.includes('localhost:5173'),
    JSON.stringify(copied),
  );

  // O ranking aparece na hora como skeleton: espera carregar (e recarregar depois do envio) com a Ana nele.
  await ana.waitForSelector('.leaderboard [aria-busy="false"] :is(.row.highlight, .podium-step.you)', { timeout: 8000 });
  check(
    'ranking mostra o visual do jogador',
    Boolean(await ana.$('.leaderboard :is(.row.highlight, .podium-step.you) .cosmetic-frame-legend')),
  );
  const podium = await ana.$$eval('.leaderboard-podium .podium-step', (els) => els.length);
  const firstRow = await text(ana, '.leaderboard-rows .row .rank-badge');
  const positions = await ana.$$eval('.leaderboard-rows .row', (els) => els.length);
  check(
    'pódio com 3 degraus, lista do 4º ao 10º (vazias se faltar jogador)',
    podium === 3 && firstRow === '4' && positions >= 7,
    `${podium} / ${firstRow} / ${positions}`,
  );
  check('Desafio mostra o tempo no pódio', /^\d+s$|^\d+:\d\d$/.test((await text(ana, '.leaderboard-podium .podium-detail')) ?? ''));
  await ana.click('.leaderboard-periods button:nth-child(2)');
  await ana.waitForSelector('.leaderboard-podium .podium-detail ::-p-text(dia)');
  check('aba Acumulado mostra os dias', true);
  await ana.click('.leaderboard-periods button:nth-child(1)');
  await ana.click('.leaderboard-help-toggle');
  check('"?" explica o desempate e o acumulado', /mais rápido/.test((await text(ana, '.leaderboard-help')) ?? ''));
  await ana.click('.leaderboard-help-toggle');

  // Reportar imagem: escolhe o personagem e o motivo; vai para a fila de moderação (conferida no Admin).
  await ana.click('.result > .report-link .link-button');
  await ana.waitForSelector('.report-form select');
  const reportOptions = await ana.$$eval('.report-form select option:not([disabled])', (els) => els.map((el) => el.value));
  check('reportar imagem lista os 10 personagens', reportOptions.length === 10, String(reportOptions.length));
  await ana.select('.report-form select', reportOptions[0]);
  await ana.click('.report-reasons ::-p-text(Personagem errado)');
  await ana.click('.report-form .btn-primary');
  await ana.waitForSelector('.report-form ::-p-text(Obrigado)');
  check('reportar imagem confirma o envio', true);

  // ---------- Desafio diário ----------
  section('Desafio diário');
  await ana.click(HOME);
  await ana.waitForSelector('.btn-daily.done', { timeout: 5000 });
  await ana.click('.btn-daily');
  await ana.waitForSelector('.daily-entry .daily-done ::-p-text(pts)', { timeout: 5000 });
  check('na home, o Diário mostra a pontuação de hoje no lugar do Jogar', !(await ana.$('.btn-daily-play')));
  await ana.setViewport({ width: 390, height: 844 });
  await sleep(300);
  const playTabs = await ana.$$eval('.play-buttons .btn', (els) => ({
    fit: els.every((el) => el.scrollWidth <= el.clientWidth),
    row: new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))).size === 1,
  }));
  check('celular: Solo / Party / Diário numa linha, sem scroll horizontal', playTabs.fit && playTabs.row && (await overflowX(ana)) <= 0, JSON.stringify(playTabs));
  await ana.setViewport({ width: 1280, height: 860 });
  // Solo abre o painel com a dificuldade (lembrada no navegador: a sala acima foi criada no fácil) e o iniciar.
  await ana.click('.btn-solo');
  await ana.waitForSelector('.solo-entry .difficulty-picker');
  check('Solo abre a dificuldade, lembrando a última', (await text(ana, '.difficulty-option.selected')) === 'Fácil' && Boolean(await ana.$('.setting-hint')));
  await ana.click('.difficulty-option:nth-child(2)');
  check('trocar a dificuldade', (await text(ana, '.difficulty-option.selected')) === 'Médio');
  await ana.click('.btn-party');
  check('Solo e Party: um painel por vez', !(await ana.$('.solo-entry')) && Boolean(await ana.$('.party-entry')));
  await ana.click('.btn-solo');
  await ana.click('.solo-entry .btn-primary');
  await placeAll(ana);
  await ana.waitForSelector('.coins-earned');
  check('Solo é partida normal', (await text(ana, '.title-eyebrow')) === 'Animes');
  check('Solo sem posição no ranking, com "Jogar de novo"', !(await ana.$('.ranking-status')) && Boolean(await ana.$('.score-actions .btn-primary')));
  await ana.click(HOME);

  // ---------- Arcade ----------
  section('Arcade');
  await ana.waitForSelector('.profile-bar .coins');
  await (await ana.waitForSelector('.profile-bar ::-p-text(Arcade)')).click();
  await ana.waitForSelector('.adult-gate');
  check('Arcade pede 18+ antes de mostrar os jogos', !(await ana.$('.casino-machine')));
  await ana.click('.adult-confirm');
  await ana.waitForSelector('.casino-machine');
  check('pote acumulado aparece', /\d/.test((await text(ana, '.casino-pot .coins')) ?? ''));
  const faces = await ana.$$eval('.casino-reel .casino-icon', (els) =>
    els.map((el) => ({ text: el.textContent, w: el.getBoundingClientRect().width, tier: /tier-(ss|s|a|b|c|d)\b/.test(el.className) })),
  );
  check('rolos mostram os badges dos tiers', faces.length === 3 && faces.every((f) => /^(SS|[SABCD])$/.test(f.text) && f.w >= 60 && f.tier), JSON.stringify(faces));
  const spinResponse = ana.waitForResponse((r) => r.url().includes('/api/slots/spin'));
  await ana.click('.casino-spin');
  check('rolos giram', Boolean(await ana.$('.casino-strip')));
  const { coins: serverCoins } = await (await spinResponse).json();
  await ana.waitForFunction(() => !document.querySelector('.casino-strip'), { timeout: 8000 });
  const spinText = await text(ana, '.casino-result');
  check('rolos param e mostram o resultado', Boolean(spinText) && spinText !== 'Girando...', spinText ?? '');
  const balanceAfter = Number((await text(ana, '.casino-balance .coins'))?.replace(/\D/g, ''));
  check('saldo na tela = saldo do servidor depois do giro', balanceAfter === serverCoins, `${balanceAfter} / ${serverCoins}`);
  await ana.click('.casino-marquee .leaderboard-help-toggle');
  check('"?" mostra a tabela de prêmios', (await ana.$$('.casino-table tbody tr')).length === 6);

  // Plinko (segunda aba do Arcade).
  await ana.click('.arcade-tabs .mode-option:nth-child(2)');
  await ana.waitForSelector('.plinko-board svg');
  check('tabuleiro com 13 casas e os pinos', (await ana.$$('.plinko-bucket')).length === 13 && (await ana.$$('.plinko-peg')).length > 50);
  const dropResponse = ana.waitForResponse((r) => r.url().includes('/api/plinko/drop'));
  await ana.click('.plinko-drop');
  const drop = await (await dropResponse).json();
  await ana.waitForSelector('.plinko-ball', { timeout: 3000 });
  check('bolinha cai e o risco trava enquanto cai', Boolean(await ana.$('.plinko-risks button:disabled')));
  await ana.waitForFunction(() => !document.querySelector('.plinko-ball') && document.querySelector('.plinko-history li'), { timeout: 8000 });
  // As casas são os únicos <g> do SVG: nth-of-type conta só elas.
  check('casa sorteada acende', Boolean(await ana.$(`.plinko-bucket.hit:nth-of-type(${drop.slot + 1})`)), String(drop.slot));
  const plinkoBalance = Number((await text(ana, '.casino-balance .coins'))?.replace(/D/g, ''));
  check('saldo na tela = saldo do servidor depois da bolinha', plinkoBalance === drop.coins, `${plinkoBalance} / ${drop.coins}`);
  // Cliques rápidos seguidos: várias bolinhas ao mesmo tempo, sem erro na página.
  const burst = [];
  const burstDone = new Promise((resolve) => ana.on('response', (r) => r.url().includes('/api/plinko/drop') && burst.push(r) === 3 && resolve()));
  for (let i = 0; i < 3; i++) await ana.click('.plinko-drop');
  await burstDone;
  const lastCoins = (await burst.at(-1).json()).coins;
  check('várias bolinhas caem juntas', (await ana.$$('.plinko-ball')).length >= 2);
  await ana.waitForFunction(() => !document.querySelector('.plinko-ball'), { timeout: 8000 });
  const burstBalance = Number((await text(ana, '.casino-balance .coins'))?.replace(/\D/g, ''));
  check('cliques rápidos: página inteira e saldo certo', Boolean(await ana.$('.plinko-board svg')) && burstBalance === lastCoins, `${burstBalance} / ${lastCoins}`);
  await ana.click('.casino-marquee .leaderboard-help-toggle');
  check('"?" mostra a tabela por risco', (await ana.$$('.plinko-table tbody tr')).length === 7);
  await ana.setViewport({ width: 390, height: 844 });
  await sleep(300);
  const board = await ana.$eval('.plinko-board svg', (el) => el.getBoundingClientRect().width);
  check('Plinko no celular: sem scroll horizontal e tabuleiro legível', (await overflowX(ana)) <= 0 && board >= 300, String(board));
  await ana.setViewport({ width: 1280, height: 860 });

  // Raspadinha (terceira aba do Arcade).
  await ana.click('.arcade-tabs .mode-option:nth-child(3)');
  await ana.waitForSelector('.scratch-grid');
  check('cartela com 9 casas cobertas', (await ana.$$('.scratch-cell')).length === 9 && Boolean(await ana.$('.scratch-cover')));
  const cardResponse = ana.waitForResponse((r) => r.url().includes('/api/scratch/buy'));
  await ana.click('.scratch-buy');
  const card = await (await cardResponse).json();
  await ana.waitForSelector('.scratch-cover.active');
  const hiddenBalance = Number((await text(ana, '.casino-wallet .coins'))?.replace(/\D/g, ''));
  check(
    'cartela comprada: aposta trava e o prêmio fica escondido no saldo',
    Boolean(await ana.$('.casino-bet button:disabled')) && hiddenBalance === card.coins - card.prize,
    `${hiddenBalance} / ${card.coins - card.prize}`,
  );
  // Raspa a primeira casa com o mouse, em zigue-zague, até ela abrir.
  const first = await ana.$eval('.scratch-cell', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  await ana.mouse.move(first.x + 4, first.y + 4);
  await ana.mouse.down();
  for (let y = 4; y < first.h; y += 10) {
    await ana.mouse.move(first.x + first.w - 4, first.y + y, { steps: 4 });
    await ana.mouse.move(first.x + 4, first.y + y + 5, { steps: 4 });
  }
  await ana.mouse.up();
  await ana.waitForSelector('.scratch-cell.open', { timeout: 3000 }).catch(() => null);
  check('raspar abre a casa', Boolean(await ana.$('.scratch-cell:first-child.open')));
  await ana.click('.scratch-reveal');
  await ana.waitForFunction(() => !document.querySelector('.scratch-cover') && document.querySelectorAll('.scratch-cell .casino-icon').length === 9, { timeout: 3000 });
  const shownCells = await ana.$$eval('.scratch-cell .casino-icon', (els) => els.map((el) => el.textContent.toLowerCase()));
  check('revelar tudo mostra a cartela do servidor', JSON.stringify(shownCells) === JSON.stringify(card.cells), JSON.stringify(shownCells));
  check('trio vencedor acende', (await ana.$$('.scratch-cell.win')).length === (card.symbol ? 3 : 0));
  const scratchBalance = Number((await text(ana, '.casino-wallet .coins'))?.replace(/\D/g, ''));
  check('saldo na tela = saldo do servidor depois da cartela', scratchBalance === card.coins, `${scratchBalance} / ${card.coins}`);
  await ana.click('.casino-marquee .leaderboard-help-toggle');
  check('"?" mostra a tabela de trios', (await ana.$$('.scratch-table tbody tr')).length === 6);
  await ana.setViewport({ width: 390, height: 844 });
  await sleep(300);
  const cardWidth = await ana.$eval('.scratch-window', (el) => el.getBoundingClientRect().width);
  check('Raspadinha no celular: sem scroll horizontal e cartela legível', (await overflowX(ana)) <= 0 && cardWidth >= 280, String(cardWidth));
  const tabsFit = await ana.$$eval('.arcade-tabs .mode-option', (els) => els.every((el) => el.scrollWidth <= el.clientWidth));
  check('abas do Arcade cabem no celular (texto dentro do botão)', tabsFit);
  await ana.setViewport({ width: 1280, height: 860 });

  // Mystery Box (quarta aba do Arcade).
  await ana.click('.arcade-tabs .mode-option:nth-child(4)');
  await ana.waitForSelector('.gacha-box');
  const boxResponse = ana.waitForResponse((r) => r.url().includes('/api/gacha/open'));
  await ana.click('.gacha-open');
  check('caixa treme enquanto abre', Boolean(await ana.$('.gacha-box.opening')));
  const box = await (await boxResponse).json();
  await ana.waitForSelector('.gacha-reveal', { timeout: 8000 });
  check('revela a raridade sorteada', Boolean(await ana.$(`.gacha-reveal.rarity-${box.rarity} .gacha-item`)), box.rarity);
  const boxBalance = Number((await text(ana, '.gacha-controls .casino-hint .coins'))?.replace(/\D/g, ''));
  check('saldo na tela = saldo do servidor depois da caixa', boxBalance === box.profile.coins, `${boxBalance} / ${box.profile.coins}`);

  // ---------- Trocar nick e sair ----------
  section('Trocar nick e sair');
  await ana.click(HOME);
  await ana.waitForSelector('.profile-bar .coins');
  await sleep(800);
  const coinsBefore = await text(ana, '.profile-bar .coins');
  await openAccount(ana);
  await ana.$eval('input[aria-label="Novo nick"]', (el) => (el.value = ''));
  await ana.type('input[aria-label="Novo nick"]', nick('Bruno'));
  await ana.click('.change-nick .btn-primary');
  await ana.waitForSelector('.change-nick .error');
  check('não troca para nick de outra conta', (await text(ana, '.change-nick .error')) === 'Esse nick já é de outra conta');
  await ana.$eval('input[aria-label="Novo nick"]', (el) => (el.value = ''));
  await ana.type('input[aria-label="Novo nick"]', nick('AnaNova'));
  await ana.click('.change-nick .btn-primary');
  await ana.waitForSelector('.change-nick ::-p-text(Salvo)');
  await ana.click(HOME);
  await ana.waitForSelector(`.profile-bar-me ::-p-text(${nick('AnaNova')})`);
  await sleep(800);
  const coinsAfter = await text(ana, '.profile-bar .coins');
  check('troca o nick da conta e mantém as moedas', coinsAfter === coinsBefore, `${coinsBefore} → ${coinsAfter}`);

  await ana.click('.profile-bar-me');
  await (await ana.waitForSelector('.profile-leave')).click();
  await ana.waitForSelector('#nick');
  check('sair da conta volta para a tela do nick', Boolean(await ana.$('.nick-login')));
  await ana.type('#nick', nick('AnaNova'));
  await ana.click('.nick-login');
  await ana.waitForSelector('input[aria-label="Senha"]');
  check('depois de sair, entrar pede a senha', !(await ana.$('input[aria-label="Confirmar senha"]')));

  // ---------- Excluir conta ----------
  section('Excluir conta');
  const dora = await b.page(PHONE);
  await dora.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await chooseNick(dora, nick('Dora'));
  await dora.waitForSelector('.profile-bar .coins');
  const openDelete = async () => {
    await openAccount(dora);
    await (await dora.waitForSelector('.delete-account-toggle')).click();
    await dora.waitForSelector('.delete-account input[type=password]');
  };
  await openDelete();
  check('excluir conta: aviso e senha, sem scroll horizontal no celular', Boolean(await text(dora, '.delete-account-warning')) && (await overflowX(dora)) <= 0);
  // Campo e botões dentro do painel da conta (celular e computador).
  const insidePanel = () =>
    dora.evaluate(() => {
      const panel = document.querySelector('.delete-account').closest('.account-section').getBoundingClientRect();
      return [...document.querySelectorAll('.delete-account input, .delete-account button, .delete-account p')].every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= panel.left - 1 && r.right <= panel.right + 1;
      });
    });
  check('excluir conta: campo e botões dentro do painel no celular', await insidePanel());
  // Trocar de celular para computador recarrega a página (volta para a home): abre a tela e o formulário de novo.
  await dora.setViewport(DESKTOP);
  if (!(await dora.$('.delete-account input[type=password]'))) await openDelete();
  check('excluir conta: campo e botões dentro do painel no computador', await insidePanel());
  await dora.type('.delete-account input[type=password]', 'senha-errada');
  await dora.click('.delete-account .btn-danger');
  await dora.waitForSelector('.delete-account .error');
  check('senha errada não exclui', (await text(dora, '.delete-account .error')) === 'Senha incorreta');
  await dora.$eval('.delete-account input[type=password]', (el) => (el.value = ''));
  await dora.type('.delete-account input[type=password]', PASSWORD);
  await dora.click('.delete-account .btn-danger');
  await dora.waitForSelector('#nick');
  const doraStatus = await (await fetch(`http://localhost:5173/api/players/status?name=${nick('Dora')}`)).json();
  check('conta excluída: volta para o nick e o nick fica livre', doraStatus.exists === false);
  await dora.close();

  // ---------- Celular ----------
  section('Celular');
  await bruno.reload({ waitUntil: 'networkidle0' });
  await bruno.waitForSelector('.profile-bar');
  check('home sem scroll horizontal', (await overflowX(bruno)) <= 0);
  // Modo Pokémon: o painel do Solo mostra as gerações no lugar da dificuldade e a partida sai só das ligadas.
  await bruno.click('.btn-solo');
  await bruno.waitForSelector('.solo-entry .difficulty-picker');
  check('painel do Solo sem scroll horizontal', (await overflowX(bruno)) <= 0);
  // Free for All: escolhe as categorias da mistura (Pokémon vem desligado).
  await bruno.click('.mode-picker ::-p-text(Free for All)');
  await bruno.waitForSelector('.solo-entry .category-picker');
  const ffaOn = () => bruno.$$eval('.category-picker .setting-option.selected', (els) => els.map((el) => el.textContent));
  check('Free for All: Animes, Games e Filmes e Séries ligados', (await ffaOn()).join() === 'Animes,Games,Filmes e Séries', (await ffaOn()).join());
  await bruno.click('.category-picker ::-p-text(Pokémon)');
  check('liga Pokémon no Free for All', (await ffaOn()).includes('Pokémon'));
  await bruno.click('.category-picker ::-p-text(Pokémon)');
  check('seletor de modo e categorias sem scroll horizontal', (await overflowX(bruno)) <= 0);
  await bruno.click('.mode-picker ::-p-text(Pokémon)');
  await bruno.waitForSelector('.solo-entry .gen-picker');
  check('Pokémon troca a dificuldade pelas gerações', !(await bruno.$('.difficulty-picker')));
  check('Pokémon mostra as 9 gerações ligadas', (await bruno.$$('.gen-option.selected')).length === 9);
  await bruno.click('.gen-option:nth-child(2)');
  check('desligar uma geração', (await bruno.$$('.gen-option.selected')).length === 8 && !(await bruno.$('.gen-all.selected')));
  await bruno.click('.gen-all');
  check('"Todas" liga todas', (await bruno.$$('.gen-option.selected')).length === 9);
  await bruno.click('.gen-option:nth-child(2)');
  const genFits = await bruno.$$eval('.gen-picker .setting-option', (els) =>
    els.every((el) => el.getBoundingClientRect().right <= document.documentElement.clientWidth),
  );
  check('gerações cabem no celular', genFits);
  check('home Pokémon sem scroll horizontal', (await overflowX(bruno)) <= 0);
  await bruno.click('.solo-entry .btn-primary');
  await placeAll(bruno);
  await bruno.waitForSelector('.share-image:not([disabled])', { timeout: 8000 });
  const shareFits = await bruno.$$eval('.share-result .btn', (els) =>
    els.map((el) => el.getBoundingClientRect()).every((r) => r.left >= 0 && r.right <= document.documentElement.clientWidth),
  );
  check('botões de compartilhar cabem no celular', shareFits);
  check('resultado sem scroll horizontal', (await overflowX(bruno)) <= 0);

  // ---------- Admin (no dev local, liberado sem o Cloudflare Access) ----------
  section('Admin');
  const admin = await b.page(PHONE);
  await admin.goto('http://localhost:5173/admin', { waitUntil: 'networkidle0' });
  await admin.waitForSelector('.admin-feature');
  check('admin: uma chave por minigame', (await admin.$$('.admin-feature')).length === 4);
  check('admin: não carrega o jogo', !(await admin.$('.app-header')));
  check('admin: chaves sem scroll horizontal no celular', (await overflowX(admin)) <= 0);
  await admin.click('.admin-tabs .mode-option:nth-child(2)');
  await admin.waitForSelector('.admin-tile');
  check('admin: economia mostra os blocos', (await admin.$$('.admin-tile')).length === 4);
  check('admin: economia sem scroll horizontal no celular', (await overflowX(admin)) <= 0);
  await admin.click('.admin-tabs .mode-option:nth-child(3)');
  await admin.type('.admin-toolbar input', nick('bruno').toLowerCase());
  await (await admin.waitForSelector('.admin-player-row')).click();
  await admin.waitForSelector('.admin-facts');
  check('admin: detalhe do jogador', (await text(admin, '.admin-player-title'))?.toLowerCase().startsWith(nick('bruno').toLowerCase()));
  check('admin: jogador sem scroll horizontal no celular', (await overflowX(admin)) <= 0);
  check('admin: suspensão no detalhe do jogador', Boolean(await admin.$('.admin-section ::-p-text(Suspender)')));
  await admin.click('.admin-tabs .mode-option:nth-child(4)');
  await admin.type('.admin-toolbar input', 'abby');
  await (await admin.waitForSelector('.admin-character-row')).click();
  await admin.waitForSelector('.admin-character-form');
  check('admin: edição do personagem com o poder', (await admin.$eval('.admin-character-form input[type=number]', (el) => el.value)) !== '');
  check('admin: personagem sem scroll horizontal no celular', (await overflowX(admin)) <= 0);
  await admin.click('.admin-tabs .mode-option:nth-child(5)');
  await admin.waitForSelector('.admin-report');
  check('admin: a imagem reportada aparece na moderação', Boolean(await admin.$('.admin-report ::-p-text(imagem)')));
  check('admin: moderação sem scroll horizontal no celular', (await overflowX(admin)) <= 0);
  await admin.close();

  check('sem erros no console', b.errors.length === 0, b.errors.join(' | '));
} catch (err) {
  check('fluxo completo sem exceção', false, err.message);
} finally {
  await b.close();
}

finish();
