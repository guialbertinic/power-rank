# Anime Power Rank — guia do projeto

Jogo de browser de "blind ranking" de poder. São sorteados 10 personagens, que aparecem um de cada vez.
O jogador coloca cada um numa posição de 1 (mais forte) a 10 e não pode mudar depois.
No ar em Cloudflare Workers, repo `github.com/guialbertinic/power-rank` (branch `main`, com deploy automático a cada push).

Idioma: a interface, os comentários e os commits de conteúdo são em **português**. Nomes de código em inglês.

## Stack

- **Front:** React 19 + TypeScript + Vite 8, sem biblioteca de UI; CSS próprio com design tokens.
- **Back:** um Cloudflare Worker (`server/worker.ts`) que só atende `/api/*`. O resto são assets estáticos do Vite.
- **Banco:** Cloudflare D1 (SQLite), binding `DB`, database `power-rank`.
- **Multiplayer:** Durable Object `PartyRoom` (binding `PARTY`), um por sala, com WebSocket (API de hibernação).
- **Dev:** `@cloudflare/vite-plugin`. Um único `npm run dev` sobe front, Worker e D1 local em http://localhost:5173.
- **Node 24** (`.node-version`). No PowerShell do usuário, `npx`/`npm` só funcionam como `npx.cmd`/`npm.cmd`.

## Comandos

```bash
npm run dev                  # front + API + D1 local (http://localhost:5173, revisão da base em /?review)
npm test                     # vitest (lógica pura em src/game)
npm run build                # typecheck (front + server) + build
npm run validate             # valida data/characters.json
npm run fetch:images         # baixa imagens faltantes (AniList / IGDB / Wikipédia)
npm run import:image -- <id> <arquivo>   # importa imagem baixada à mão
npm run db:migrate:local     # aplica migrations/ no D1 local
npm run db:migrate:remote    # produção — QUEM RODA É O USUÁRIO (ver "Produção")
npm run rescore -- --local   # recalcula pontuações gravadas com a regra/poderes atuais
```

## Estrutura

```
data/characters.json      base de personagens (fonte da verdade, ordenada por power desc)
public/chars/<id>.webp    imagens 240px (≈18 KB cada)
public/_headers           cache: /chars 7 dias, /assets imutável
migrations/               schema do D1 (0001 scores, 0002 melhor por jogador, 0003 categorias, 0004 donos de nick,
                          0005 moedas e cosméticos)
scripts/                  fetch-images, import-image, validate-data, rescore (+ lib/images.mjs)
server/                   Worker: worker.ts (roteador), games.ts, scores.ts, players.ts (nick), profile.ts (moedas, loja),
                          party.ts (Durable Object), lib.ts
src/game/                 lógica pura e compartilhada com o server: types, draw, scoring, modes, party (protocolo),
                          economy (moedas por pontuação), cosmetics (catálogo da loja)
src/data.ts               a base de personagens (POOL, POOL_BY_ID) para o front
src/party/                cliente da party: usePartyRoom (WebSocket + reconexão), session (pid, link de convite)
src/components/party/     telas da party: PartyScreen, Lobby, Play, Waiting, Podium, PlayerList
src/components/           telas e componentes (Intro, Playing, Result, Leaderboard, PowerCard...)
src/styles/tokens.css     design tokens (cores, tiers, fontes, chanfros)
src/styles.css            componentes
src/ui/                   tiers (posição/poder → cor), fallback (URL de imagem, preload, iniciais)
```

`src/game/*` é importado tanto pelo front quanto pelo Worker: mantenha esses arquivos sem dependência de DOM.

## Regras do jogo

- **Personagem** (`src/game/types.ts`): `id`, `name`, `category` (`anime` | `games`), `series` (obra),
  `version?` (arco/forma considerada), `power` 0–100, `image?`, e campos de origem da imagem
  (`anilistId`, `igdbId`, `wikipedia`, `search`, `imageVersion`).
