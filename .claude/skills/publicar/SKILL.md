---
name: publicar
description: Checklist para publicar mudanças do Powerdle — migrações de banco, commit e push para a main (que roda os testes e faz o deploy na Cloudflare pelo GitHub Actions). Use quando o usuário pedir para commitar, publicar, subir ou fazer push, ou ao terminar uma mudança que altera o schema do D1.
---

# Publicar

1. **Conferir:** `npm run build` e os testes da mudança (skill `testar`). Não commitar com falha.
2. **Schema mudou?** (arquivo novo em `migrations/`)
   - Já aplicado localmente com `npm run db:migrate:local`.
   - Avise o usuário para rodar `npm.cmd run db:migrate:remote` **antes do push**. Nunca rode comandos `--remote`:
     produção é do usuário. Se ele disser que rodou, pode conferir só lendo:
     `npx wrangler d1 migrations list power-rank --remote` ("No migrations to apply").
   - Erro 7403 do Wrangler logo após renovar o token é momentâneo: rodar de novo.
   - Diga se a migração é **compatível** com o código em produção: só `ADD COLUMN`/tabela nova = pode rodar a
     qualquer hora; recria/renomeia tabela ou coluna (ex: 0007) = o site fica quebrado entre a migração e o deploy,
     então rodar logo antes do push. Teste a migração com dados antes (skill `banco-local`).
3. **Commit:** `git add` com os arquivos da mudança (não inclua `data/characters.json`/`public/chars/` se o usuário
   estiver mexendo neles em paralelo). Mensagem em inglês, resumo + tópicos, terminando com a linha
   `Co-Authored-By` do harness. Nunca commitar `.env`/`.dev.vars`.
4. **Push só quando o usuário pedir.** O push em `main` dispara o GitHub Actions (testes → deploy só se passarem); **não acompanhe o deploy**
   (o usuário confere no painel). Informe o intervalo de commits enviado. Às vezes o usuário roda a migração e dá
   o push ele mesmo: nesse caso deixe tudo commitado e diga quantos commits estão pendentes e qual migração rodar.
   - Se o usuário disser que o Action falhou: `gh run list --limit 3` e `gh run view <id> --log-failed | tail -40`.
     Falha no job `test` = nada foi publicado (corrigir e novo push). Falha isolada da Party (corrida de `sleep`)
     → "Re-run failed jobs". Falha só no `deploy` = token/secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
     No painel da Cloudflare, o deploy aparece como "manually deployed, wrangler" (é o normal).
5. **Depois do push**, se a mudança alterou pontuação ou poderes: lembrar o `npm.cmd run rescore -- --remote`.
6. Atualize `docs/IDEIAS.md` (status da ideia: 💡 → 🚧 → ✅; resumo em "Já feito") e, se a arquitetura mudou,
   a seção certa de `docs/ARQUITETURA.md`. Não leia os arquivos inteiros: `grep -n` pela ideia/seção e edite
   com `offset`/`limit`.
