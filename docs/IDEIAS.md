# Ideias

Documento vivo que guia os próximos estágios do projeto: tudo que queremos que o jogo tenha com o tempo, para
abranger um público maior e ter mais estilos de jogo. Acrescente ideias à vontade; quando uma for escolhida para
desenvolver, detalhe as perguntas em aberto antes de começar.

**Status:** 💡 ideia · 🧭 decidido/planejado · 🚧 em andamento · ✅ feito

## Visão

Um hub de jogos rápidos de "ranquear às cegas" sobre cultura pop (animes, games, filmes, séries), pensado para
**criadores de conteúdo** (TikTok, Reels, Shorts) gravarem trends e para o público jogar junto. Cada partida curta,
fácil de entender em 5 segundos, com resultado compartilhável e ranking para competir. Economia de moedas e
cosméticos como camada de progresso (moedas nunca compráveis nem com valor real).

## Estrutura: modos de jogo → categorias

A home vira um seletor de **modos**; cada modo tem suas **categorias**, seu ranking e rende moedas.

| Modo | Categorias | Status |
|---|---|---|
| **Blind Power Ranking** (o jogo de hoje) | Animes, Games, Free for All; + Filmes, Séries | ✅ (3 categorias) / 💡 (novas) |
| **Desafio Diário** | uma partida igual para todos, por dia | 💡 |
| **Blind Rating Ranking** | Filmes, Séries, Games, Animes (por nota) | 💡 |
| **Size Comparison** | Games, Séries, Animes | 💡 |
| **Build Your Pokémon Team** | Pokémon | 💡 |

Pontos de arquitetura que valem para todos (decidir uma vez):
- Ranking, moedas e histórico por **modo + categoria** (hoje o `mode` do `scores` já é a categoria; generalizar).
- Cada modo tem sua pontuação calculada **no servidor**; o cliente só envia escolhas.
- Dados escondidos do jogador (ex: `power`, nota, tamanho) não podem ir inteiros no bundle (ver "Técnico").

---

## Modos de jogo

### 💡 Desafio Diário
Como o solo do Blind Power Ranking, mas com **os mesmos 10 personagens para todo mundo**, sorteados à meia-noite
(horário de Brasília) e fixos o dia inteiro. Cada jogador tem **uma tentativa** por dia.

- **Rankings:** o ranking "Hoje" atual perde o sentido e é substituído pelo **ranking do Desafio Diário**
  (desempate por tempo, como hoje). Continua existindo o **Acumulado**.
- Bom para trends: "todo mundo joga o mesmo desafio hoje" e compara nos comentários.
- **Perguntas em aberto:**
  - Uma tentativa por dia ou várias (vale a primeira / a melhor)?
  - De qual categoria é o desafio? Um por categoria (Animes, Games, FFA) ou um só (Free for All)?
  - O Acumulado passa a somar só os desafios diários, ou continua somando o melhor do dia no modo livre?
  - Convidado pode jogar o desafio (sem entrar no ranking)?
  - Mostrar "desafio de ontem" com o gabarito e a distribuição de pontuações?

### 💡 Blind Power Ranking — novas categorias
- **Filmes** e **Séries** (power scaling de personagens). Decidir se heróis de quadrinhos entram pela versão de
  cinema; imagens via Wikipédia (o TMDB só tem foto de ator).
- Níveis de dificuldade (adiado): fácil = personagens famosos e poderes espaçados; difícil = janela estreita.
- Modo "consenso da comunidade": gabarito = média das posições escolhidas pelos jogadores (precisa de volume).

### 💡 Blind Rating Ranking
Mesmo motor do Blind Power Ranking, mas o "valor escondido" é uma **nota** objetiva: nota do IMDb, Metacritic,
MyAnimeList, bilheteria... O jogador posiciona 10 obras sem ver as notas.
- Categorias: Filmes, Séries, Games, Animes.
- Fontes de dados: TMDB (filmes/séries), RAWG ou IGDB (games), AniList/MAL (animes). Checar termos de uso das APIs.
- **Perguntas em aberto:** qual nota por categoria (e de quando: atualizar periodicamente?); imagens (pôsteres têm
  direitos autorais — ver "Monetização e legal").

