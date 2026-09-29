---
name: banco-local
description: Consultar ou alterar o banco D1 local do Power Rank (dev) — dar moedas, listar contas, ver partidas, apagar dados de teste, zerar o banco. Use quando o usuário pedir para mexer no banco local, testar com saldo, ou quando a API local der "Erro interno" por falta de tabelas.
---

# Banco local (D1 do `npm run dev`)

São arquivos SQLite em `.wrangler/state/v3/d1/` (fora do git). **Sempre `--local`**: sem ele o comando vai para
produção, que é do usuário (nunca rode `--remote` que escreve).

```bash
npx wrangler d1 execute power-rank --local --command "<SQL>"
```

(no PowerShell do usuário: `npx.cmd`). Saída é JSON; filtre com `| grep '"campo"'`.

## Receitas

| Quer | SQL |
|---|---|
| Listar contas | `SELECT id, name, name_key, coins, title FROM players` |
| Dar moedas | `UPDATE players SET coins = coins + 1000 WHERE name_key = 'nick'` (`name_key` = nick minúsculo) |
| Itens de uma conta | `SELECT item_id FROM player_items WHERE player_id = <id>` |
| Últimas partidas | `SELECT name, player_id, mode, score, coins FROM scores ORDER BY created_at DESC LIMIT 10` |
| Tabelas | `SELECT name FROM sqlite_master WHERE type = 'table'` |

Convidados não têm linha em `players` (não têm saldo). Depois de mudar saldo/itens, o jogo só mostra ao recarregar
o perfil: "Forçar sincronização" no menu do perfil ou recarregar a página.

## Apagar e zerar

- Dados de teste (`E2e…`): os e2e limpam sozinhos (`cleanTestData` em `e2e/lib.mjs`). Ordem das tabelas por causa
  das chaves estrangeiras: `player_items`, `player_tokens`, `scores`, `games`, `players`.
- Zerar tudo: parar o dev, apagar `.wrangler/state/v3/d1`, `npm run db:migrate:local`, subir o dev.
- API local com "Erro interno" e banco sem tabelas: faltou `npm run db:migrate:local`.
- Antes de uma migração arriscada, faça backup copiando `.wrangler/state/v3/d1` para o scratchpad.

## Armadilhas

- Erro de SQLite logo depois de um `d1()` de teste: disputa entre o Wrangler e o dev server pelo arquivo. Rode de novo.
- Testar migração nova com dados: insira linhas no formato antigo, aplique com `db:migrate:local`, confira com
  `SELECT` e `PRAGMA foreign_key_check`, e apague as linhas.
