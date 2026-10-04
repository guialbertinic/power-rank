// Confere a CSP (public/_headers) no build de produção: `npm run build`, `npx vite preview --port 4173` e
// `npm run e2e:csp`. Percorre conta (anti-bot), solo, imagens, fontes e party (WebSocket) e lista bloqueios da CSP.
// Rode ao mexer nos cabeçalhos (ex: liberar domínios de anúncios).
import { cleanTestData, launchBrowser, nick, PASSWORD, placeAll, sleep } from './lib.mjs';

const BASE = 'http://localhost:4173';
const b = await launchBrowser();
const violations = [];
try {
  const page = await b.page();
  page.on('console', (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.type('#nick', nick('Csp'));
  await page.click('.nick-login');
  await page.waitForSelector('input[aria-label="Confirmar senha"]');
  await page.type('input[aria-label="Senha"]', PASSWORD);
  await page.type('input[aria-label="Confirmar senha"]', PASSWORD);
  await page.waitForSelector('.nick-screen .btn-primary:not([disabled])', { timeout: 20000 });
  await page.click('.nick-screen .btn-primary');
  await page.waitForSelector('.play-buttons', { timeout: 15000 });
  console.log('conta criada (anti-bot ok)');

  await page.click('.btn-solo');
  await page.click('.solo-entry .btn-primary');
  await placeAll(page);
  await page.waitForSelector('.result-compare', { timeout: 15000 });
  const imgs = await page.$$eval('img', (list) => list.filter((i) => i.complete && !i.naturalWidth).length);
  console.log('solo ok; imagens quebradas:', imgs);
  const font = await page.evaluate(() => document.fonts.check('700 16px "Chakra Petch"'));
  console.log('fonte Chakra Petch carregada:', font);

  await page.click('.home-button');
  await page.waitForSelector('.play-buttons');
  await page.click('.btn-party');
  await page.click('.party-entry .btn-secondary');
  await page.waitForSelector('.party-code', { timeout: 15000 });
  console.log('party ok (WebSocket conectou)');
  await sleep(1000);
} catch (err) {
  console.log('ERRO:', err.message);
} finally {
  await b.close();
  cleanTestData();
}
console.log(violations.length ? `CSP bloqueou ${violations.length}:\n${violations.join('\n')}` : 'nenhum bloqueio de CSP');
process.exitCode = violations.length ? 1 : 0;
