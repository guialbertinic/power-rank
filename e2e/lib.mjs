// Utilitários dos testes e2e. Rodam contra o `npm run dev` (http://localhost:5173) e o D1 local.
// Todo nick de teste começa com "E2e": a limpeza do banco apaga por esse prefixo.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASE = process.env.E2E_BASE ?? 'http://localhost:5173';
export const DESKTOP = { width: 1280, height: 860 };
export const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poder de cada personagem, para montar ordens perfeitas/invertidas. */
export const POWER = Object.fromEntries(
  JSON.parse(readFileSync(join(ROOT, 'data/characters.json'), 'utf8')).map((c) => [c.id, c.power]),
);
export const perfectOrder = (ids) => [...ids].sort((a, b) => POWER[b] - POWER[a]);

/** Nick de teste (prefixo E2e). */
export const nick = (name) => `E2e${name}`;

// ---------- Resultado ----------

let failures = 0;

export function section(title) {
  console.log(`\n— ${title}`);
}

export function check(label, ok, extra = '') {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`);
}

/** Limpa o banco de teste e sai com código 1 se algo falhou. */
export function finish() {
  cleanTestData();
  console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
  process.exit(failures ? 1 : 0);
}

// ---------- Servidor e banco local ----------

export async function ensureServer() {
  try {
    await fetch(BASE);
  } catch {
    console.error(`Servidor fora do ar em ${BASE}. Rode \`npm run dev\` antes dos testes e2e.`);
    process.exit(2);
  }
}

/**
 * SQL no D1 local (o mesmo arquivo SQLite que o `npm run dev` usa). Escrever por aqui enquanto o dev server lê
 * pode, raramente, gerar "D1_ERROR: internal error" numa requisição concorrente (dois processos no mesmo
 * SQLite). É só do ambiente local: se um teste falhar com HTTP 500 em /api/scores logo após um d1(), rode de novo.
 */
export function d1(sql) {
  return execFileSync(
    process.execPath,
    [join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'power-rank', '--local', '--command', sql],
    { cwd: ROOT, encoding: 'utf8' },
  );
}

/** Apaga tudo dos nicks de teste (prefixo e2e): contas e o que aponta para elas, e partidas de convidados. */
export function cleanTestData() {
  const accounts = "(SELECT id FROM players WHERE name_key LIKE 'e2e%')";
  d1(
    `DELETE FROM player_items WHERE player_id IN ${accounts}; DELETE FROM player_tokens WHERE player_id IN ${accounts}; ` +
      `DELETE FROM casino_spins WHERE player_id IN ${accounts}; DELETE FROM gacha_openings WHERE player_id IN ${accounts}; ` +
      `UPDATE casino_pot SET last_winner_id = NULL WHERE last_winner_id IN ${accounts}; ` +
      `DELETE FROM access_log WHERE lower(name) LIKE 'e2e%' OR player_id IN ${accounts}; ` +
      `DELETE FROM scores WHERE name_key LIKE 'e2e%' OR player_id IN ${accounts}; ` +
      `DELETE FROM games WHERE lower(name) LIKE 'e2e%' OR player_id IN ${accounts}; ` +
      "DELETE FROM players WHERE name_key LIKE 'e2e%';",
  );
}

// ---------- API ----------

