# Arquitetura — referência

Referência detalhada, lida sob demanda. As regras de trabalho estão no `CLAUDE.md`.

## Estrutura

```
data/characters.json      base de personagens (fonte da verdade, ordenada por power desc)
public/chars/<id>.webp    imagens 240px (≈18 KB cada)
public/_headers           cache: /chars 7 dias, /assets imutável
migrations/               schema do D1 (0001 scores · 0002 melhor por jogador · 0003 categorias ·
                          0004 donos de nick · 0005 moedas e cosméticos ·
                          0006 senha do nick · 0007 jogador por id · 0008 títulos)
scripts/                  fetch-images, import-image, validate-data, rescore, contact-sheet (+ lib/images.mjs)
e2e/                      testes e2e: api.mjs (sem navegador), ui.mjs (Edge headless), lib.mjs (utilitários)
server/                   Worker: worker.ts (roteador), games.ts, scores.ts, players.ts (nick),
                          profile.ts (moedas, loja), party.ts (Durable Object), lib.ts
src/game/                 lógica pura, compartilhada com o server (sem DOM): types, draw, scoring, modes,
                          party (protocolo), economy (moedas), cosmetics (catálogo da loja)
src/data.ts               base de personagens para o front (POOL, POOL_BY_ID)
src/party/                cliente da party: usePartyRoom (WebSocket + reconexão), session (pid, convite)
src/components/           telas: NickScreen, IntroScreen (home), PlayingScreen, ResultScreen, ShopScreen,
                          ProfileBar, PlayerTag, Leaderboard, RankingComparison, ReviewScreen (dev)...
src/components/party/     PartyScreen, PartyLobby, PartyPlay, PartyWaiting, PartyPodium, PlayerList
src/styles/tokens.css     design tokens · src/styles.css componentes
src/ui/                   tiers (posição/poder → cor), fallback (URL de imagem, preload, iniciais)
```

## Regras do jogo

- **Personagem** (`src/game/types.ts`): `id`, `name`, `category` (`anime` | `games`), `series` (obra),
  `version?` (arco/forma), `power` 0–100, `image?` e origem da imagem (`anilistId`, `igdbId`, `wikipedia`,
  `search`, `imageVersion`).
- **Escala de poder universal** (o Free for All depende dela): 0–15 humano · 15–40 sobre-humano ·
  40–60 prédio→cidade · 60–75 cidade→montanha · 75–85 ilha→continente · 85–95 planeta→estrela · 95–100 galáxia+.
  Os valores são propostas; o usuário revisa em `/?review`.
- **Sorteio** (`draw.ts`): Fisher-Yates uniforme sobre o pool do modo, sem espaçamento (pode vir tudo fraco ou
  tudo forte, de propósito). O pool exclui personagens sem imagem.
- **Pontuação** (`scoring.ts`): ordem entre pares. Cada um dos 45 pares vale se o mais forte ficou acima
  (empate conta como certo). `total = round(1000 * paresCertos / 45)`. Ordem aleatória ≈ 500.
- **Modos** (`modes.ts`): `anime`, `games`, `all` (Free for All), cada um com o próprio ranking.
  Disponível com ≥ 10 personagens sorteáveis.

## API

| Rota | O que faz |
|---|---|
| `GET /api/players/status?name=` | `{ exists, hasPassword }`, sem reservar nada (a tela do nick decide o passo seguinte). |
| `POST /api/players` `{ name, token?, password? }` | Conta. Nick livre + senha: cria (`{ token }`); sem senha, 400. Seu (token): confirma. De outra pessoa: senha certa dá token novo; errada 403; 5 erradas seguidas bloqueiam 5 min (429); sem senha: 409 `{ taken, hasPassword }`. |
| `POST /api/players/password` `{ token, password }` | Cria a senha de uma conta que ainda não tem (409 se já tem). 6 a 72 caracteres (`src/game/account.ts`). |
| `POST /api/players/rename` `{ token, name }` | Troca o nick da conta, se não for de outra conta (409). Tudo segue a conta (id). |
| `POST /api/games` `{ name, token?, mode }` | Com token: a conta dele (token inválido, 401). Sem token: convidado, se o nick não for de uma conta (401). Sorteia no servidor e grava a partida (com `player_id` da conta). |
| `POST /api/scores` `{ gameId, placements }` | Nick e modo vêm da partida. Recalcula a pontuação no servidor, credita moedas. Uma vez por partida, TTL 1h. |
| `GET /api/scores?mode=` | Top 20 do modo: melhor resultado de cada conta (com o nick atual), com o visual equipado. Convidados não entram. |
| `POST /api/party` `{ mode, pid }` | Cria a sala (6 letras, sem I/O) e devolve `{ code }`. |
| `GET /api/party/:code/ws?pid=&name=&token=` | WebSocket da sala (encaminhado ao Durable Object). |
| `POST /api/profile` `{ token }` | Nick atual, saldo, itens comprados, visual equipado e `hasPassword`. |
| `POST /api/shop/buy` `{ token, itemId }` | Registra o item (INSERT OR IGNORE) e só então debita com `coins >= preço` no UPDATE; sem saldo, desfaz. |
| `POST /api/profile/equip` `{ token, slot, itemId \| null }` | Equipa (ou tira) um item que o jogador tem. |

