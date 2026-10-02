# Arquitetura — referência

Referência detalhada, lida sob demanda. As regras de trabalho estão no `CLAUDE.md`.

## Estrutura

```
data/characters.json      base de personagens (fonte de edição, ordenada por power desc); `npm run characters:sync`
                          copia para a tabela `characters` do D1, que é o que o jogo usa
public/chars/<id>.webp    imagens 240px (≈18 KB cada)
public/_headers           cache: /chars 7 dias, /assets imutável
migrations/               schema do D1 (0001 scores · 0002 melhor por jogador · 0003 categorias ·
                          0004 donos de nick · 0005 moedas e cosméticos ·
                          0006 senha do nick · 0007 jogador por id · 0008 títulos ·
                          0009 tempo da partida · 0010 cassino · 0011 mystery box ·
                          0012 personagens no banco · 0013 18+ e registro de acesso · 0014/0015 desafio diário ·
                          0016 chaves dos minigames · 0017 registro do admin)
scripts/                  fetch-images, import-image, validate-data, rescore, contact-sheet (+ lib/images.mjs)
e2e/                      testes e2e: api.mjs (sem navegador), ui.mjs (Edge headless), lib.mjs (utilitários)
server/                   Worker: worker.ts (roteador), games.ts, scores.ts, players.ts (nick),
                          profile.ts (moedas, loja), party.ts (Durable Object), admin.ts + accessJwt.ts (admin), lib.ts
src/game/                 lógica pura, compartilhada com o server (sem DOM): types, draw, scoring, modes,
                          party (protocolo), economy (moedas), cosmetics (catálogo da loja)
src/data.ts               base de personagens para o front (POOL, POOL_BY_ID)
src/party/                cliente da party: usePartyRoom (WebSocket + reconexão), session (pid, convite)
src/components/           telas: NickScreen, IntroScreen (home), PlayingScreen, ResultScreen, ShopScreen,
                          ProfileBar, PlayerTag, Leaderboard, RankingComparison, ReviewScreen (dev)...
src/components/admin/     tela de admin (/admin, pacote separado): AdminApp, chaves, economia, jogadores, registro
src/components/party/     PartyScreen, PartyLobby, PartySettings, PartyPlay, PartyWaiting, PartyPodium, PlayerList
src/links.ts              links externos (SUPPORT_URL do "Apoie"; vazio = botão escondido)
src/styles/tokens.css     design tokens · src/styles.css componentes
src/ui/                   tiers (posição/poder → cor), fallback (URL de imagem, preload, iniciais)
```

## Idiomas (`src/i18n`)

- Português e inglês. `I18nProvider` (raiz do App) + `useI18n()` → `t(chave, { variáveis })`, `lang`, `setLang`.
  `pt.ts` é a base (tipo `Key`); `en.ts` precisa ter todas as chaves (erro de TypeScript se faltar).
- Idioma: salvo no navegador (`power-rank:lang`); na primeira visita, o do navegador (pt* → português, resto →
  inglês). Troca no menu de configurações (engrenagem, `SettingsMenu`: canto superior esquerdo; no celular, botão
  flutuante embaixo à direita). `<html lang>` acompanha.
- Nomes do catálogo (cores, molduras, títulos, símbolos do cassino) em inglês por id em `i18n/catalog.ts`
  (`cosmeticLabel`, `symbolLabel`); raridades e títulos do resultado (`rankLevel`) viram chaves.
- O servidor responde em português; `serverText(mensagem, lang)` traduz pela tabela de `i18n/server.ts` (exatas +
  padrões com variável). Mensagem sem tradução aparece em português.
- Nomes de personagens e obras não são traduzidos. Os e2e começam em português (`lib.mjs` grava o idioma).

## Segurança (`server/security.ts`)

- **Limite por IP** (bindings `RL_AUTH` 20/min, `RL_PLAY` 60/min, `RL_CASINO` 60/min no `wrangler.jsonc`): conta,
  login, troca de nick/senha · partidas, pontuação, criar sala · cassino, caixa, loja. Estourou: 429
  `{ code: 'rate_limited' }`. No dev local não limita, exceto com o cabeçalho `x-rate-limit-test: 1` (teste e2e).
- **Anti-bot (Cloudflare Turnstile)** só na criação de conta (tela do nick e "Criar conta" do convidado).
  Ligado quando existem `TURNSTILE_SITE_KEY` (var) e `TURNSTILE_SECRET` (secret); o site pega a chave em
  `GET /api/config`. Desligado = sem widget e sem checagem. No dev, `.dev.vars` usa as chaves de teste (sempre passam).
- **Nicks:** `nickProblem` recusa ofensas (lista PT/EN, também disfarçadas: "c4r4lh0") em conta nova, troca de nick e
  convidado; `lookalikeOf` recusa nick que imita outra conta (i/l/1, 0/o, separadores — "AIbertini"). Nicks antigos
  não mudam. `GET /api/players/status` devolve `problem` para a tela avisar antes.
