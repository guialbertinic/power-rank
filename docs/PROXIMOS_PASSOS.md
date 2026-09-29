# Próximos passos

Lista viva: marque o que foi feito e acrescente o que surgir. A ordem dentro de cada seção é a prioridade sugerida.

## Já feito (resumo)

- Jogo solo com pontuação por ordem entre pares; 438 personagens (368 anime + 70 games) com imagem.
- Categorias Animes / Games / Free for All, cada uma com ranking (melhor resultado por nick).
- Design system "Dark Battle Interface"; resultado sem valores de poder.
- Party (multiplayer) com Durable Objects: sala por código/convite, espera ao vivo, pódio, revanche, reconexão.
- Conta (nick + senha, reserva o nick, moedas, qualquer dispositivo) ou convidado (qualquer nick livre, sem
  ranking nem moedas); criar conta e forçar sincronização no menu do perfil; convite entra direto.
- Jogador identificado por id (migração 0007): trocar nick renomeia a conta; sair da conta.
- Moedas (a partir de 500 pontos, bônus de pódio), loja de cosméticos, `PlayerTag` e barra de perfil na home.
- Testes e2e no repositório (`npm run e2e:api`, `npm run e2e:ui`), skills do projeto (`.claude/skills/`) e
  documentação dividida entre `CLAUDE.md` (regras) e `docs/ARQUITETURA.md` (referência).
- Produção: migrações 0001–0008 aplicadas; deploy automático pela `main`.

## Party (multiplayer)

- [ ] Testar em produção com amigos, em redes diferentes (4G + Wi-Fi), e observar a latência real.
- [ ] Mostrar "Novo recorde!" na party quando o resultado bater o melhor do jogador na categoria.
- [ ] Permitir ao dono trocar a categoria no lobby (hoje é a categoria escolhida ao criar a sala).
- [ ] Expulsar jogador (dono) e transferir a posse da sala manualmente.
- [ ] Contagem regressiva opcional ("todos têm 60s depois que o primeiro terminar").
- [ ] Rate limit na criação de salas.

## Economia e cosméticos

- [ ] **Gambling** (slot/roleta/pachinko) contra a máquina: sorteio só no servidor, débito e crédito numa operação
      atômica, animação só "encena" o resultado. Moedas nunca compráveis com dinheiro real (senão vira regulação).
- [ ] Fase 2: ícones/emblemas em SVG ao lado do nick, efeitos animados mais elaborados, itens raros.
- [ ] Fase 3: conquistas ("10/10", "venceu 5 parties") que desbloqueiam itens exclusivos.
- [ ] Balancear preços e ganhos depois de ver os dados reais (`SELECT SUM(coins) FROM scores`, itens mais comprados).

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

- [ ] Esconder os valores de `power` também do JavaScript do site: hoje `characters.json` vai inteiro no bundle, e
      quem abrir o código consegue ler. Seria o servidor devolver a ordem correta ao fim da partida.
- [ ] Nick: trocar senha (pedindo a atual) e recuperar senha esquecida (hoje só pelos aparelhos já conectados).
- [ ] Nick: expirar tokens antigos e/ou listar aparelhos conectados (e "sair de todos" ao trocar a senha).
- [ ] Rate limit por IP em `POST /api/games` e `/api/scores`.
- [ ] Rodar `npm test` + `e2e:api` num CI (GitHub Actions) antes do deploy.
- [ ] Endpoint de saúde e alerta simples de erro (observability já está ligado no `wrangler.jsonc`).