- **Escala de poder universal**, a mesma para todas as categorias (o Free for All depende disso):
  0–15 humano · 15–40 sobre-humano · 40–60 prédio→cidade · 60–75 cidade→montanha · 75–85 ilha→continente ·
  85–95 planeta→estrela · 95–100 galáxia+. Os valores são propostas; o usuário revisa em `/?review`.
- **Sorteio** (`draw.ts`): Fisher-Yates uniforme sobre o pool do modo, sem regra de espaçamento. Pode vir tudo
  fraco ou tudo forte, e isso é intencional. O pool exclui personagens sem imagem.
- **Pontuação** (`scoring.ts`): ordem entre pares. Cada um dos 45 pares vale se o mais forte ficou acima
  (empate de poder conta como certo). `total = round(1000 * paresCertos / 45)`. Ordem aleatória ≈ 500.
- **Modos** (`modes.ts`): `anime`, `games`, `all` (Free for All). Cada modo tem o próprio ranking.
  Um modo só fica disponível com ≥ 10 personagens sorteáveis.

## API (server/)

| Rota | O que faz |
|---|---|
| `POST /api/players` `{ name, token? }` | Escolhe o nick. Livre: fica seu, devolve `{ token }`. Seu (token válido): confirma. De outra pessoa: 409. |
| `POST /api/players/sync-code` `{ name, token }` | Gera um novo código de sincronização (o anterior deixa de valer). |
| `POST /api/players/recover` `{ name, recoveryCode }` | Código de sincronização certo: devolve um token novo para este aparelho. |
| `POST /api/games` `{ name, token, mode }` | Exige token do dono do nick (401 se não). Sorteia no servidor e grava a partida. |
| `POST /api/scores` `{ gameId, placements }` | Nick e modo vêm da partida. Valida as posições, **recalcula a pontuação no servidor**, grava. Uma vez por partida, TTL de 1h. |
| `GET /api/scores?mode=` | Top 20 do modo, **só o melhor resultado de cada nick** (sem diferenciar maiúsculas). |

| `POST /api/party` `{ mode, pid }` | Cria a sala (código de 6 letras, sem I/O) e devolve `{ code }`. |
| `GET /api/party/:code/ws?pid=&name=&token=` | WebSocket da sala (encaminhado ao Durable Object). |
| `POST /api/profile` `{ name, token }` | Saldo, itens comprados e visual equipado. |
| `POST /api/shop/buy` `{ name, token, itemId }` | Compra: registra o item (INSERT OR IGNORE) e só então debita com `coins >= preço` no próprio UPDATE; sem saldo, desfaz. Clique duplo não cobra duas vezes. |
| `POST /api/profile/equip` `{ name, token, slot, itemId | null }` | Equipa (ou tira) um item que o jogador tem. |

`scores` guarda todas as partidas (histórico); o ranking é uma consulta com `ROW_NUMBER() OVER (PARTITION BY name_key)`.
**Nick com dono (sem login):** o primeiro navegador que usa um nick fica com ele (`players`). Cada aparelho do dono
tem um token (`player_tokens`). Para levar o nick a outro aparelho, o dono toca em "Sincronizar dispositivo" na home,
que gera um código XXXX-XXXX-XXXX (cada novo código invalida o anterior); no outro aparelho, digita o nick e o código. Tokens e código ficam no banco só como hash SHA-256. Criar partida solo e entrar em sala da party
exigem o token.

## Economia e cosméticos

- **Moedas** (`src/game/economy.ts`), sempre creditadas no servidor ao gravar o resultado (solo e party):
  < 500 pontos: 0 (anti-spam, sem limite diário) · 500–599: 5 · 600–749: 10 · 750–849: 20 · 850–949: 35 · 950+: 60.
  Bônus de pódio na party (1º +20, 2º +10, 3º +5) só com 2+ jogadores que terminaram **e** 500+ pontos.
  O `rescore` não mexe em moedas já creditadas.
