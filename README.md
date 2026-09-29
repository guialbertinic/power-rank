# Anime Power Rank

Jogo de browser: 10 personagens de anime são sorteados e aparecem um de cada vez. O jogador coloca cada um
numa posição de 1 (mais forte) a 10 (mais fraco), sem poder mudar depois. No fim, cada personagem pontua pela
distância entre a posição escolhida e a correta.

| Distância | Pontos |
|---|---|
| 0 | 100 |
| 1 | 60 |
| 2 | 30 |
| 3 | 10 |
| 4+ | 0 |

Personagens com o mesmo `power` aceitam qualquer uma das posições empatadas como correta.

## Rodando

Requer Node 22.12+ (o projeto usa Node 24, fixado em `.node-version`).

```bash
npm install
npm run db:migrate:local   # cria o D1 local em .wrangler/ (uma vez, e a cada migração nova)
npm run dev                # http://localhost:5173 — front + API (Worker) + D1 local, com hot reload
npm test                   # testes da lógica de pontuação
npm run build              # gera dist/client (site) e dist/power_rank (Worker)
```

## Estrutura

```
data/characters.json     fonte da verdade dos personagens (editar aqui)
public/chars/            imagens dos personagens
scripts/
  fetch-images.mjs       baixa imagens do AniList para quem não tem `image`
  validate-data.mjs      checa ids, campos e imagens
server/                  API (Cloudflare Worker)
  worker.ts              roteador de /api/*
  games.ts, scores.ts    rotas
migrations/              schema do D1
src/
  game/                  lógica pura (sorteio, pontuação) + testes
  components/            telas: Intro, Playing, Result
  App.tsx                máquina de estados do jogo
```

## Adicionando personagens

1. Adicione ao `data/characters.json`:
   ```json
   { "id": "all-for-one", "name": "All For One", "anime": "Boku no Hero Academia", "power": 64 }
   ```
   `version` é opcional e mostra qual arco/forma está valendo.
2. `npm run fetch:images` baixa a imagem do AniList.
   - Não achou? Adicione `"search"` com o nome como está no AniList (ex: `"Tanjirou Kamado"`).
   - Achou o personagem errado? Adicione `"anilistId"` e rode `npm run fetch:images -- <id>`.
3. `npm run validate`.

## Categorias

Cada personagem tem `category` (`anime` ou `games`) e `series` (a obra). O jogador escolhe **Animes**,
**Games** ou **Free for All** (todos misturados); cada modo tem o próprio ranking. A escala de `power` é a mesma
para todas as categorias, para o Free for All fazer sentido. Um modo só fica disponível com pelo menos 10 personagens.

### Imagens de games (IGDB)

`npm run fetch:images` busca as imagens de games no IGDB, que exige uma conta de desenvolvedor da Twitch (grátis):

1. Ative a autenticação em dois fatores na sua conta Twitch.
2. Em https://dev.twitch.tv/console, registre um aplicativo (redirect `http://localhost`, categoria
   Website Integration, cliente Confidencial).
3. Em "Gerenciar", copie o Client ID e gere um Client Secret.
4. Crie `.env` na raiz do projeto (já está no .gitignore):
   ```
   IGDB_CLIENT_ID=...
   IGDB_CLIENT_SECRET=...
   ```

## Deploy (Cloudflare Workers, grátis)

O Worker `power-rank` está conectado ao repositório no GitHub (Workers Builds): cada push na `main` roda
`npm run build` e `npx wrangler deploy`. Configuração em `wrangler.jsonc`: os assets do Vite são servidos
direto, e só `/api/*` passa pelo Worker. Deploy manual: `npm run deploy`.

## Ranking global (Worker + D1)

| Rota | O que faz |
|---|---|
| `POST /api/games` | Sorteia os 10 personagens no servidor e grava a partida. Devolve `{ gameId, characterIds }`. |
| `POST /api/scores` | `{ gameId, name, placements }`. Confere que `placements` usa exatamente os personagens da partida, recalcula a pontuação com `src/game/scoring.ts` e grava. Cada partida só pode ser enviada uma vez, em até 1h. |
| `GET /api/scores` | Top 20. |

Se a API falhar, o jogo sorteia localmente e esconde o envio ao ranking.

### Nova migração

Crie `migrations/0002_nome.sql`, rode `npm run db:migrate:local` para testar e `npm run db:migrate:remote`
antes de dar push no código que depende dela.
