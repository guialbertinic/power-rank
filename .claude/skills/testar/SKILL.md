---
name: testar
description: Roda e interpreta os testes do Power Rank (unitários, e2e de API e e2e de interface com Edge headless). Use depois de mudar lógica, servidor, party, loja ou UI, ou quando o usuário pedir para testar.
---

# Testar o Power Rank

Rode na pasta `games/anime-ranking`. **Economize tokens:** cada e2e completo é caro.

- **Durante o trabalho:** só `npm run build` (typecheck front + server) e, se mexeu em `src/game/*`, `npm test`.
  O build já é silencioso (só erros do `tsc` e avisos do Vite); se só quer saber se passou, `2>&1 | tail -15`.
  `npm test` com muitos testes: `npx vitest run <arquivo>` para rodar só o tocado.
- **e2e uma vez, no fim da tarefa**, só a suíte que a mudança toca:

| Mudou | Rode no fim |
|---|---|
| `src/game/*` (regras, pontuação, economia) | `npm test` |
| `server/*`, API, party, loja, nick | `npm run e2e:api -- <seção>` (só as seções tocadas) |
| telas, CSS, fluxo de navegação | `npm run e2e:ui` |
| só texto, documentação, estilo pequeno | nada além do `build` |

- Falhou: corrija e rode de novo **só o que falhou** (no e2e:api, a seção). Falha conhecida como instável (ver
  abaixo) → uma nova tentativa, sem investigar.
- Nunca rode e2e:api e e2e:ui "para garantir" depois de cada ajuste.

## Pré-requisito dos e2e

O dev server precisa estar rodando em http://localhost:5173. Confira com
`curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`. **Não suba o servidor por conta própria:** o
usuário roda o `npm.cmd run dev` no terminal dele. Se não estiver no ar, peça para ele subir. Mudou
`wrangler.jsonc`, `.dev.vars` ou migração? Rode `npm run db:migrate:local` e avise que ele precisa reiniciar o dev.
O `e2e:csp` precisa de `npx vite preview --port 4173`: peça também (ou pergunte antes de rodar).

## Lendo o resultado

- A saída já é curta: só as falhas (`✗`, com a seção) e o resumo ("Tudo certo: N checagens" ou "N falha(s), M ok").
  Use `2>&1 | tail -20`; `--verbose` mostra também os `✓` (só se precisar ver um valor de um teste que passou).
- Filtro de seções do e2e:api (parte do nome, sem diferenciar maiúsculas): `npm run e2e:api -- cassino party`.
  Seções: Catálogo, Segurança, Conta e convidado, Trocar nick, Economia e loja, Ranking, Cassino, Mystery Box, Party.
  O e2e:ui não filtra (as seções dependem umas das outras: a Ana é criada no começo e usada até o fim).
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
- Mudou `public/_headers` (CSP)? `npm run build`, peça ao usuário para subir `npx vite preview --port 4173` e rode `npm run e2e:csp`.
- Falha que se repete num texto: confira se o usuário não mudou a mensagem na tela (ele edita textos direto);
  ajuste o teste ao texto dele, não o contrário.

## Estendendo

Utilitários em `e2e/lib.mjs`: `player()`, `playSolo()`, `partyClient()`, `post()`, `get()`, `d1()`,
`launchBrowser()` (páginas isoladas = outros dispositivos), `chooseNick()` (Login → cria conta com `PASSWORD`),
`chooseGuest()` (entra como convidado), `placeAll()`, `overflowX()`.
Novo cenário: acrescente em `e2e/api.mjs` ou `e2e/ui.mjs` na seção certa, com `check('descrição', condição)`.
Seção nova no e2e:api: `if (section('Nome')) { ... }` (bloco independente, para o filtro poder pular).
Nicks sempre via `nick('Nome')` / `player('Nome')` (prefixo `E2e`; `player()` cria conta com senha).
Na API, o token identifica a conta (o `name` enviado junto é ignorado); convidado = sem token.
Precisa de saldo num teste de UI? `d1("UPDATE players SET coins = … WHERE name_key = '…'")` e recarregue a página.
