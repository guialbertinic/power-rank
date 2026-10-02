# Arcade: caça-níquel, Plinko, Raspadinha e Mystery Box

Parte da skill `loja`. As regras de moedas (débito/crédito seguros) estão no SKILL.md.

## Mystery Box (gacha)

Regras em `src/game/gacha.ts` (+ `gacha.test.ts`): caixa de 100, raridade pelo preço do item (comum < 150 ou
avatar, raro 150–349, épico 350+, lendário = `exclusive: true`). Item exclusivo novo: entrada em `COSMETICS` com
`price: 0, exclusive: true` + classe CSS; ele entra sozinho no pool lendário, some da loja para quem não tem e o
`buyItem` recusa. Repetido devolve metade do preço (lendário: 300). Histórico em `gacha_openings`.

## Cassino

Regras e calibração em `src/game/casino.ts` + `casino.test.ts` (retorno exato; mexeu em peso ou multiplicador,
rode `npm test` e mantenha a tabela fixa perto de 90%). Detalhes em `docs/ARQUITETURA.md` → "Cassino".
Símbolos: os tiers SS … D, desenhados em CSS pelo `CasinoIcon` (cores dos tokens de tier, sem imagem; nada de
arte de franquia aqui, por direitos autorais). Mudou o número de símbolos? Recalibre pesos e multiplicadores (o teste de retorno
enumera todas as combinações). O pote é compartilhado: em teste, não assuma que só o
teste está jogando.

## Plinko

Tabela em `src/game/plinko.ts` (`HALF_TENTHS`, décimos, da ponta ao meio) + `plinko.test.ts` (retorno exato de
cada risco, 93–96%). Mexeu na tabela? Rode `npm test` e atualize a cópia em `e2e/api.mjs` (seção Plinko).
Detalhes em `docs/ARQUITETURA.md` → "Plinko".

## Raspadinha

Tabela em `src/game/scratch.ts` (`PRIZES`: multiplicador e peso em 1/10.000 por trio) + `scratch.test.ts` (retorno
exato, hoje 95%). Mexeu na tabela? Rode `npm test` e atualize a cópia em `e2e/api.mjs` (seção Raspadinha).
Detalhes em `docs/ARQUITETURA.md` → "Raspadinha".
