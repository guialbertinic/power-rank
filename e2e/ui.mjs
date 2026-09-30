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
  // Lista dos outros: uma por vez, a sua por padrão; tocar no jogador troca.
  const listTitle = () => text(ana, '.party-comparison .result-columns .section-title');
  check('pódio mostra a sua lista por padrão', (await listTitle()) === 'Seu ranking', await listTitle());
  await ana.click(`.party-podium .row-selectable ::-p-text(${nick('Bruno')})`);
  await sleep(300);
  const brunoList = await ana.$$eval('.party-comparison .row-yours', (els) => els.length);
  check('tocar no jogador mostra a lista dele', (await listTitle()) === `Ranking de ${nick('Bruno')}` && brunoList === 10, await listTitle());
  check('uma lista por vez', (await ana.$$('.party-comparison .result-columns')).length === 1);
  check('pódio da party sem scroll horizontal no celular', (await overflowX(bruno)) <= 0);
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
  check('títulos separados por categoria', (await ana.$$('.shop-group')).length === 5);
  const [row1, row2] = await ana.$$eval('.shop-rows .shop-row', (els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().top));
  check('2 títulos por linha no computador', Math.abs(row1 - row2) < 2, `${row1} / ${row2}`);
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
  await bruno.waitForSelector('.sync-password-form .btn-primary:not([disabled])', { timeout: 15000 }); // anti-bot
  await bruno.click('.sync-password-form .btn-primary');
  await bruno.waitForSelector('.sync-panel ::-p-text(Conta pronta)');
  check('convidado cria a conta pelo menu', Boolean(await bruno.$('.profile-bar .coins')) && !(await bruno.$('.profile-guest')));
  await bruno.keyboard.press('Escape');
  // Celular: a faixa tem só nick e saldo (sem sobrepor); Loja e Arcade abrem na sanfona.
  const rect = (sel) => bruno.$eval(sel, (el) => el.getBoundingClientRect().toJSON());
  const me = await rect('.profile-bar-me');
  const coins = await rect('.profile-bar .coins');
  const shopHidden = !(await bruno.$eval('.profile-bar-actions .btn', (el) => el.offsetParent));
  check('celular: nick não fica atrás do saldo, Loja fora da faixa', me.right <= coins.left && shopHidden);
  await bruno.click('.profile-bar-me');
  await bruno.waitForSelector('.profile-menu-actions ::-p-text(Loja)', { visible: true });
  check('celular: menu abre como sanfona, com Loja e Arcade', (await bruno.$eval('.profile-menu', (el) => getComputedStyle(el).position)) === 'static');
  await bruno.keyboard.press('Escape');

  // Ana força a sincronização depois de uma mudança feita "em outro dispositivo".
  d1(`UPDATE players SET coins = 777 WHERE name_key = '${nick('ana').toLowerCase()}'`);
  await ana.click('.profile-bar-me');
  await (await ana.waitForSelector('.profile-menu ::-p-text(Sincronizar dispositivo)')).click();
  await ana.click('.sync-force .btn');
  await ana.waitForSelector('.sync-force ::-p-text(Sincronizado)');
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

  // ---------- Desafio diário e resultado ----------
  section('Desafio diário e resultado');
  // O Edge no Windows tem Web Share de arquivos (abriria o menu do sistema): testa o caminho de baixar o PNG.
  await ana.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }));
  await (await ana.waitForSelector('.btn-daily:not([disabled])')).click();
  await placeAll(ana);
  await ana.waitForSelector('.coins-earned');
  check('título mostra o desafio', (await text(ana, '.title-eyebrow')) === 'Desafio diário · Animes');
  check('resultado mostra a posição no desafio', /^Desafio diário · #\d+$/.test((await text(ana, '.ranking-status')) ?? ''));
  check('ranking abre na aba Desafio', (await text(ana, '.leaderboard-periods [aria-selected="true"]')) === 'Desafio');
  check('desafio sem "Jogar de novo"', !(await ana.$('.score-actions')));
  await sleep(1000);
  check('resultado mostra moedas (ou o aviso de 500+)', /^\+\d+$|500\+/.test((await text(ana, '.coins-earned')) ?? ''));
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
    /^Fiz \d+\/1000 no Power Rank/.test(copied) && [...(copied.split(/\r?\n/)[1] ?? '')].length === 10 && copied.includes('localhost:5173'),
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

  // ---------- Desafio diário ----------
  section('Desafio diário');
  await ana.click('.home-button');
  await ana.waitForSelector('.btn-daily[disabled] ::-p-text(pts)', { timeout: 5000 });
  check('na home, o desafio fica travado com a pontuação', true);
  await ana.click('.play-buttons .btn-primary');
  await placeAll(ana);
  await ana.waitForSelector('.coins-earned');
  check('Solo é partida normal', (await text(ana, '.title-eyebrow')) === 'Animes');
  check('Solo sem posição no ranking, com "Jogar de novo"', !(await ana.$('.ranking-status')) && Boolean(await ana.$('.score-actions .btn-primary')));
  await ana.click('.home-button');

  // ---------- Arcade ----------
  section('Arcade');
  await ana.waitForSelector('.profile-bar .coins');
  await (await ana.waitForSelector('.profile-bar ::-p-text(Arcade)')).click();
  await ana.waitForSelector('.adult-gate');
  check('Arcade pede 18+ antes de mostrar os jogos', !(await ana.$('.casino-machine')));
  await ana.click('.adult-confirm');
  await ana.waitForSelector('.casino-machine');
  check('pote acumulado aparece', /\d/.test((await text(ana, '.casino-pot .coins')) ?? ''));
  await ana.waitForFunction(() => [...document.querySelectorAll('.casino-reel img')].every((i) => i.complete), { timeout: 5000 });
  const broken = await ana.$$eval('.casino-reel img', (imgs) => imgs.filter((i) => !i.naturalWidth).map((i) => i.src));
  check('imagens dos símbolos carregam', broken.length === 0, broken.join(', '));
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

  // Mystery Box (segunda aba do Arcade).
  await ana.click('.arcade-tabs .mode-option:nth-child(2)');
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
  await bruno.click('.play-buttons .btn-primary');
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
  check('admin: chaves dos dois minigames', (await admin.$$('.admin-feature')).length === 2);
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
  await admin.close();

  check('sem erros no console', b.errors.length === 0, b.errors.join(' | '));
} catch (err) {
  check('fluxo completo sem exceção', false, err.message);
} finally {
  await b.close();
}

finish();
