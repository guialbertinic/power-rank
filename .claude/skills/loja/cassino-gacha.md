# Arcade: caça-níquel e Mystery Box

Parte da skill `loja`. As regras de moedas (débito/crédito seguros) estão no SKILL.md.

## Mystery Box (gacha)

Regras em `src/game/gacha.ts` (+ `gacha.test.ts`): caixa de 100, raridade pelo preço do item (comum < 150 ou
avatar, raro 150–349, épico 350+, lendário = `exclusive: true`). Item exclusivo novo: entrada em `COSMETICS` com
`price: 0, exclusive: true` + classe CSS; ele entra sozinho no pool lendário, some da loja para quem não tem e o
`buyItem` recusa. Repetido devolve metade do preço (lendário: 300). Histórico em `gacha_openings`.

## Cassino

Regras e calibração em `src/game/casino.ts` + `casino.test.ts` (retorno exato; mexeu em peso ou multiplicador,
rode `npm test` e mantenha a tabela fixa perto de 90%). Detalhes em `docs/ARQUITETURA.md` → "Cassino".
Ícones: pixel art do Game Corner de Pokémon (original: 6 ícones empilhados, 48px de largura), recortados pelas
faixas transparentes e ampliados 4× com `kernel: 'nearest'` (WebP lossless) em `public/slots/<id>.webp`; o CSS
usa `image-rendering: pixelated`. Mudou o número de símbolos? Recalibre pesos e multiplicadores (o teste de retorno
enumera todas as combinações). O pote é compartilhado: em teste, não assuma que só o
teste está jogando.
