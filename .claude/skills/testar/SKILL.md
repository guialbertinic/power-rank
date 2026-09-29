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
- `e2e:ui` **não tira screenshots** (custa tokens): valide layout com checagens (`overflowX()`, posição via
  `getBoundingClientRect`, texto/seletor). Não gere nem abra imagens para conferir tela.
- HTTP 500 em `/api/scores` logo depois de um `d1()` do teste: disputa pelo SQLite local entre o Wrangler e o dev
  server. Só existe em dev; rode de novo.
- Falha isolada num teste da **Party** do `e2e:api` (ex: "só o dono inicia", "queda aparece como desconectado",
  "dono sai → outro vira dono"): esses testes esperam com `sleep` fixo e às vezes perdem a corrida. Rode de novo
  antes de investigar; se repetir, é real. Em teste novo, espere o estado (`waitForFunction`/`waitForSelector`,
  como o `buyAndEquip` da loja), não um tempo fixo.
- Regras do servidor que os testes respeitam: partida solo leva ≥ 3 s (`playSolo` espera; `placeAll` posiciona em
  ritmo humano); conta nova precisa do token do anti-bot (`player()` manda `TURNSTILE_TEST_TOKEN`; na UI,
  `chooseNick` espera o botão liberar). Limite por IP só vale com `x-rate-limit-test: 1`.
- Mudou `public/_headers` (CSP)? `npm run build`, `npx vite preview --port 4173` (em segundo plano) e `npm run e2e:csp`.
- Falha que se repete num texto: confira se o usuário não mudou a mensagem na tela (ele edita textos direto);
  ajuste o teste ao texto dele, não o contrário.

## Estendendo

Utilitários em `e2e/lib.mjs`: `player()`, `playSolo()`, `partyClient()`, `post()`, `get()`, `d1()`,
`launchBrowser()` (páginas isoladas = outros dispositivos), `chooseNick()` (Login → cria conta com `PASSWORD`),
`chooseGuest()` (entra como convidado), `placeAll()`, `overflowX()`.
Novo cenário: acrescente em `e2e/api.mjs` ou `e2e/ui.mjs` na seção certa, com `check('descrição', condição)`.
Nicks sempre via `nick('Nome')` / `player('Nome')` (prefixo `E2e`; `player()` cria conta com senha).
Na API, o token identifica a conta (o `name` enviado junto é ignorado); convidado = sem token.
Precisa de saldo num teste de UI? `d1("UPDATE players SET coins = … WHERE name_key = '…'")` e recarregue a página.