### 💡 Size Comparison
Jogo de sequência: aparecem dois personagens/criaturas e o jogador diz **qual é maior** (ou maior/menor que o
anterior). Acertou, continua; errou, acaba. Pontuação = quantos acertos seguidos.
- Categorias: Games, Séries, Animes (e Free for All misturando).
- Precisa de uma base com **altura/tamanho** de cada personagem (novo campo, curadoria como o `power`).
- **Perguntas em aberto:** comparar pares (A vs B) ou "maior ou menor que o anterior"? Tamanhos iguais contam como
  acerto? Mostrar o tamanho depois de cada resposta (aqui revelar faz parte da graça)?

### 💡 Build Your Pokémon Team
O jogo sorteia Pokémon; o jogador escolhe (ou recebe) um time de 6 e o sistema simula a jornada: **até qual
ginásio chega**, se passa pela Liga/Elite 4 e se vence o jogo.
- Dados: PokéAPI (tipos, status base). Simulação no servidor, com resultado determinístico para o time.
- **Perguntas em aberto:**
  - Como escolher: sorteio de 6 fixos, ou "draft" (escolhe 1 de 3 por rodada)?
  - Qual jornada (uma região específica, ou genérica com 8 ginásios de tipos variados)?
  - Regra da simulação: vantagem de tipo + status base? Aleatoriedade na batalha?
  - **Direitos autorais:** Pokémon é a marca mais protegida do mundo; um modo inteiro dela aumenta muito o risco
    (ver "Monetização e legal"). Avaliar antes de investir.

### 💡 Outros estilos para considerar depois
- "Quem é o personagem?" (silhueta/imagem borrada).
- Tier list compartilhável (o jogador monta e gera imagem para postar).
- Versus: vota em quem ganha uma luta; ranking pela votação da comunidade.

---

## Cassino

Tudo com moedas do jogo (não compráveis, sem valor real). Sorteio sempre no servidor.

- ✅ **Caça-níquel** com pote acumulado compartilhado (jackpot proporcional à aposta), ~95% de retorno.
- ✅ **Mystery Box** (gacha): caixa de 100, 4 raridades, 10 itens exclusivos, avatar no comum.
- 💡 **Plinko**: bolinha cai por pinos até casas com multiplicadores; matemática simples (binomial), visual
  satisfatório, partida de 2 s.
- 💡 **Pachinko**: bolinhas lançadas com força regulável, pinos e bolsos que liberam um mini-sorteio/jackpot;
  mais "evento" que o Plinko (definir o que diferencia os dois na prática).
- 💡 Raspadinha (ótima no celular).
- 💡 "Desafio": apostar na própria partida (atingir X pontos) — só depois de ter dados reais para calibrar.
- 🧭 Olhar o retorno real depois de uns dias: `SELECT SUM(prize) * 1.0 / SUM(bet) FROM casino_spins` e
  `SELECT rarity, COUNT(*) FROM gacha_openings GROUP BY rarity`.
- 🧭 **Idade:** avaliar trava 18+ (ou chave para desligar) no cassino por causa do ECA Digital e loot boxes
  (ver "Monetização e legal").

## Economia e cosméticos

- ✅ Loja: 16 cores, 13 molduras, 27 títulos (embaixo do nick), avatares; filtro obtidos/não obtidos.
- 💡 Fase 2: ícones/emblemas em SVG ao lado do nick, itens raros.
- 💡 Fase 3: **conquistas** ("10/10", "venceu 5 parties", "7 dias de desafio diário") que desbloqueiam itens.
- 🧭 Balancear preços e ganhos com dados reais (`SELECT SUM(coins) FROM scores`, itens mais comprados).

