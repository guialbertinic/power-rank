# Power Rank

Jogo de browser de **blind ranking de poder**. São sorteados 10 personagens, que aparecem um de cada vez; você
coloca cada um numa posição de 1 (mais forte) a 10 sem saber quem vem depois, e não pode mudar.

- **Categorias:** Animes (368 personagens), Games (70) e Free for All (todos juntos), cada uma com seu ranking.
- **Pontuação por ordem entre pares:** cada um dos 45 pares vale se o mais forte ficou acima. Máximo 1000;
  chutar dá ~500.
- **Solo e Party:** na party, até 8 pessoas entram numa sala por código de 6 letras (ou link de convite), jogam os
  mesmos 10 personagens ao mesmo tempo e veem o pódio no final.
- **Nick com dono**, sincronizável entre dispositivos por código.
- **Moedas** a partir de 500 pontos e **loja** de cosméticos (cor do nick, moldura, avatar) que aparecem no ranking.

## Rodando

Node 22.12+ (o projeto usa Node 24, `.node-version`).

```bash
npm install
npm run db:migrate:local   # cria o D1 local em .wrangler/ (e a cada migração nova)
npm run dev                # http://localhost:5173 — front + API (Worker) + D1 local, com hot reload
npm test                   # testes unitários
npm run e2e:api            # testes de ponta a ponta da API (com o dev rodando)
npm run e2e:ui             # testes de interface com Edge/Chrome headless (com o dev rodando)
npm run build              # typecheck + build (dist/client e dist/power_rank)
```

`/?review` (só em dev) lista todos os personagens por poder, com filtros, para revisar a escala.

## Stack

React 19 + TypeScript + Vite · Cloudflare Workers (API + assets) · D1 (SQLite) · Durable Objects (salas da party,
WebSocket). Tudo no plano grátis da Cloudflare.

Detalhes de estrutura, API, regras, party, economia, design system e imagens: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).
Ideias e roadmap: [docs/IDEIAS.md](docs/IDEIAS.md).

## Personagens e imagens

A base fica em `data/characters.json` (`id`, `name`, `category`, `series`, `version?`, `power` 0–100).

```bash
npm run fetch:images                          # imagens faltantes: AniList (anime), Wikipédia/IGDB (games)
npm run import:image -- <id> <arquivo>        # imagem baixada à mão
npm run contact-sheet -- --category games     # mosaico para conferir as imagens
npm run validate
```

Imagens de games pelo IGDB exigem `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` num `.env` (app grátis em
https://dev.twitch.tv/console, com autenticação em dois fatores na conta Twitch). O `.env` está no `.gitignore`.

## Deploy

O Worker `power-rank` está conectado a este repositório (Workers Builds): cada push na `main` roda o build e o
`wrangler deploy`. Mudanças de schema: `npm run db:migrate:remote` **antes** do push. Depois de mudar pontuação ou
poderes: `npm run rescore -- --remote`.