- **Placar honesto:** partida solo enviada em menos de `MIN_GAME_MS` (3 s) é recusada (`too_fast`); na party, quem
  termina rápido demais aparece no pódio sem moedas e fora do ranking.
- **Cabeçalhos** (`public/_headers`, só no site publicado): CSP (só o próprio site + challenges.cloudflare.com para o
  Turnstile), `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Mexeu na CSP? Rode
  `npm run build`, `npx vite preview --port 4173` e `npm run e2e:csp`.

## Termos, privacidade, 18+ e registro de acesso

- **Textos** em `src/i18n/legal.ts` (pt/en, estruturados; `CONTACT_EMAIL` e `UPDATED` no topo). Tela `Legal.tsx`:
  abre por cima de qualquer tela (não desmonta partida/party), por `LegalLink` (tela do nick, rodapé da home,
  engrenagem) ou por URL direta `/?termos` · `/?privacidade` (`?terms`/`?privacy`). Aceite: aviso na tela do nick
  ("ao continuar... 13+"). Mudou uma regra (retenção, idade)? Atualize o texto e o `UPDATED`.
- **18+** (Arcade: caça-níquel, Plinko, Raspadinha e Mystery Box): a conta declara uma vez (`POST /api/profile/adult` → `players.adult_confirmed_at`,
  sem desfazer); `Profile.adult`. `CasinoScreen` mostra a trava; `spin`, `drop` (Plinko), `buyCard` (Raspadinha) e `openBox` recusam sem a declaração
  (403 `adult_required`, `requireAdult` em `server/profile.ts`).
- **Registro de acesso** (`server/access.ts` → tabela `access_log`): IP (`CF-Connecting-IP`), país, user agent,
  conta/nick e evento: `signup`, `login`, `login_failed`, `score` (inclusive convidado e partida rápida demais),
  `party` (entrada na sala, não reconexão). Guardado 90 dias (`ACCESS_LOG_RETENTION_MS`, apagado a cada gravação);
  falha ao gravar não derruba a requisição. Nunca vai para o site. Consultar (o usuário roda, `--remote`):
  ```sql
  -- IPs de uma conta
  SELECT ip, country, COUNT(*) n, MAX(datetime(created_at/1000,'unixepoch')) ultimo FROM access_log
   WHERE player_id = (SELECT id FROM players WHERE name_key = lower('Nick')) GROUP BY ip, country ORDER BY n DESC;
  -- Contas/nicks que usaram o mesmo IP (multi-conta)
  SELECT DISTINCT player_id, name FROM access_log WHERE ip = '1.2.3.4';
  -- IPs com muitas contas nos últimos 7 dias
  SELECT ip, COUNT(DISTINCT COALESCE(player_id, name)) contas FROM access_log
   WHERE created_at > (unixepoch() - 7*86400) * 1000 GROUP BY ip HAVING contas > 3 ORDER BY contas DESC;
  ```

## Personagens: banco e o que o site sabe

- O servidor lê os personagens da tabela `characters` (`server/catalog.ts`, cache em memória de 5 min). Inativos
  (`active = 0`, saíram do JSON) não são sorteados nem vendidos, mas partidas e avatares antigos continuam.
- O site recebe `GET /api/characters` (nome, obra, versão, imagem — **sem `power`**, em ordem alfabética para a ordem
  não entregar o ranking) e, ao sortear, os 10 personagens da partida.
- No fim da partida o servidor devolve `ranks` (quantos sorteados são mais fortes que cada um); o site pontua e
  mostra a ordem correta com `withRanks` (mesmo resultado que o poder real, provado em `scoring.test.ts`). Na party,
  os `ranks` são calculados no início da rodada e só vão para o site no pódio.
- `/?review` usa `GET /api/dev/characters` (com `power`), que só responde em localhost.

## Regras do jogo

- **Personagem** (`src/game/types.ts`): `id`, `name`, `category` (`anime` | `games` | `pokemon`), `series` (obra),
  `tier?` (1–3, anime e games: ver Dificuldade), `generation?` (1–9, só Pokémon),
  `version?` (arco/forma), `power` 0–100, `image?` e origem da imagem (`anilistId`, `igdbId`, `wikipedia`,
  `search`, `imageVersion`).
- **Escala de poder universal** (o Free for All depende dela): 0–15 humano · 15–40 sobre-humano ·
  40–60 prédio→cidade · 60–75 cidade→montanha · 75–85 ilha→continente · 85–95 planeta→estrela · 95–100 galáxia+.
  Os valores são propostas; o usuário revisa em `/?review`.
- **Sorteio** (`draw.ts`): Fisher-Yates uniforme sobre o pool do modo, sem espaçamento (pode vir tudo fraco ou
  tudo forte, de propósito). O pool exclui personagens sem imagem.
- **Pontuação** (`scoring.ts`): por posição. Cada personagem vale pela distância (em casas) até a posição certa:
  exato 100 · 1 casa 70 · 2 casas 40 · 3 casas 15 · 4+ 0 (`POINTS_BY_DISTANCE`); a soma vai de 0 a 1000. Empate de
  poder: qualquer posição da faixa conta como exata. Ordem aleatória ≈ 330; quem sabe o poder de todos faz ≈ 690 de
  mediana (às cegas, já ocupou a casa de quem vem depois). Títulos (`rankLevel`) nas mesmas faixas das moedas.
- **Modos** (`modes.ts`): `anime`, `games`, `pokemon`, `all` (Free for All = anime + games; Pokémon fica
  fora), cada um com o próprio ranking. Disponível com ≥ 10 personagens sorteáveis.
- **Pokémon:** todas as espécies (forma padrão, gerações 1–9), ids `pkm-<nome>`, criadas por
  `npm run pokemon:import` (PokeAPI GraphQL) com uma proposta de poder de lore (tabela `LORE` no script para
  legendários e casos conhecidos, o resto pelo total de status base); quem já existe mantém o `power`.
  **Filtro de gerações** (home, só no modo Pokémon, lembrado no navegador): vai como `generations` em
  `POST /api/games` e `POST /api/party` (a sala guarda e mostra no lobby). O desafio diário ignora o filtro
  (todas) e o ranking é um só.
- **Dificuldade** (Animes, Games, Free for All; `Difficulty` em `modes.ts`): fácil só `tier` 1, médio 1–2,
  difícil todos (cumulativa; padrão médio, lembrada no navegador). `tier` = fama: 1 mainstream, 2 médio, 3
  obscuro; base pela fama da obra (AniList, ajustada ao público BR) e um tier abaixo para coadjuvantes com poucos
  favoritos. Público (vem no catálogo, coluna `characters.tier`); sem `tier` conta como 3. Vai como `difficulty`
  em `POST /api/games` e `POST /api/party` (a sala guarda e mostra no lobby); ausente = todos. O desafio diário
  ignora. `poolFor(mode, chars, { generations, difficulty })`: cada filtro só vale no modo dele (`filterFor`).

## API

| Rota | O que faz |
|---|---|
| `GET /api/players/status?name=` | `{ exists, hasPassword }`, sem reservar nada (a tela do nick decide o passo seguinte). |
| `POST /api/players` `{ name, token?, password? }` | Conta. Nick livre + senha: cria (`{ token }`); sem senha, 400. Seu (token): confirma. De outra pessoa: senha certa dá token novo; errada 403; 5 erradas seguidas bloqueiam 5 min (429); sem senha: 409 `{ taken, hasPassword }`. |
| `POST /api/players/password` `{ token, password }` | Cria a senha de uma conta que ainda não tem (409 se já tem). 6 a 72 caracteres (`src/game/account.ts`). |
| `POST /api/players/delete` `{ token, password }` | Exclui a conta (senha obrigatória se tiver; mesmo bloqueio do login): tokens, itens, partidas, pontuações, tentativas do desafio e histórico do Arcade, numa transação. O nick fica livre. `access_log` fica até expirar (90 dias); `admin_actions` perde só o `player_id`. |
| `GET /api/health` | `{ ok, db, ms }`: o Worker e o D1 respondem (`SELECT 1`); 503 se o banco falhar. Sem cache. Para monitor externo (UptimeRobot etc.). |
| `POST /api/players/rename` `{ token, name }` | Troca o nick da conta, se não for de outra conta (409). Tudo segue a conta (id). |
| `POST /api/games` `{ name, token?, mode, daily?, generations?, difficulty? }` | Com token: a conta dele (token inválido, 401). Sem token: convidado, se o nick não for de uma conta (401). Sorteia no servidor e grava a partida (com `player_id` da conta). `daily: true`: Desafio Diário da categoria; 409 `daily_done` se já começou o de hoje. |
| `POST /api/daily` `{ name, token?, mode }` | `{ day, done, score }`: se o jogador (conta ou convidado) já jogou o desafio de hoje da categoria. |
| `POST /api/scores` `{ gameId, placements }` | Nick e modo vêm da partida. Recalcula a pontuação, mede o tempo (sorteio → envio), credita moedas. Devolve `durationMs`, `daily` e `rank` (posição no ranking do desafio; null em partida solo e de convidado). Uma vez por partida, TTL 1h. |
| `GET /api/characters` | Catálogo público (sem `power`), ordem alfabética, cache 5 min. |
| `GET /api/dev/characters` | Com `power`, só em localhost (tela `/?review`). |
| `GET /api/scores?mode=&period=daily\|total` | Top 20 da categoria, só contas (nick atual + visual), só Desafio Diário. `daily` (padrão): o de hoje, com `durationMs`; `total`: soma de todos os desafios, com `days`. |
| `POST /api/party` `{ mode, pid, generations?, difficulty? }` | Cria a sala (6 letras, sem I/O) e devolve `{ code }`. |
| `GET /api/party/:code/ws?pid=&name=&token=` | WebSocket da sala (encaminhado ao Durable Object). |
| `GET /api/slots` | `{ pot, lastWinner }`: pote acumulado e último ganhador do jackpot. 403 `feature_disabled` com a chave desligada. |
| `POST /api/gacha/open` `{ token }` | Só contas. Mystery Box: cobra 100, sorteia raridade e item, entrega (ou devolve moedas se repetido) e devolve `{ rarity, itemId, duplicate, refund, profile }`. 402 sem saldo, 403 `feature_disabled` com a chave `mystery_box` desligada. |
| `POST /api/slots/spin` `{ token, bet }` | Só contas. Aposta de 1 a 10 moedas. Sorteia no servidor, debita/credita e devolve `{ reels, outcome, prize, coins, pot, jackpot }`. 402 sem saldo, 403 `feature_disabled` com a chave `slots` desligada. |
| `POST /api/plinko/drop` `{ token, bet, risk }` | Só contas 18+. Aposta de 1 a 10, risco `low`/`medium`/`high`. Sorteia o caminho no servidor, debita/credita no mesmo UPDATE e devolve `{ path, slot, multiplier (décimos), prize, coins }`. 402 sem saldo, 403 `feature_disabled` com a chave `plinko` desligada. Limite próprio `RL_PLINKO` (200/min). |
| `POST /api/scratch/buy` `{ token, bet }` | Só contas 18+. Aposta de 1 a 10. Sorteia o trio e monta a cartela no servidor, debita/credita no mesmo UPDATE e devolve `{ cells (9 símbolos), symbol (trio ou null), multiplier, prize, coins }`. 402 sem saldo, 403 `feature_disabled` com a chave `scratch` desligada. Limite `RL_CASINO`. |
| `POST /api/profile` `{ token }` | Nick atual, saldo, itens comprados, visual equipado e `hasPassword`. |
| `POST /api/shop/buy` `{ token, itemId }` | Registra o item (INSERT OR IGNORE) e só então debita com `coins >= preço` no UPDATE; sem saldo, desfaz. |
| `/api/admin/*` | Só admin (ver "Admin"; 403 `admin_denied`). `GET me` · `GET/POST features` `{ id, enabled }` · `GET economy` · `GET players?q=&sort=recent|coins` · `GET players/:id` · `POST players/:id/coins` `{ delta, reason }` · `POST players/:id/rename` `{ name }` · `POST players/:id/password` → `{ password, player }` · `GET actions`. |
| `POST /api/profile/equip` `{ token, slot, itemId \| null }` | Equipa (ou tira) um item que o jogador tem. |

`scores` guarda todas as partidas (inclusive de convidados, com `player_id` NULL, que não entram no ranking).
**Rankings** (`server/scores.ts`): só o **Desafio Diário** conta (solo e party rendem moedas, mas não entram).
Uma linha por conta mesmo depois de trocar o nick; convidado joga, mas não entra.
- **Desafio Diário** (`server/daily.ts`, aba Diário na home): um por categoria, os mesmos 10 personagens, na
  mesma ordem, para todos (`daily_challenges`, chave dia + modo, sorteado no primeiro pedido). Uma tentativa por
  jogador e categoria, gasta ao **começar** (`daily_attempts`, chave dia + modo + `p:<id>` da conta ou `g:<nick>`
  do convidado). `games.daily`/`scores.daily` = dia (AAAA-MM-DD de Brasília, UTC−3; `dayKey` em `src/game/daily.ts`).
- Aba **Desafio** (padrão): o de hoje. Empate: menor `duration_ms` (do sorteio ao envio), depois quem fez primeiro.
- Aba **Acumulado**: soma de todos os desafios da categoria (um por dia: premia constância). Empate: menos dias.

**Identidade:** o jogador é `players.id`. `player_tokens`, `player_items`, `games.player_id` e `scores.player_id`
apontam para ele (NULL em games/scores = convidado). `players.name` é o nick como foi escrito e `players.name_key`
o nick normalizado (`nameKey`: minúsculas, NFC), `UNIQUE`, usado só para achar um nick e impedir duplicata
("Albertini" = "albertini"; `COLLATE NOCASE` do SQLite só cobre A–Z, não acentos). `scores.name`/`name_key`
guardam o nick usado na partida (o ranking mostra `players.name`, o nick atual).

## Conta e convidado

Só a **conta** (nick + senha, linha em `players`) reserva o nick; cada aparelho da conta tem um token
(`player_tokens`, hash SHA-256). O **convidado** (`token: null`) joga com qualquer nick que não seja de uma conta,
sem reservar nada: não entra no ranking, não ganha moedas nem usa a loja (`playerAccess` em `server/players.ts`
decide conta/convidado em `/api/games` e na party; `PartyPlayer.guest`).
Tela do nick (`NickScreen`): **Login** consulta `/api/players/status` — conta: pede a senha (ou entra direto se o
token do nick está neste navegador); nick livre: senha + confirmar cria a conta. **Convidado**: entra se o nick não
for de uma conta. "Sincronizar dispositivo" (menu da `ProfileBar`, `SyncDevice`): o convidado cria a conta ali;
contas antigas sem senha (criadas antes da 0006) criam a senha; contas têm **Forçar sincronização**, que recarrega
o perfil do servidor (e adota o nick, se a conta foi renomeada em outro aparelho). **Trocar nick** (`ChangeNick`)
nunca troca de conta: a conta é renomeada (se o nick não for de outra conta); o convidado só passa a usar outro
nick livre. **Sair da conta** esquece o token neste navegador; o convidado tem **Entrar em uma conta**.
**Excluir minha conta** (`DeleteAccount`, no fim do menu, só contas): aviso + senha → `/api/players/delete` e volta
para a tela do nick.
Senha: PBKDF2-SHA256 com sal, iterações gravadas no próprio hash (`password_hash`);
tentativas erradas em `failed_logins`/`locked_until`. Ainda não há troca nem recuperação de senha.
No navegador, a identidade `{ name, token }` e os tokens de nicks já usados ficam no `localStorage` (`src/nick.ts`).

## Economia e cosméticos

- **Moedas** (`economy.ts`), creditadas no servidor: < 400 pts: 0 (anti-spam, sem limite diário) · 400–549: 5 ·
  550–699: 15 · 700–849: 35 · 850+: 60. Bônus de pódio na party (+20/+10/+5) só com 2+ jogadores
  que terminaram **e** 400+ pontos. O `rescore` não mexe em moedas creditadas.
- **Loja** (`cosmetics.ts`): cor do nick, moldura, título (o `label` é o texto do título) e avatar (qualquer
  personagem, preço único de 50: preço por força revelaria o poder). A loja lista por preço, com filtro
  Todos/Obtidos/Não obtidos; cor = o nome da cor com o efeito, moldura = quadro vazio, título = por categoria (`group`), 2 por linha.
  Avatares (`ShopAvatars`): sem busca, categorias recolhidas (Animes/Games/Pokémon) → obra (games por franquia;
  obra com 1 personagem vai para "Outros"; Pokémon por geração); só grupos abertos renderizam. Com busca, lista plana.
  Item novo: entrada no catálogo + classe CSS (cor/moldura); título só precisa da entrada.
- **Visual** (`PlayerTag`): avatar + moldura + nick colorido + título embaixo do nick, no ranking, party, pódio e
  `ProfileBar`. Cada cor/moldura é a classe `cosmetic-<id>` em `styles.css` (anéis que giram usam o `@property
  --cosmetic-angle`).

## Admin (/admin)

- **Tela** em `/admin` (`main.tsx` carrega `components/admin/AdminApp` à parte; o jogo não baixa esse código).
  Abas: **Chaves** (liga/desliga minigame), **Economia** (só leitura: saldos, fluxo de moedas tudo/7 dias,
  retorno real do caça-níquel, raridades reais × configuradas, itens com mais donos), **Jogadores** (busca por
  parte do nick; detalhe com partidas, acessos e ações; ajustar moedas com motivo, renomear sem o filtro de
  nick, gerar senha temporária, que desbloqueia e desconecta todos os aparelhos) e **Registro**.
- **Acesso, em duas camadas:** o Cloudflare Access pede o login (e-mail) antes de `/admin` e `/api/admin/*`
  chegarem ao site; o Worker (`handleAdmin` em `server/admin.ts`) confere o JWT do header
  `Cf-Access-Jwt-Assertion` (`accessJwt.ts`: RS256 com as chaves do time, `iss`, `aud`, prazo) e o e-mail
  em `ADMIN_EMAILS`. Faltou `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` (vars do `wrangler.jsonc`) ou `ADMIN_EMAILS`
  (secret) = 403 para todos. No dev local (host localhost) entra como `local`, sem Access.
- POST do admin só com `Content-Type: application/json` (outro site não consegue sem CORS: protege contra CSRF
  com o cookie do Access).
- **Registro** `admin_actions` (admin, ação `feature|coins|rename|password`, jogador, JSON do antes/depois):
  cada mudança vai no mesmo `batch` (transação) que o registro. Moedas: `UPDATE ... WHERE coins + delta >= 0` e
  o `INSERT ... WHERE changes() = 1` (só registra se o saldo mudou); limite de ±100.000 por ação.
- **Configurado em produção** (time `crimson-dream-8892`, valores no `wrangler.jsonc`, `ADMIN_EMAILS` como secret).
  Aplicação Self-hosted no Cloudflare One → Access → Applications. O que travou na primeira vez:
  - Destinos: em **Public hostnames → Switch to custom input**, o endereço completo `power-rank.guilherme-albertinic.workers.dev/admin`
    e `.../api/admin`. **Nunca** a linha "Workers": ela não tem caminho e trancaria o site inteiro.
  - Login: **One-time PIN** (Integrations → Identity providers, e ligar na aba Login methods da aplicação); o login
    "Cloudflare" não funcionou.
  - Política Allow com o e-mail exato (um ponto sobrando no fim fez o PIN nunca chegar: o Access não envia código
    para e-mail fora da política e não avisa) e clicar em **Save** da aplicação. O Policy tester fica vazio até
    alguém fazer login.
  - Conferir sem login: `curl -I .../admin` → 302 para `cloudflareaccess.com`; `/` e `/api/config` → 200.

## Arcade e chaves (feature flags)

- **Arcade** = a tela dos minigames com moedas (`ArcadeScreen`, botão "Arcade" na `ProfileBar`, só contas, trava
  18+): uma aba por minigame ligado. Na tela nunca se usa "cassino"; o código interno do caça-níquel segue como
  `casino` (arquivos, classes `.casino-*`, tabelas `casino_*`, `RL_CASINO`).
- **Chaves** na tabela `features` (`id`, `enabled`, `updated_at`), ids em `src/game/features.ts` (`slots`,
  `plinko`, `scratch`, `mystery_box`). Sem linha = desligada. Servidor: `requireFeature` (`server/features.ts`) no começo de cada rota do
  minigame → 403 `feature_disabled`, antes de cobrar. Site: `GET /api/config` → `features`, lido pelo `App` ao voltar
  para a home; só as ligadas viram aba, e sem nenhuma o botão do Arcade some. Se a leitura falhar, o config manda
  tudo desligado (o Turnstile depende dessa rota). Ligar/desligar: aba Chaves do `/admin`, ou por SQL:
  `UPDATE features SET enabled = 0, updated_at = unixepoch() * 1000 WHERE id = 'slots'`.
  Minigame novo: id em `FEATURES`, `INSERT` numa migração, `requireFeature` nas rotas e entrada em `GAMES` do `ArcadeScreen`.

## Caça-níquel (Slots)

- Regras em `src/game/casino.ts` (compartilhado; `casino.test.ts` calcula o retorno exato das 6³ combinações).
  Servidor em `server/casino.ts`, aba "Slots" do Arcade (`SlotMachine`). Símbolos = os tiers
  SS/S/A/B/C/D (ids iguais aos de `ui/tiers.ts`), desenhados em CSS pelo `CasinoIcon` (badge chanfrado na cor do
  tier, tamanho por `--icon-size`), sem imagem. Giros antigos em `casino_spins` têm os ids da arte anterior (seven, cherry...).
- 3 rolos, 6 símbolos com pesos (SS = jackpot, D = o mais comum). 3 iguais e pares pagam multiplicadores da aposta (1 a 10 moedas, na escala do que uma partida rende); a chance
  não depende da aposta. Tabela fixa ≈ 90% de retorno + pote ≈ 95% no longo prazo. Jackpot (três 7)
  ≈ 1 a cada 4.600 giros.
- **Pote** (`casino_pot`, uma linha, em centésimos de moeda: 5% de uma aposta de 1 = 0,05): recebe 5% de cada aposta. Jackpot = maior entre 100× a aposta e
  `pote × 50% × aposta/10`; só essa parte sai do pote (o mínimo excedente vem "da casa"). O `UPDATE` do pote
  calcula e desconta o prêmio na mesma operação (dois jackpots simultâneos não levam o mesmo pote).
- Débito: `coins = coins - aposta + prêmio WHERE coins >= aposta` (prêmio fixo no mesmo UPDATE); jackpot é creditado
  logo depois. Todo giro vai para `casino_spins` (auditoria/balanceamento).

## Plinko

- Regras em `src/game/plinko.ts` (compartilhado; `plinko.test.ts` calcula o retorno exato de cada risco). Servidor em
  `server/plinko.ts`, aba "Plinko" do Arcade (`PlinkoBoard`, SVG no gabinete `.casino`).
- 12 fileiras, 13 casas; em cada pino 50/50 → casa = nº de "direitas" (binomial: ponta 1 em 4.096, meio 22,6%).
  Multiplicadores em décimos por risco, simétricos (ponta → meio): baixo 8× … 0,5×, médio 26× … 0,3×, alto
  130× … 0,2×. Todos ≈ 95% de retorno. Casas coloridas pelos tiers (pontas SS, meio D).
- Prêmio com fração (1 × 1,6): parte inteira garantida + 1 moeda com a chance da fração (`prizeFor`), então o retorno
  é o mesmo em qualquer aposta.
- Débito e prêmio no mesmo UPDATE (`coins >= aposta`); toda bolinha vai para `plinko_drops` (risco, casa,
  multiplicador, prêmio). Sem pote.
- Tela: até 4 bolinhas ao mesmo tempo; o saldo mostrado desconta a aposta ao soltar e soma o prêmio quando a
  bolinha chega. Risco trava com bolinha caindo.

## Raspadinha

- Regras em `src/game/scratch.ts` (compartilhado; `scratch.test.ts` confere o retorno e a cartela). Servidor em
  `server/scratch.ts`, aba "Raspadinha" do Arcade (`ScratchCard`, no gabinete `.casino`).
- Cartela 3×3 com os símbolos do caça-níquel (tiers SS … D). O servidor sorteia primeiro o resultado (pesos em
  1/10.000) e depois monta a cartela: o trio (se houver) + casas tiradas de um "saco" com 2 fichas de cada outro
  símbolo, embaralhadas. Então nunca há dois trios, e quase-vitórias aparecem naturalmente.
- Trios: SS 100× (0,2%), S 25× (0,8%), A 10× (2%), B 3× (5%), C 2× (5%), D 1× (10%, devolve a aposta). Ganha em 23%
  das cartelas; retorno exato de 95%. Prêmio sempre inteiro (aposta × multiplicador).
- Débito e prêmio no mesmo UPDATE (`coins >= aposta`); toda cartela vai para `scratch_cards` (trio, multiplicador,
  prêmio). Sem pote.
- Tela: a cobertura é um `<canvas>` por cima das casas (raspa com o dedo/mouse, `destination-out`); uma casa abre
  sozinha quando metade dela foi raspada. "Revelar tudo" abre de uma vez. O saldo mostrado só soma o prêmio com a
  cartela inteira revelada; a aposta trava até lá. Sair da aba no meio não perde nada (o prêmio já foi creditado).

## Mystery Box (gacha)

- Aba do Arcade (`ArcadeScreen` → `SlotMachine` | `PlinkoBoard` | `ScratchCard` | `MysteryBox`). Regras em `src/game/gacha.ts`, servidor em
  `server/gacha.ts`. Caixa: 100 moedas.
- Raridade (60/28/10/2%) e depois um item dela. Pools derivados do catálogo pelo preço: comum < 150 (metade das vezes
  sai um avatar aleatório), raro 150–349, épico 350+, lendário = itens `exclusive` (só saem na caixa; a loja não
  vende e só mostra a quem tem, com o selo "Exclusivo").
- Fluxo: débito condicional → `INSERT OR IGNORE` do item (não inseriu = repetido) → devolução (metade do preço;
  lendário 300) + registro em `gacha_openings`. A tela treme a caixa ≥ 1,2 s e revela na cor da raridade.

## Party (multiplayer)

- Sala = Durable Object `PartyRoom` (um por código), WebSocket com hibernação, estado salvo no storage.
- Fluxo: `lobby` → `playing` → `podium` → (dono inicia) → `playing`. Máximo de 8 jogadores.
- Protocolo em `src/game/party.ts`. Cliente → sala: `start`, `progress`, `finish`, `end`, e só do dono: `settings`
  (categoria e filtro; fora da partida), `kick`, `host` (passa a dona para um conectado).
  Sala → cliente: `error` com `fatal: true` (sala não encontrada, cheia, expulso...) faz o cliente sair na hora, sem
  esperar o fechamento da conexão (que pode demorar segundos) nem tentar reconectar.
  Sala → cliente: `state` (completo, a cada mudança) e `error`.
- Mesmos 10 personagens para todos; **pontuação calculada no servidor**; pontuações, posições e moedas só no pódio.
  Cada resultado é gravado (`games` + `scores`) e rende moedas, mas não entra no ranking (só o Desafio Diário).
- Pódio (`PartyPodium`): o servidor revela as `placements` de todos; tocar num jogador da classificação troca a
  comparação embaixo (a sua por padrão) pela lista dele. Uma lista por vez.
- Cada jogador tem um `pid` secreto (sessionStorage, para reconectar na mesma vaga) e um `id` público.
- Regras: nick repetido na sala é recusado; ninguém entra depois do início; quem cai no lobby sai; se o dono sai,
  o conectado mais antigo assume; pódio quando todos os conectados terminam ou o dono encerra; sala vazia some
  em 30 min (alarm). O progresso ("7/10") só é transmitido, sem gravar.
- **Dono** (`PartySettings` no lobby e, recolhido em "Mudar categoria", no pódio): troca categoria e
  dificuldade/gerações. Na `PlayerList` (lobby e espera), o "⋯" de cada jogador abre **Tornar dono** e **Expulsar**. Expulso recebe erro e
  (fatal) e a conexão fecha com 4000; o pid e a conta ficam em `kickedPids`/`kickedAccounts` e não entram de novo.
- **Novo recorde**: no `start` (dono) a sala lê `MAX(score)` de cada conta na categoria (antes das checagens) e guarda
  em `best` (com a pontuação da rodada anterior na sala, que pode ainda não ter sido gravada). `finish` acima de
  `best` → `newRecord`, revelado no pódio (selo na classificação e "Novo recorde!" no seu placar). Primeira partida na
  categoria, convidado ou rápido demais não contam.
- Convite: `/?sala=CODIGO`. Sem nick: escolhe o nick e entra direto na sala. Com nick: entra direto.

## Front

- `App.tsx`: reducer `nick` → `intro` (home) → `playing` → `result`, ou `intro` → `party` / `shop`.
  `playing`/`result` têm `daily`: o título mostra "Desafio diário · <categoria>", o resultado mostra a posição no
  desafio e não tem "Jogar de novo". A home consulta `/api/daily` (ao abrir e ao trocar de categoria); o botão trava
  depois da tentativa e mostra a pontuação.
- **Modo gravação** (configurações, salvo no navegador): `.app.recording`, sem `ProfileBar` (logo sem Loja/Arcade) e
  sem rodapé; a engrenagem fica discreta e é por onde se sai.
- **Apoie**: `SUPPORT_URL` em `src/links.ts`; preenchido, aparece no rodapé da home e no menu do perfil.
- A primeira tela é o nick. Telas fora da home têm "Início" no cabeçalho (na party, sai da sala).
- Home (`IntroScreen`): título, o seletor de categoria (`ModePicker`, rótulo "Modo" na tela), as abas SOLO/PARTY/DIÁRIO e
  o ranking. Cada aba abre um painel (um por vez): Solo e Party com a configuração da partida (`DifficultyPicker`, ou
  `GenerationPicker` no Pokémon) e o Iniciar / Criar sala + entrar por código; o Diário (sem configuração) com a
  regra, o Jogar ou a pontuação de hoje (a aba ganha ✓) e o tempo até o próximo. `ProfileBar` no canto; no celular vira faixa com nick + saldo, e Loja/Cassino ficam no menu (sanfona).
- Se a API falhar, o jogo sorteia localmente (`gameId: null`) e não conta para o ranking.
- Imagens da partida pré-carregadas no sorteio; URL com `?v=<id da fonte>` para invalidar cache.
- `?review` só existe em dev (import lazy atrás de `import.meta.env.DEV`).
- **Compartilhar** (solo, `ShareResult`, embaixo de "Jogar de novo"):
  - "Compartilhar imagem": PNG 1080×1920 desenhado em canvas (`ui/shareImage.ts`, cores lidas dos tokens), gerado
    assim que o resultado chega; com Web Share de arquivos abre o menu do sistema, senão baixa.
  - "Compartilhar resultado": copia pontuação + título + 10 quadrados de acerto (`ui/hits.ts`: casas de erro, mesmos níveis da
    comparação) + link. Sem nomes: não dá spoiler da ordem.

## Design system ("Dark Battle Interface")

- Só tokens de `tokens.css`. Tiers `.tier-ss … .tier-d` expõem `--tier-color`, `--tier-fill`, `--tier-text`, `--tier-on`.
- Posição → tier: #1 SS, #2–3 S, #4–5 A, #6–7 B, #8–9 C, #10 D. Poder → tier: ≥95 SS, ≥85 S, ≥75 A, ≥60 B, ≥45 C.
- Formas angulares (`--clip-slant`, `--clip-chamfer`), `--radius: 2px`.
- `clip-path` corta `box-shadow`: brilho num wrapper com `filter: drop-shadow`; foco de botões é barra inset.
- Fontes: Chakra Petch (display) e Rajdhani (corpo), `@fontsource`, subset latin.
- Celular (390px): grids com `minmax(0, 1fr)`, sem scroll horizontal. Respeitar `prefers-reduced-motion`.

## Imagens de personagem

- **Anime:** AniList (GraphQL, sem chave; ~30–90 req/min, o script espera no 429). Romanização japonesa
  ("Tanjirou"): use `search` ou fixe `anilistId`.
- **Games:** o IGDB (`.env`) quase não tem retratos; a fonte principal é a imagem do artigo da **Wikipédia**
  (`wikipedia: "Título exato"`, `pilicense=any`). A **Fandom bloqueia scripts** (403) — não contornar com
  User-Agent/Referer falsos; usar `import:image` com arquivo baixado pelo usuário.
- **Pokémon:** arte oficial da PokeAPI (GitHub) pelo `pokeapiId`; `saveImage(..., { contain: true })` tira a
  margem transparente e encaixa a arte inteira em 3:4 (sem cortar caudas/asas), com fundo transparente.
- `scripts/lib/images.mjs`: WebP 240px; imagens largas recortadas em 3:4 (`attention`, às vezes erra).
