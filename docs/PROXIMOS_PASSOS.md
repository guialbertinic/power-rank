# Próximos passos

Lista viva: marque o que foi feito e acrescente o que surgir. A ordem dentro de cada seção é a prioridade sugerida.

## Pendências de publicação

- [ ] Importar as imagens dos 10 games sem imagem (Asura, Marika, Elden Beast, Radiance, Gwyn, Tarnished,
      Artorias, Chosen Undead, Leon, Aloy) com `npm run import:image -- <id> <arquivo>`.
- [ ] Produção: `npm run db:migrate:remote` (0003 categorias, 0004 donos de nick) **antes** do push.
- [ ] Produção: `npm run rescore -- --remote` (pontuação por pares), se ainda não rodou.
- [ ] Push da `main` e conferir o deploy no painel do Worker.
- [ ] Multiplayer (Party): primeiro deploy com Durable Objects. Conferir no painel se o Worker subiu com a classe
      `PartyRoom` e testar uma sala entre dois navegadores/dispositivos.

## Party (multiplayer)

- [ ] Testar em produção com amigos, em redes diferentes (4G + Wi-Fi), e observar a latência real.
- [ ] Mostrar "Novo recorde!" na party quando o resultado bater o melhor do jogador na categoria.
- [ ] Permitir ao dono trocar a categoria no lobby (hoje é a categoria escolhida ao criar a sala).
- [ ] Expulsar jogador (dono) e transferir a posse da sala manualmente.
- [ ] Contagem regressiva opcional ("todos têm 60s depois que o primeiro terminar").
- [ ] Rate limit na criação de salas.

## Conteúdo

- [ ] Revisar os valores de `power` em `/?review` (principalmente games e os anime mais discutíveis).
- [ ] Mais personagens de games (meta: ~200) — prioridade para franquias famosas com artigo na Wikipédia.
- [ ] Nova categoria **Séries/Filmes** (power scaling): decidir se herói de quadrinhos entra pela versão de cinema;
      imagens via Wikipédia (o TMDB só tem foto de ator).
- [ ] Revisar imagens aceitáveis mas não ideais: Xehanort (colagem), The Knight (capa do jogo).

## Jogo

- [ ] Categorias por métrica objetiva (bilheteria, nota IMDb/Metacritic) usando TMDB/RAWG — mesmo motor,
      outro "power".
- [ ] Níveis de dificuldade (adiado): fácil = personagens famosos e poderes espaçados; difícil = janela estreita de poder.
- [ ] Compartilhar resultado (imagem ou texto com o ranking e a pontuação) — bom para crescer.
- [ ] Modo "consenso da comunidade": gabarito = média das posições escolhidas pelos jogadores (precisa de volume).

## Técnico

- [ ] Nick: permitir gerar um novo código de recuperação (hoje ele só aparece uma vez, ao escolher o nick).
- [ ] Nick: expirar tokens antigos e/ou listar aparelhos conectados.
- [ ] Esconder os valores de `power` também do JavaScript do site: hoje `characters.json` vai inteiro no bundle, e
      quem abrir o código consegue ler. Seria o servidor devolver a ordem correta ao fim da partida.
- [ ] Rate limit por IP em `POST /api/games` e `/api/scores`.
- [ ] Teste de ponta a ponta automatizado (hoje o fluxo é conferido com screenshots via Edge headless).
- [ ] Endpoint de saúde e alerta simples de erro (observability já está ligado no `wrangler.jsonc`).