export async function post(path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

export async function get(path) {
  return (await fetch(`${BASE}/api${path}`)).json();
}

/** Senha das contas de teste. */
export const PASSWORD = 'e2e-senha';

/** Token de teste do Turnstile: as chaves de teste do .dev.vars aceitam qualquer token. */
export const TURNSTILE_TEST_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

/** O servidor recusa partidas mais rápidas que isso (server/security.ts → MIN_GAME_MS). */
export const MIN_GAME_MS = 3000;

/** Cria (ou entra n)a conta de um nick de teste e devolve { name, token }. */
export async function player(name) {
  const full = nick(name);
  const { data } = await post('/players', { name: full, password: PASSWORD, turnstile: TURNSTILE_TEST_TOKEN });
  return { name: full, token: data.token };
}

/** Joga uma partida solo com a ordem dada ('perfect' ou 'reversed') e devolve a resposta do /scores. */
export async function playSolo(auth, order = 'perfect', mode = 'anime') {
  const { data: game } = await post('/games', { ...auth, mode });
  await sleep(MIN_GAME_MS + 100); // o servidor recusa partidas rápidas demais
  const ids = perfectOrder(game.characterIds);
  return (await post('/scores', { gameId: game.gameId, placements: order === 'perfect' ? ids : ids.reverse() })).data;
}

/** Cliente WebSocket da party que guarda o último estado e os erros recebidos. */
export function partyClient(code, pid, name, token = '') {
  const params = new URLSearchParams({ pid, name, token });
  const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/api/party/${code}/ws?${params}`);
  const client = { ws, state: null, you: null, errors: [], closed: null };
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'state') Object.assign(client, { state: msg.state, you: msg.you });
    if (msg.type === 'error') client.errors.push(msg.message);
  });
  ws.addEventListener('close', (e) => (client.closed = e.code));
  client.send = (m) => ws.send(JSON.stringify(m));
  client.ready = new Promise((resolve) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('close', resolve);
  });
  client.player = (name) => client.state?.players.find((p) => p.name === name);
  return client;
}

// ---------- Navegador (Edge/Chrome headless via puppeteer-core) ----------

const BROWSER_PATHS = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/**
 * Abre o navegador headless com porta de debug e conecta. (puppeteer.launch falha neste Windows;
 * iniciar o processo e conectar pela porta funciona.)
 */
export async function launchBrowser() {
  const { default: puppeteer } = await import('puppeteer-core');
  const executable = BROWSER_PATHS.find((p) => p && existsSync(p));
  if (!executable) throw new Error('Edge/Chrome não encontrado. Defina BROWSER_PATH.');
  const port = 9333;
  const profile = mkdtempSync(join(tmpdir(), 'e2e-browser-'));
  const proc = spawn(
    executable,
    ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' },
  );
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`);
      break;
    } catch {
      await sleep(200);
    }
  }
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const errors = [];
  return {
    browser,
    errors,
    /** Página num contexto isolado (localStorage próprio = outro "dispositivo"). */
    async page(viewport = DESKTOP) {
      const page = await (await browser.createBrowserContext()).newPage();
      await page.setViewport(viewport);
      // Os testes conferem textos em português: começa sempre nele (o jogo usaria o idioma do navegador).
      await page.evaluateOnNewDocument(() => {
        if (!localStorage.getItem('power-rank:lang')) localStorage.setItem('power-rank:lang', 'pt');
      });
      page.on('pageerror', (e) => errors.push(e.message));
      // "Failed to load resource" não diz qual URL: as respostas 5xx são registradas com a URL.
      page.on('console', (m) => m.type() === 'error' && !/status of (40[1239]|5dd)/.test(m.text()) && errors.push(m.text()));
      page.on('response', (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`));
      return page;
    },
    async close() {
      await browser.disconnect();
      const exited = new Promise((resolve) => proc.once('exit', resolve));
      proc.kill();
      await Promise.race([exited, sleep(3000)]);
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
      } catch {
        // O navegador ainda segura algum arquivo: a pasta temporária fica para o sistema limpar.
      }
    },
  };
}

export const text = (page, selector) => page.$eval(selector, (el) => el.textContent.trim()).catch(() => null);
export const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Cria a conta na primeira tela (Login → nick livre → senha) e espera a home (ou a sala, se veio de convite). */
export async function chooseNick(page, name, waitFor = '.play-buttons') {
  await typeNick(page, name);
  await page.click('.nick-login');
  await page.waitForSelector('input[aria-label="Confirmar senha"]');
  await page.type('input[aria-label="Senha"]', PASSWORD);
  await page.type('input[aria-label="Confirmar senha"]', PASSWORD);
  // O botão só libera quando o anti-bot (Turnstile de teste) resolve.
  await page.waitForSelector('.nick-screen .btn-primary:not([disabled])', { timeout: 15000 });
  await page.click('.nick-screen .btn-primary');
  await page.waitForSelector(waitFor);
}

/** Entra como convidado na primeira tela. */
export async function chooseGuest(page, name, waitFor = '.play-buttons') {
  await typeNick(page, name);
  await page.click('.nick-guest');
  await page.waitForSelector(waitFor);
}

async function typeNick(page, name) {
  await page.waitForSelector('#nick');
  await page.$eval('#nick', (el) => (el.value = ''));
  await page.type('#nick', name);
}

/** Posiciona todos os personagens restantes no primeiro espaço livre. */
export async function placeAll(page, count = 10) {
  for (let i = 0; i < count; i++) {
    await page.waitForSelector('.rank-slots button:not([disabled])');
    await (await page.$$('.rank-slots button:not([disabled])'))[0].click();
    // Ritmo humano: o servidor recusa partidas de 10 personagens em menos de 3 s.
    await sleep(350);
  }
}
