---
name: testar
description: Roda e interpreta os testes do Power Rank (unitários, e2e de API e e2e de interface com Edge headless). Use depois de mudar lógica, servidor, party, loja ou UI, ou quando o usuário pedir para testar.
---

# Testar o Power Rank

Rode na pasta `games/anime-ranking`. Escolha só o necessário para a mudança:

| Mudou | Rode |
|---|---|
| `src/game/*` (regras, pontuação, economia) | `npm test` |
| `server/*`, API, party, loja, nick | `npm run e2e:api` |
| telas, CSS, fluxo de navegação | `npm run e2e:ui` |
| antes de commitar qualquer coisa | `npm run build` (typecheck front + server) |

## Pré-requisito dos e2e

O dev server precisa estar rodando em http://localhost:5173. Confira com
`curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`. Se não estiver, suba em segundo plano
(`npx vite --port 5173 --strictPort`, com `run_in_background`). Mudou `wrangler.jsonc` ou migração? Reinicie
o servidor e rode `npm run db:migrate:local` antes.

## Lendo o resultado

- Cada teste imprime `✓`/`✗` por cenário e termina com "Tudo certo" ou "N falha(s)". Use
  `2>&1 | grep -E "^(✓|✗|—)|Tudo|falha"` para uma saída curta.
- Os e2e limpam sozinhos os nicks de teste (prefixo `E2e`) do D1 local, no começo e no fim.
- `e2e:ui` salva screenshots em `e2e/screenshots/`: `home`, `party-lobby-celular`, `party-espera`,
  `party-podio`, `loja`, `solo-resultado`, `home-celular`. **Abra só os que têm a ver com a mudança.**
- HTTP 500 em `/api/scores` logo depois de um `d1()` do teste: disputa pelo SQLite local entre o Wrangler e o dev
  server. Só existe em dev; rode de novo.

## Estendendo

Utilitários em `e2e/lib.mjs`: `player()`, `playSolo()`, `partyClient()`, `post()`, `get()`, `d1()`,
`launchBrowser()` (páginas isoladas = outros dispositivos), `chooseNick()`, `placeAll()`, `shot()`, `overflowX()`.
Novo cenário: acrescente em `e2e/api.mjs` ou `e2e/ui.mjs` na seção certa, com `check('descrição', condição)`.
Nicks sempre via `nick('Nome')` / `player('Nome')` (prefixo `E2e`).
