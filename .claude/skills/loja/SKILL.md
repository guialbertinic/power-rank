---
name: loja
description: Mexer na loja e na economia do Power Rank — adicionar/renomear cores de nick, molduras, títulos e avatares, criar um espaço (slot) novo de cosmético, ajustar preços e ganhos de moedas, ou qualquer recurso que debita/credita moedas (ex: gambling). Use quando o usuário pedir itens novos, mudanças na loja ou nas moedas.
---

# Loja e economia

Referência: `docs/ARQUITETURA.md` → "Economia e cosméticos". Tudo que envolve moedas roda **no servidor**.

## Escala de preços

Uma partida rende no máximo **60** moedas (950+ pontos; ver `src/game/economy.ts`) e o pódio da party até +20.
Uma partida "boa" rende 10–20. Faixas usadas: básico 40–80 · médio 150–250 · raro 350–500 · lendário 600–800.
Avatar é sempre `AVATAR_PRICE` (50): preço por força revelaria o `power`.

## Item novo (cor, moldura ou título)

1. Entrada em `COSMETICS` (`src/game/cosmetics.ts`): `id` com prefixo do espaço (`name-`, `frame-`, `title-`),
   `label` em português, `price`. Títulos: helper `title('slug', 'Texto', preço, 'Categoria')` — o `label` é o
   texto exibido; a categoria (Iniciante, Otaku, Animes, Games, Lendário) agrupa na loja.
2. Nome em inglês em `src/i18n/catalog.ts` (`COSMETICS_EN`, pelo id).
3. Cor/moldura: classe `.cosmetic-<id>` em `src/styles.css`, junto das outras (seção "Cosméticos").
   - Cor: `color` + `text-shadow`, ou gradiente com `background-clip: text`.
   - Moldura: estilo em `.cosmetic-<id> .player-frame-border` (a borda) e brilho com `filter: drop-shadow`
     no wrapper `.cosmetic-<id>` (clip-path corta box-shadow). Anel girando: `conic-gradient(from
     var(--cosmetic-angle) …)` + `animation: cosmetic-spin`.
   - Animações já param com "reduzir movimento" (regra global); só cores/efeitos, nada de imagem.
4. O servidor valida sozinho (preço e espaço vêm do catálogo). A loja ordena por preço.
5. Teste: o e2e de UI acha itens por `[data-label="<label>"]`; não precisa de teste por item.

**Renomear:** pode trocar o `label` à vontade. **Nunca troque o `id`** de item já publicado: ele está gravado em
`player_items` e no visual equipado (`players.name_color`/`frame`/`title`).

## Espaço (slot) novo de cosmético

Exige migração (`ALTER TABLE players ADD COLUMN <coluna> TEXT`, sem risco para o código em produção) e:
`CosmeticSlot` + `Look` + `EMPTY_LOOK` (cosmetics.ts) · `LookRow`/`toLook`/`lookOf`/`loadProfile`/`SLOT_COLUMN`
(`server/profile.ts`) · SELECT do ranking (`server/scores.ts`) · aba em `ShopScreen` · exibição em `PlayerTag`.

## Moedas: débito e crédito seguros

- Débito: `UPDATE players SET coins = coins - ? WHERE id = ? AND coins >= ?` e conferir `meta.changes`
  (sem saldo = 0 linhas). Nunca ler o saldo e depois gravar (corrida entre dois cliques).
- Compra: registra o item com `INSERT OR IGNORE` **antes** de debitar; se o débito falhar, desfaz o item.
- Crédito: `creditCoins(env, playerId, n)` (devolve o saldo). Convidado (`player_id` NULL) nunca ganha moedas.
- Sorteio/resultado (ex: gambling) só no servidor, com `crypto.getRandomValues`; débito da aposta e crédito do
  prêmio numa operação só (`env.DB.batch`) ou com a condição de saldo no próprio UPDATE. O cliente só anima.
- Moedas nunca compráveis com dinheiro real.

## Mystery Box e cassino

Mexer na gacha ou no cassino (pesos, multiplicadores, itens exclusivos, ícones): leia `cassino-gacha.md`
nesta pasta.

## UI da loja

Cor = o nome da cor com o efeito; moldura = quadro vazio (`.shop-frame-empty`); título = por categoria, 2 por
linha (`.shop-group` + `.shop-rows`, 1 por linha abaixo de 560px).
Botões que esperam o servidor usam `aria-busy` (spinner em `.btn`/`.shop-action`); só o clicado mostra o loading.
Sem screenshots: valide com `npm run e2e:ui`.