- **Loja** (`ShopScreen`, catálogo em `src/game/cosmetics.ts`): cor do nick, moldura do avatar e avatar
  (qualquer personagem da base, preço único de 50: preço por força revelaria o poder).
- **Visual** (`PlayerTag`): avatar + moldura + nick colorido, no ranking, na lista da party, no pódio e na home.
  Cada cosmético é uma classe `cosmetic-<id>` em `styles.css`. Moldura: brilho no wrapper (`filter`),
  borda no interno (`clip-path`).
- A party lê o visual do jogador ao entrar na sala (junto da verificação do token, antes das checagens).

## Party (multiplayer)

- Fluxo da sala: `lobby` → `playing` → `podium` → (o dono inicia de novo) → `playing`. Máximo de 8 jogadores.
- Protocolo em `src/game/party.ts`. Cliente → sala: `start`, `progress`, `finish`, `end`.
  Sala → cliente: `state` (estado completo a cada mudança) e `error`.
- O servidor sorteia os mesmos 10 personagens para todos e **calcula a pontuação** a partir das posições enviadas.
  Pontuações e posições só aparecem no pódio. O resultado de cada jogador entra no ranking da categoria
  (grava `games` + `scores` no D1).
- Identidade: cada jogador tem um `pid` secreto (gerado na aba, guardado no `sessionStorage`, usado para reconectar
  na mesma vaga) e um `id` público. O `pid` nunca é enviado aos outros.
- Regras: nick repetido na sala é recusado; ninguém entra depois do início; quem cai no lobby sai da sala;
  se o dono sai, o jogador conectado mais antigo assume; o pódio aparece quando todos os conectados terminam
  ou quando o dono encerra. Sala sem ninguém é apagada em 30 min (alarm).
- O progresso ("7/10") é só transmitido, sem gravar no storage (gravar atrasava cada clique).
- Link de convite: `/?sala=CODIGO` abre o painel da party com o código preenchido.
- **Teste:** um script Node com `WebSocket` nativo contra `npm run dev` cobre os cenários do servidor, e o fluxo
  de interface é testado com dois contextos isolados do Edge headless (puppeteer-core via `--remote-debugging-port`).
  Depois, apague do D1 local os nicks de teste.

## Front

- `App.tsx` tem uma máquina de estados via reducer: `nick` → `intro` (home) → `playing` → `result`,
  ou `intro` → `party`. Na party, o estado do jogo vem da sala, e o App só guarda `code` e `pid`.
- **A primeira tela é o nick** (`NickScreen`), para quem ainda não tem identidade; escolhido o nick, segue direto
  para o jogo. Link de convite sem nick: escolhe o nick e entra direto na sala. Com nick: entra direto.
  A home mostra "Jogando como X · Trocar" e "Sincronizar dispositivo" (`SyncDevice`).
- Todas as telas fora da home têm o botão **Início** no cabeçalho (na party, sair da sala).
- Identidade (`{ name, token }`) e os tokens de nicks já usados ficam no `localStorage` (`src/nick.ts`).
- A última categoria também fica no `localStorage`. Todo acesso a storage usa try/catch.
- Se a API falhar, o jogo sorteia localmente (`gameId: null`) e a partida não conta para o ranking.
- As imagens da partida são pré-carregadas no sorteio (`preloadImages`). A URL leva `?v=<id da fonte>` para
  invalidar o cache quando a imagem muda.
- A tela `?review` só existe em dev (import lazy atrás de `import.meta.env.DEV`).

## Design system ("Dark Battle Interface")

- Use sempre os tokens de `tokens.css`; não use cores soltas. Tiers `.tier-ss … .tier-d` expõem
  `--tier-color`, `--tier-fill`, `--tier-text`, `--tier-on`.