## Party (multiplayer)

- 💡 Testar em produção com amigos, em redes diferentes (4G + Wi-Fi), e observar a latência real.
- 💡 Party nos novos modos (Desafio Diário em grupo, Size Comparison "quem vai mais longe").
- 💡 "Novo recorde!" na party quando bater o melhor do jogador; dono troca a categoria no lobby; expulsar
  jogador / transferir dono; contagem regressiva opcional; rate limit na criação de salas.

## Criadores de conteúdo e crescimento

- 💡 **Compartilhar resultado**: imagem pronta para story/TikTok (ranking do jogador + pontuação + nick) e texto
  para copiar. É o principal motor de crescimento.
- 💡 "Modo gravação": layout vertical limpo (sem barra de perfil, sem cassino), ideal para gravar a tela.
- 💡 Link de desafio: "tente bater meu resultado" com a mesma partida (seed) do amigo.

## Conteúdo

- 🧭 Revisar os valores de `power` em `/?review` (principalmente games e os anime mais discutíveis).
- 💡 Mais personagens de games (meta: ~200), prioridade para franquias famosas com artigo na Wikipédia.
- 💡 Revisar imagens aceitáveis mas não ideais: Xehanort (colagem), The Knight (capa do jogo).

## Monetização e legal

(Resumo da conversa; não é aconselhamento jurídico — validar com advogado antes de monetizar.)
- 🧭 **Trocar os sprites do Game Corner (Pokémon) do cassino por arte própria** antes de monetizar.
- 💡 Patreon/Apoia.se com benefício só cosmético (selo/título "Apoiador"), **nunca moedas** nem vantagem no cassino.
- 💡 Anúncios fora do cassino (home, resultado, ranking); `ads.txt`; consentimento de cookies se personalizado.
- 💡 Páginas de **termos de uso** (moedas sem valor, não compráveis) e **política de privacidade** (LGPD);
  "excluir minha conta"; canal para pedido de remoção de imagem.
- 💡 Idade mínima (13+ nos termos) e trava 18+ no cassino/Mystery Box (ECA Digital, loot boxes).

## Técnico

- 💡 Esconder os valores escondidos (`power`, e depois nota/tamanho) do JavaScript do site: hoje
  `characters.json` vai inteiro no bundle. O servidor devolveria a ordem correta só ao fim da partida.
  Vira obrigatório no Desafio Diário (senão dá para colar).
- 💡 Conta: trocar senha (pedindo a atual), recuperar senha esquecida, expirar tokens antigos / "sair de todos".
- 💡 Rate limit por IP em `POST /api/games` e `/api/scores`.
- 💡 CI (GitHub Actions) com `npm test` + `e2e:api` antes do deploy.
- 💡 Testes da party no `e2e:api` esperam com `sleep` fixo: trocar por "esperar até o estado X".
- 💡 Endpoint de saúde e alerta simples de erro (observability já está ligado no `wrangler.jsonc`).

---

## Já feito (resumo)

- Blind Power Ranking solo: pontuação por ordem entre pares; 438 personagens (368 anime + 70 games) com imagem;
  categorias Animes / Games / Free for All; resultado sem valores de poder.
- Party (Durable Objects): sala por código/convite, espera ao vivo, pódio, revanche, reconexão.
- Conta (nick + senha) ou convidado; jogador por id (trocar nick renomeia a conta); sincronizar dispositivo.
- Rankings Hoje (desempate por tempo) e Acumulado (soma do melhor de cada dia), pódio dos 3 primeiros, skeleton.
- Moedas, loja de cosméticos (cores, molduras, títulos, avatares), cassino (caça-níquel + Mystery Box).
- Design system "Dark Battle Interface"; testes e2e (`e2e:api`, `e2e:ui`); skills do projeto (`.claude/skills/`).
- Produção: migrações 0001–0011; deploy automático pela `main`.