`scores` guarda todas as partidas (inclusive de convidados, com `player_id` NULL); o ranking usa
`ROW_NUMBER() OVER (PARTITION BY player_id)` só sobre contas: uma linha por conta, mesmo depois de trocar o nick.

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
Senha: PBKDF2-SHA256 com sal, iterações gravadas no próprio hash (`password_hash`);
tentativas erradas em `failed_logins`/`locked_until`. Ainda não há troca nem recuperação de senha.
No navegador, a identidade `{ name, token }` e os tokens de nicks já usados ficam no `localStorage` (`src/nick.ts`).

## Economia e cosméticos

- **Moedas** (`economy.ts`), creditadas no servidor: < 500 pts: 0 (anti-spam, sem limite diário) · 500–599: 5 ·
  600–749: 10 · 750–849: 20 · 850–949: 35 · 950+: 60. Bônus de pódio na party (+20/+10/+5) só com 2+ jogadores
  que terminaram **e** 500+ pontos. O `rescore` não mexe em moedas creditadas.
- **Loja** (`cosmetics.ts`): cor do nick, moldura, título (o `label` é o texto do título) e avatar (qualquer
  personagem, preço único de 50: preço por força revelaria o poder). A loja lista por preço, com filtro
  Todos/Obtidos/Não obtidos; cor = o nome da cor com o efeito, moldura = quadro vazio, título = lista simples.
  Item novo: entrada no catálogo + classe CSS (cor/moldura); título só precisa da entrada.
- **Visual** (`PlayerTag`): avatar + moldura + nick colorido + título embaixo do nick, no ranking, party, pódio e
  `ProfileBar`. Cada cor/moldura é a classe `cosmetic-<id>` em `styles.css` (anéis que giram usam o `@property
  --cosmetic-angle`).

## Party (multiplayer)

- Sala = Durable Object `PartyRoom` (um por código), WebSocket com hibernação, estado salvo no storage.
- Fluxo: `lobby` → `playing` → `podium` → (dono inicia) → `playing`. Máximo de 8 jogadores.
- Protocolo em `src/game/party.ts`. Cliente → sala: `start`, `progress`, `finish`, `end`.
  Sala → cliente: `state` (completo, a cada mudança) e `error`.
- Mesmos 10 personagens para todos; **pontuação calculada no servidor**; pontuações, posições e moedas só no pódio.
  Cada resultado entra no ranking da categoria (grava `games` + `scores`).
- Cada jogador tem um `pid` secreto (sessionStorage, para reconectar na mesma vaga) e um `id` público.
- Regras: nick repetido na sala é recusado; ninguém entra depois do início; quem cai no lobby sai; se o dono sai,
  o conectado mais antigo assume; pódio quando todos os conectados terminam ou o dono encerra; sala vazia some
  em 30 min (alarm). O progresso ("7/10") só é transmitido, sem gravar.
- Convite: `/?sala=CODIGO`. Sem nick: escolhe o nick e entra direto na sala. Com nick: entra direto.

## Front

- `App.tsx`: reducer `nick` → `intro` (home) → `playing` → `result`, ou `intro` → `party` / `shop`.
- A primeira tela é o nick. Telas fora da home têm "Início" no cabeçalho (na party, sai da sala).
- Se a API falhar, o jogo sorteia localmente (`gameId: null`) e não conta para o ranking.
- Imagens da partida pré-carregadas no sorteio; URL com `?v=<id da fonte>` para invalidar cache.
- `?review` só existe em dev (import lazy atrás de `import.meta.env.DEV`).

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
- `scripts/lib/images.mjs`: WebP 240px; imagens largas recortadas em 3:4 (`attention`, às vezes erra).
