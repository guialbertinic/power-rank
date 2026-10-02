---
name: personagens
description: Adiciona ou corrige personagens do Power Rank (anime, games ou Pokémon) com valor de poder e imagem: monta as entradas, baixa imagens (AniList/IGDB/Wikipédia/PokeAPI), confere com mosaico e valida. Use quando o usuário pedir mais personagens, uma franquia nova, ajuste de poder ou troca de imagem.
---

# Personagens

## 1. Entradas em `data/characters.json`

```json
{ "id": "kebab-unico", "name": "Nome", "category": "anime", "series": "Obra", "tier": 2, "version": "Forma/arco", "power": 80 }
```

- `id` minúsculo com hífens, único. `version` é opcional (qual forma vale).
- **Escala universal de `power`** (vale para todas as categorias): 0–15 humano · 15–40 sobre-humano ·
  40–60 prédio→cidade · 60–75 cidade→montanha · 75–85 ilha→continente · 85–95 planeta→estrela · 95–100 galáxia+.
  Encaixe os novos em relação aos existentes da mesma obra e de obras parecidas (`grep` no JSON).
- **`tier`** (anime e games, obrigatório; o `validate` recusa sem): fama do personagem, que define a dificuldade em
  que ele aparece (fácil = 1, médio = 1–2, difícil = todos). 1 mainstream (obra muito conhecida e personagem
  central), 2 médio (obra menos famosa ou coadjuvante), 3 obscuro. Base pela fama da obra (popularidade do anime no
  AniList, ajustada para o público brasileiro: CDZ e Yu Yu são 1) e desce um tier para coadjuvante com poucos
  favoritos no AniList; compare com os da mesma obra (`grep`). Pokémon não tem.
- `series` igual ao título usado pela fonte da imagem ajuda a conferir a correspondência (ex.: "Naruto Shippuden").
- Para lotes grandes, escreva as entradas num `.mjs` no scratchpad e junte com um script Node que recusa ids
  duplicados e reordena por `power` desc. Não edite o JSON com PowerShell.

## 2. Imagens

- `npm run fetch:images` baixa quem não tem `image` (ou `-- <id> ...` para forçar). Roda em segundo plano:
  o AniList limita a ~30 req/min.
  - **Anime → AniList.** Não achou: `"search": "Nome como no AniList"` (romanização japonesa: "Tanjirou",
    "Toudou"). Achou o errado: `"anilistId": 123`.
  - **Pokémon → PokeAPI** (arte oficial pelo `pokeapiId`). As entradas vêm de `npm run pokemon:import`
    (espécie nova da PokeAPI entra sozinha; ajuste de poder direto no JSON ou na tabela `LORE` do script, que só
    vale para entradas novas).
  - **Games → Wikipédia** com `"wikipedia": "Título exato do artigo"` (teste o título antes). Sem isso, tenta o
    IGDB, que quase não tem retratos.
  - Sem fonte automática (personagem sem artigo): peça ao usuário para baixar a imagem no navegador e rode
    `npm run import:image -- <id> <arquivo>`. **A Fandom bloqueia scripts: não contornar com headers falsos.**
- Linhas com `⚠` (nome/obra diferente) e `✗` (não encontrado) precisam de revisão; nomes genéricos ("King") erram.

## 3. Conferir e validar

```bash
npm run contact-sheet -- <ids> | --recent N | --series "Obra" | --category games   # gera e2e/screenshots/contact-sheet.png
npm run validate
npm run build
```

Cada imagem aberta custa tokens: pergunte ao usuário antes de abrir o mosaico e gere-o **só dos personagens novos ou trocados** (`<ids>` ou `--recent N`),
nunca de uma série ou categoria inteira sem o usuário pedir, e abra uma vez só (lotes grandes: um mosaico por lote,
não por personagem). Abra o mosaico e confira personagem certo e recorte (imagens largas são recortadas em 3:4 e às vezes pegam a área
errada; recorte à mão e use `import:image`). Personagem sem imagem fica fora do sorteio automaticamente.

## 4. Sincronizar com o banco

O jogo não lê o JSON: o servidor usa a tabela `characters` do D1 (o site recebe só nome/obra/imagem, nunca o
`power`). Depois de mexer no JSON:
- `npm run characters:sync` → banco local (o dev já passa a usar; o servidor guarda o catálogo em memória por até
  5 min — reinicie o dev para ver na hora).
- Avise o usuário para rodar `npm.cmd run characters:sync -- --remote` (produção) **junto com o push** das imagens
  novas (a imagem precisa estar publicada quando o personagem entrar no sorteio).
- Personagem removido do JSON fica `active = 0` (sai do sorteio e da loja, mas partidas e avatares antigos continuam).

## 5. Depois

Mudou `power` de personagens que já existiam? As pontuações gravadas ficaram com a regra antiga: avise o usuário
para rodar `npm.cmd run rescore -- --remote` depois do push (localmente: `npm run rescore -- --local`).
