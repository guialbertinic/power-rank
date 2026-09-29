# Anime Power Rank

Jogo de browser de "blind ranking" de poder: 10 personagens sorteados aparecem um de cada vez e o jogador coloca
cada um numa posição de 1 a 10, sem poder mudar. Solo e Party (multiplayer), categorias Animes / Games / Free for All,
conta (nick + senha) ou convidado, moedas e loja de cosméticos.
No ar em Cloudflare Workers; repo `github.com/guialbertinic/power-rank`, deploy automático a cada push na `main`.

**Referência completa (estrutura, API, regras, party, economia, design system, imagens): `docs/ARQUITETURA.md`.
Leia só a seção necessária.** Ideias e roadmap: `docs/IDEIAS.md` (modos de jogo planejados, cassino, legal).

## Skills do projeto (`.claude/skills/`)

- `testar` — rodar e interpretar os testes (unitários, e2e de API e de interface).
- `personagens` — adicionar personagens, poderes e imagens.
- `publicar` — migrações, commit e push.
- `loja` — itens da loja (cores, molduras, títulos), preços, espaço novo, qualquer débito/crédito de moedas.
- `banco-local` — consultar/alterar o D1 local (dar moedas, listar, zerar, testar migração).

## Stack e comandos

React 19 + TS + Vite 8 · Cloudflare Worker (`server/`) + D1 (`DB`) + Durable Object `PartyRoom` (`PARTY`) ·
Node 24. No PowerShell do usuário: `npm.cmd`/`npx.cmd`.

```bash
npm run dev            # front + API + D1 local em http://localhost:5173 (revisão da base: /?review)
npm run build          # typecheck (front + server) + build
npm test               # unitários (src/game)
npm run e2e:api        # e2e sem navegador (precisa do dev rodando)
npm run e2e:ui         # e2e com Edge headless (sem screenshots)
npm run e2e:csp        # CSP no build de produção (precisa de: npm run build + npx vite preview --port 4173)
npm run validate       # valida data/characters.json
npm run characters:sync # copia data/characters.json para o D1 local (-- --remote: produção, o usuário roda)
npm run contact-sheet -- <ids> | --category games | --series "X" | --recent N   # mosaico de imagens
npm run db:migrate:local
```

## Regras de trabalho

- Interface, comentários e textos em **português**; nomes de código em inglês. Commits com a linha
  `Co-Authored-By` pedida pelo harness.
- **Produção é do usuário:** qualquer comando `--remote` (migração, rescore, SQL) ele roda. Push só quando pedir.
  Depois do push, não acompanhar o deploy. Mudança de schema: `migrations/000N_*.sql`, aplicar local, e avisar que
  precisa de `db:migrate:remote` antes do push.
- `src/game/*` é compartilhado com o Worker: sem DOM.
- **O `power` nunca chega ao site**: o servidor lê do D1 (`characters`), o site recebe só o catálogo público e, no
  fim da partida, a ordem (`ranks`). `/?review` só funciona no dev local. Não importar `data/characters.json` no front.
- Pontuação, moedas, compras e sorteios sempre no servidor; o cliente só envia escolhas.
- Durable Object: durante um `await` de I/O externo (D1, fetch) outras mensagens rodam. Consultas antes;
  checagens + mudança de estado juntas, sem `await` no meio.
- UI: só tokens de `tokens.css`; conferir no celular (390px) sem scroll horizontal. Validar mudança visual com
  `npm run e2e:ui` (checagens por seletor/posição). **Não tirar nem abrir screenshots** (custa tokens).
- Nicks de teste começam com `E2e` (os e2e limpam por prefixo). Não deixar dados de teste no D1 local.
- `.env`/`.dev.vars` nunca no git nem impressos.

## Armadilhas

- PowerShell 5.1 `Get-Content`/`Set-Content` corrompe acentos (lê UTF-8 como ANSI, grava BOM): editar com as
  ferramentas de edição ou Node.
- Em `String.replace` do JS, `$$` na string de substituição vira `$`: para código com `$$`, use a ferramenta Edit.
- Heredoc longo no Bash quebra com aspas: arquivos grandes com a ferramenta Write.
- Regras CSS de celular vêm **depois** das regras base. Vitest tem config própria (`vitest.config.ts`).
- Mudou `wrangler.jsonc` (bindings, Durable Objects)? Reinicie o `npm run dev`. Não nomeie método `connect` num
  `DurableObject`.
- `puppeteer.launch` falha neste Windows: `e2e/lib.mjs` inicia o Edge com `--remote-debugging-port` e conecta.
- `npm audit` acusa `undici` do miniflare (só dev); não fazer o downgrade sugerido.