- Posição → tier: #1 SS, #2–3 S, #4–5 A, #6–7 B, #8–9 C, #10 D. Poder → tier: ≥95 SS, ≥85 S, ≥75 A, ≥60 B, ≥45 C.
- Formas angulares (`--clip-slant`, `--clip-chamfer`) e `--radius: 2px`. Nada de cantos muito arredondados.
- `clip-path` corta `box-shadow`: brilho vai num wrapper com `filter: drop-shadow`, e o foco de botões é uma barra inset.
- Fontes: Chakra Petch (display, caixa alta, itálico) e Rajdhani (corpo), via `@fontsource`, só o subset latin.
- **O valor de poder nunca aparece para o jogador**, nem na partida (entregaria a resposta) nem no resultado
  (daria para decorar). O resultado mostra só a ordem correta. O poder só aparece na tela `?review` (dev).
- Sempre conferir no celular (390px): grids com `minmax(0, 1fr)`, sem scroll horizontal.
- Respeitar `prefers-reduced-motion`.

## Imagens de personagem

- **Anime:** AniList (GraphQL, sem chave). Limite de ~30–90 req/min; o script espera sozinho no 429.
  Nomes em romanização japonesa ("Tanjirou", "Toudou"): use `search` ou fixe `anilistId`.
- **Games:** o IGDB (credenciais da Twitch no `.env`) tem os personagens, mas quase sem retrato. A fonte principal
  é a imagem do artigo da **Wikipédia** em inglês (`wikipedia: "Título exato"`, API com `pilicense=any`).
  A **Fandom bloqueia downloads por script** (403). Não contornar com User-Agent ou Referer falsos: usar `import:image`.
- `scripts/lib/images.mjs` converte tudo para WebP 240px e recorta imagens largas em 3:4 (`attention`).
  Confira o resultado visualmente: o recorte automático às vezes erra.
- Depois de baixar em lote, **monte um mosaico e confira** se é o personagem certo (nomes genéricos como
  "King" já vieram trocados).

## Produção e segurança

- **Migrations e comandos `--remote` no D1 de produção são executados pelo usuário**, não pelo Claude.
  Ordem de deploy: `db:migrate:remote` → push. Depois de mudar pontuação ou poderes: `rescore -- --remote`.
- Durable Objects: a migração da classe fica no `wrangler.jsonc` (`migrations` com `new_sqlite_classes`) e é aplicada
  no deploy. Renomear ou remover a classe exige uma nova tag de migração.
- Push em `main` publica em produção. Só fazer push quando o usuário pedir.
- `.env` e `.dev.vars` estão no `.gitignore`. Nunca commitar nem imprimir credenciais.
- O autor dos commits é configurado só neste repo (Guilherme Albertini).

## Armadilhas já encontradas

- **Não editar arquivos com `Get-Content`/`Set-Content` do PowerShell 5.1**: ele lê UTF-8 como ANSI e grava BOM,
  o que corrompe acentos (`ç` → `Ã§`). Use as ferramentas de edição, ou Node para edições por script.
- Heredocs longos no Bash quebram com aspas; para arquivos grandes, use a ferramenta Write.
- O Vitest tem config própria (`vitest.config.ts`) para não carregar o plugin da Cloudflare.
- Regras CSS de celular precisam vir **depois** das regras base (ordem da cascata).
- Mudanças no `wrangler.jsonc` (bindings, Durable Objects) exigem reiniciar o `npm run dev`.
- Não chame um método de `connect` numa classe `DurableObject`: colide com a classe base.
- **Durable Object + I/O externo:** durante um `await` de `fetch` ou D1, o objeto processa outras mensagens.
  Faça as consultas antes e as checagens + mudanças de estado juntas, sem `await` no meio (senão duas conexões
  do mesmo jogador entram as duas — já aconteceu com o React StrictMode).
- Os testes de interface criam nicks com dono (Ana, Bruno...). Apague do D1 local antes de rodar de novo e no fim.
- `npm audit` acusa o `undici` dentro do miniflare (só em dev); não vale o downgrade sugerido.
