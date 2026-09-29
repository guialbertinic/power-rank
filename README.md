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
npm run dev        # http://localhost:5173
npm test           # testes da lógica de pontuação
npm run build      # gera dist/ (site estático)
```

## Estrutura

```
data/characters.json     fonte da verdade dos personagens (editar aqui)
public/chars/            imagens dos personagens
scripts/
  fetch-images.mjs       baixa imagens do AniList para quem não tem `image`
  validate-data.mjs      checa ids, campos e imagens
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

## Deploy grátis (Cloudflare Pages)

1. Suba este diretório para um repositório no GitHub.
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → conectar o repo.
3. Build command: `npm run build` · Output directory: `dist` · (se o jogo estiver numa subpasta do repo,
   configure o "Root directory").
4. Cada push na branch principal faz deploy automático.

## Próximo passo: ranking global

- `functions/api/scores.ts` → Cloudflare Pages Functions (vira `/api/scores` automaticamente).
- Banco: Cloudflare D1 (SQLite), tabela `scores(id, name, score, character_ids, positions, created_at)`.
- O servidor recalcula a pontuação a partir de `characters.json` em vez de confiar no número enviado pelo cliente.
