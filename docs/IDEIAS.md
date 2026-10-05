# Ideias

Documento vivo que guia os próximos estágios do projeto: tudo que queremos que o jogo tenha com o tempo, para
abranger um público maior e ter mais estilos de jogo. Acrescente ideias à vontade; quando uma for escolhida para
desenvolver, detalhe as perguntas em aberto antes de começar.

**Status:** 💡 ideia · 🧭 decidido/planejado · 🚧 em andamento · ✅ feito
**Tipo:** `Feature` (coisa nova para o jogador) · `Manutenção` (melhora o que existe, conteúdo, dados) ·
`Arquitetura` (estrutura interna, segurança, infraestrutura)
**Dificuldade:** 🟢 quick win (horas) · 🟡 médio (1–3 dias) · 🔴 grande (semana ou mais)

## Prioridades agora

Objetivo: **abrir o site para pessoas testarem**. Na ordem:

| # | Item | Tipo | Dif. | Status |
|---|---|---|---|---|
| 1 | Personagens no banco + tirar o `power` do código do site | Arquitetura | 🟡 | ✅ |
| 2 | Segurança para teste aberto (rate limit, cabeçalhos, anti-bot, nicks, placar honesto) | Arquitetura | 🟡 | ✅ |
| 3 | Tradução para inglês + menu de configurações com idioma | Feature | 🟡 | ✅ |
| 4 | Termos de uso + privacidade (LGPD), trava 18+ no cassino/Mystery Box, registro de IP para abuso | Feature | 🟢 | ✅ |

Quick wins logo depois: trocar os sprites do cassino por arte própria · ~~termos de uso e privacidade~~ ✅ · botão
"Apoie" (✅ pronto, falta o link em `src/links.ts`) · ~~trava 18+ no cassino~~ ✅ · ~~compartilhar resultado~~ ✅.

## Visão

Um hub de jogos rápidos de "ranquear às cegas" sobre cultura pop (animes, games, filmes, séries), pensado para
**criadores de conteúdo** (TikTok, Reels, Shorts) gravarem trends e para o público jogar junto. Cada partida curta,
fácil de entender em 5 segundos, com resultado compartilhável e ranking para competir. Economia de moedas e
cosméticos como camada de progresso (moedas nunca compráveis nem com valor real).

## Estrutura: modos de jogo → categorias

A home vira um seletor de **modos**; cada modo tem suas **categorias**, seu ranking e rende moedas.

| Modo | Categorias | Status |
|---|---|---|
| **Blind Power Ranking** (o jogo de hoje) | Animes, Games, Filmes e Séries, Pokémon (filtro de gerações), Free for All (categorias à escolha) | ✅ (5 categorias) |
| **Desafio Diário** | uma partida igual para todos, por dia e categoria | ✅ |
| **Blind Rating Ranking** | Filmes, Séries, Games, Animes (por nota) | 💡 |
| **Size Comparison** | Games, Séries, Animes | 💡 |
| **Build Your Pokémon Team** | Pokémon | 💡 |

Pontos de arquitetura que valem para todos (decidir uma vez) — `Arquitetura` 🟡:
- Ranking, moedas e histórico por **modo + categoria** (hoje o `mode` do `scores` já é a categoria; generalizar).
- Cada modo tem sua pontuação calculada **no servidor**; o cliente só envia escolhas.
- Dados escondidos do jogador (ex: `power`, nota, tamanho) não podem ir no bundle (ver "Dados").

---

## Modos de jogo

### ✅ Desafio Diário · `Feature` 🟡
**Os mesmos 10 personagens (na mesma ordem) para todo mundo**, fixos no dia (meia-noite de Brasília).
- Um desafio por categoria, com botão próprio embaixo de Solo/Party; trava depois da tentativa (mostra a pontuação).
- **Uma tentativa** por jogador e categoria, gasta ao começar. Convidado joga (por nick), mas não entra no ranking.
- É o **ranking principal**: abas Desafio (o de hoje, desempate por tempo) e Acumulado (soma dos desafios). Solo e
  party rendem moedas, mas não entram no ranking.
- 💡 Depois: "desafio de ontem" com o gabarito e a distribuição de pontuações; sequência de dias seguidos
  (conquista); link de desafio na party. Convidado pode repetir trocando de nick (aceitável por ora).

### ✅ Auto Battle (seção "Mais jogos") · `Feature` 🔴
Roguelike de montar time com luta automática contra times de outros jogadores (detalhes em `ARQUITETURA.md`).
- Primeira versão: 8 obras de anime × 7 personagens, papéis, estrelas por cópia, sinergia de obra, fantasmas.
- 💡 Depois: **itens** na loja (escudo, reviver, etc.); **papéis novos**; set de **games/filmes** com o mesmo motor;
  **Pokémon** com sinergia por tipo (precisa importar os tipos da PokeAPI); ranking de runs (mais vitórias, menos
  rodadas); conquistas do modo; limite diário de prêmio se virar farm; tela de admin com o balanceamento
  (taxa de vitória por personagem/obra a partir de `autobattle_runs`).
- 💡 "Mais jogos" foi criada para receber outros jogos fora do ranking (ex: Size Comparison).

### 💡 Blind Power Ranking — novas categorias
- ✅ **Filmes e Séries** (uma categoria, 103 personagens; heróis pela versão da tela; imagens da Wikipédia).
- ✅ **Free for All** com escolha das categorias (Pokémon desligado por padrão; sorteio equilibrado por categoria).
- ✅ Níveis de dificuldade · `Feature` 🟡: fácil / médio / difícil pela fama (`tier`) do personagem, no solo e na
  party (Pokémon usa o filtro de gerações). Ideia futura: poderes espaçados no fácil.
- Modo "consenso da comunidade" · `Feature` 🔴: gabarito = média das posições escolhidas pelos jogadores (precisa
  de volume).

### 💡 Blind Rating Ranking · `Feature` 🔴
Mesmo motor do Blind Power Ranking, mas o "valor escondido" é uma **nota** objetiva: nota do IMDb, Metacritic,
MyAnimeList, bilheteria... O jogador posiciona 10 obras sem ver as notas.
- Categorias: Filmes, Séries, Games, Animes.
- Fontes de dados: TMDB (filmes/séries), RAWG ou IGDB (games), AniList/MAL (animes). Checar termos de uso das APIs.
- **Perguntas em aberto:** qual nota por categoria (e de quando: atualizar periodicamente?); imagens (pôsteres têm
  direitos autorais — ver "Monetização e legal").

### 💡 Size Comparison · `Feature` 🔴
Jogo de sequência: aparecem dois personagens/criaturas e o jogador diz **qual é maior** (ou maior/menor que o
anterior). Acertou, continua; errou, acaba. Pontuação = quantos acertos seguidos.
- Categorias: Games, Séries, Animes (e Free for All misturando).
- Precisa de uma base com **altura/tamanho** de cada personagem (novo campo, curadoria como o `power`) — é a parte
  grande; o jogo em si é 🟡.
- **Perguntas em aberto:** comparar pares (A vs B) ou "maior ou menor que o anterior"? Tamanhos iguais contam como
  acerto? Mostrar o tamanho depois de cada resposta (aqui revelar faz parte da graça)?

### 💡 Build Your Pokémon Team · `Feature` 🔴
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
- "Quem é o personagem?" (silhueta/imagem borrada) · `Feature` 🟡
- Tier list compartilhável (o jogador monta e gera imagem para postar) · `Feature` 🟡
- Versus: vota em quem ganha uma luta; ranking pela votação da comunidade · `Feature` 🟡

---

## Idioma e configurações

### ✅ Tradução para inglês · `Feature` 🟡
- Toda a interface em **português e inglês** (textos das telas, mensagens de erro, "?" das regras, loja, cassino).
- **Menu de configurações** (engrenagem na barra de perfil e na tela do nick) com o seletor de idioma; lembra a
  escolha no navegador. Primeira visita: idioma do navegador (`pt*` → português, o resto → inglês).
- Nomes de personagens e obras ficam como estão (já são nomes próprios); nomes de cosméticos e títulos da loja são
  traduzidos.
- Mensagens do servidor: o servidor continua em português e o site traduz por uma tabela (`src/i18n/server.ts`).
- Depois: título e descrição da página (SEO) por idioma; o próprio menu de configurações pode ganhar som, "reduzir
  animações" e "modo gravação".

---

## Arcade (ex-cassino)

Na tela é "Arcade" (nome mais seguro para redes de anúncio); cada minigame tem chave no banco.

Tudo com moedas do jogo (não compráveis, sem valor real). Sorteio sempre no servidor.

- ✅ **Caça-níquel** com pote acumulado compartilhado (jackpot proporcional à aposta), ~95% de retorno.
- ✅ **Mystery Box** (gacha): caixa de 100, 4 raridades, 10 itens exclusivos, avatar no comum.
- ✅ **Plinko**: 12 fileiras, 3 riscos (baixo/médio/alto), ~95% de retorno em todos; várias bolinhas ao mesmo tempo.
- 💡 **Pachinko** · `Feature` 🟡: bolinhas lançadas com força regulável, pinos e bolsos que liberam um
  mini-sorteio/jackpot; mais "evento" que o Plinko (definir o que diferencia os dois na prática).
- ✅ **Raspadinha**: cartela 3×3 com os tiers, três iguais pagam (SS 100×), ganha em 23%, 95% de retorno; raspa no canvas.
- 💡 "Desafio" · `Feature` 🟡: apostar na própria partida (atingir X pontos) — só depois de ter dados reais para
  calibrar.
- 🧭 Olhar o retorno real depois de uns dias · `Manutenção` 🟢:
  `SELECT SUM(prize) * 1.0 / SUM(bet) FROM casino_spins` e `SELECT rarity, COUNT(*) FROM gacha_openings GROUP BY rarity`.
- ✅ **Idade:** trava 18+ no cassino e na Mystery Box (declaração da conta, checada no servidor). ✅ Chave por minigame
  (tabela `features`). 💡 Depois: verificação de idade mais forte se o ECA Digital exigir.
  (ver "Monetização e legal").

## Economia e cosméticos

- ✅ Loja: 25 cores, 21 molduras, 45 títulos (embaixo do nick), avatares por categoria/obra que expandem; filtro obtidos/não obtidos.
- ✅ Fase 2: **emblemas** em SVG ao lado do nick (11 na loja + 7 de conquista).
- ✅ Fase 3: **conquistas** (11: primeira partida, 100 partidas, 700/850/1000 pontos, 3/7/30 dias de desafio, 1 e 5
  vitórias de party, 700+ em todas as categorias), cada uma dá um título ou emblema exclusivo; sem moedas, sem
  retroativo. 💡 Depois: mais conquistas (ex: por categoria, Arcade), emblema exclusivo na Mystery Box, selo de
  Apoiador.
- 🧭 Balancear preços e ganhos com dados reais (`SELECT SUM(coins) FROM scores`, itens mais comprados) ·
  `Manutenção` 🟢

## Party (multiplayer)

- 💡 Testar em produção com amigos, em redes diferentes (4G + Wi-Fi), e observar a latência real · `Manutenção` 🟢
- 💡 Party nos novos modos (Desafio Diário em grupo, Size Comparison "quem vai mais longe") · `Feature` 🟡
- ✅ "Novo recorde!" na party quando bater o melhor do jogador; dono troca a categoria no lobby (e no pódio); expulsar
  jogador / transferir dono. (A contagem 3, 2, 1 antes da rodada foi testada e removida.)

## Criadores de conteúdo e crescimento

- ✅ **Compartilhar resultado** (solo): imagem pronta para story/TikTok (ranking do jogador + pontuação + nick) e
  texto estilo Wordle sem spoiler (pontuação + quadrados de acerto + link). É o principal motor de crescimento.
  💡 Depois: na party (pódio), e link de desafio junto.
- ✅ "Modo gravação" (nas configurações): sem barra de perfil, Arcade e rodapé. 💡 Depois: layout vertical fixo no
  desktop (hoje vale o layout de celular quando a janela é estreita).
- 💡 Link de desafio · `Feature` 🟡: "tente bater meu resultado" com a mesma partida (seed) do amigo.

## Conteúdo

- 🧭 Revisar os valores de `power` em `/?review` (principalmente games e os anime mais discutíveis) · `Manutenção` 🟡
- 🧭 Revisar o poder de lore dos 1025 Pokémon (proposta: legendários à mão, o resto pelos status base) · `Manutenção` 🟡
- ✅ Personagens de games: 206 (+43 com artigo e imagem na Wikipédia: FF, KOF, Street Fighter, MK, Overwatch...).
- ✅ Imagens novas do Xehanort e do The Knight.

## Monetização e legal

(Resumo da conversa; não é aconselhamento jurídico — validar com advogado antes de monetizar.)
- ✅ **Arte própria no caça-níquel:** os símbolos do Game Corner (Pokémon) viraram os badges dos tiers (SS … D),
  em CSS; a moldura e o título "Game Corner" viraram "Arcade" (ids mantidos).
- 🚧 **Linkar Patreon** (ou Apoia.se / Ko-fi) · `Feature` 🟢 (botão) / 🟡 (selo automático): botão pronto, aparece quando
  `SUPPORT_URL` (`src/links.ts`) for preenchido.
  - Botão "Apoie" no rodapé e no menu do perfil; página de agradecimento com os apoiadores (opt-in).
  - Benefício só cosmético: selo/título/moldura "Apoiador" exclusivo — **nunca moedas**, caixas nem vantagem no
    cassino (mantém as moedas "sem valor", o que protege o cassino).
  - Como marcar quem é apoiador: começar manual pela tela de admin; depois, integração com a API/webhook do
    Patreon ligando o e-mail do apoiador à conta.
  - Página do Patreon apresenta o projeto como apoio ao desenvolvimento (tudo continua grátis), sem logos oficiais.
- 💡 **Anúncios** (AdSense ou similar) · `Feature` 🟡:
  - Só fora do cassino: home (abaixo do ranking), tela de resultado, entre partidas. Nunca durante a partida.
  - Requisitos: política de privacidade, `ads.txt`, consentimento de cookies (CMP certificado para visitantes da
    Europa; LGPD no Brasil) se os anúncios forem personalizados.
  - Conferir a política da rede sobre conteúdo de "social casino" antes de aplicar.
  - Opção futura: apoiador não vê anúncios.
- ✅ Páginas de **termos de uso** (moedas sem valor, não compráveis) e **política de privacidade** (LGPD), com
  registro de acesso (IP, 90 dias) para investigar abuso; remoção de imagem e exclusão de dados pelo e-mail de
  contato. ✅ Botão "excluir minha conta" (menu do perfil). 💡 Falta: e-mail definitivo (placeholder em `src/i18n/legal.ts`).
- ✅ Idade mínima (13+ nos termos) e trava 18+ no cassino/Mystery Box (ECA Digital, loot boxes)

## Dados: personagens no banco

### ✅ Personagens no banco + tirar o `power` do site · `Arquitetura` 🟡
Hoje os personagens (nome, obra, `power`, imagem) vivem em `data/characters.json`, que vai para o Worker **e** para
o site — qualquer um que abra o código do site vê o `power` de todos. Migrar para o D1:
- Tabela `characters` (+ categoria, obra, versão, `power`, imagem, origem da imagem, ativo/inativo); o JSON vira só
  a carga inicial (seed) e os scripts (`validate`, `rescore`, `contact-sheet`) passam a ler do banco.
- O site **deixa de receber o `power`**: a API manda só nome/obra/imagem dos 10 sorteados e o servidor revela a
  ordem correta no fim da partida. Obrigatório para o Desafio Diário.
- Editar personagens sem deploy (pela tela de admin), com histórico das mudanças de `power` e `rescore` sob demanda
  · `Feature` 🟡 (vem com o admin).
- Mesmo modelo para os dados dos modos novos (nota do Blind Rating, tamanho do Size Comparison, Pokémon).
- Imagens continuam em `public/chars/` (ou vão para o R2 se precisar subir imagem pelo admin).

## Tela de admin · `Feature` 🔴 (no total; cada parte 🟡)

✅ Em `/admin` (Cloudflare Access + JWT conferido no Worker, registro de toda ação): chaves, economia, jogadores,
personagens e moderação.

Área restrita para operar o jogo sem mexer em código nem em SQL:
- ✅ **Personagens:** buscar, editar `power`/nome/obra/versão/fama, ativar/desativar e trocar a imagem (guardada no
  D1, sem deploy), com histórico. O `characters:sync` respeita o que o admin editou; `characters:pull` traz para o
  JSON. 💡 Falta: adicionar personagem novo pelo admin.
- ✅ **Jogadores:** buscar conta, ver histórico, ajustar moedas, renomear, senha temporária, suspender (1/7/30 dias
  ou permanente: desconecta, recusa o login e tira do ranking). 💡 Falta: marcar apoiador (Patreon).
- ✅ **Economia:** moedas em circulação, fluxo (partidas, admin, caça-níquel, Mystery Box), retorno real, raridades
  reais × configuradas, itens com mais donos. 💡 Falta: ajustar o pote; histórico de compras da loja (hoje sem preço).
- ✅ **Chaves (feature flags)** na tabela `features`: caça-níquel e Mystery Box, pela aba Chaves. 💡 Falta: chaves
  para anúncios e modos novos.
- ✅ **Moderação:** "Denunciar nick" (ranking e party) e "Reportar imagem" (resultado) entram numa fila, juntos por
  alvo, com atalho para a conta ou o personagem. 💡 Depois: aviso no admin quando chega denúncia nova.
- ✅ Acesso: Cloudflare Access + JWT e lista de e-mails conferidos em toda rota `/api/admin/*`; toda ação em
  `admin_actions`.

## Segurança

### ✅ Pacote para teste aberto · `Arquitetura` 🟡
- **Esconder o `power`** do site — ver "Personagens no banco" · 🟡
- **Rate limit** por IP/conta: criar conta, login (já tem bloqueio por nick após 5 senhas erradas), partidas,
  envio de pontuação, giros do cassino, caixas, criação de salas da party · 🟢/🟡
- **Anti-bot**: Cloudflare Turnstile na criação de conta · 🟢
- **Cabeçalhos**: Content-Security-Policy, `frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options` em
  `public/_headers` (cuidado com os anúncios, que exigem liberar domínios na CSP) · 🟢
- **Nicks:** filtro de palavras ofensivas e de nicks que imitam outros (ex: "Albertini" vs "AIbertini") · 🟢
- **Placar honesto:** recusar tempos impossíveis (partida de 10 personagens em 2 s) · 🟢

### 💡 Depois
- ✅ **Conta:** tela "Minha conta" (nick, senha, aparelhos, excluir), trocar senha pedindo a atual, "sair de todos os
  aparelhos". 💡 Falta: recuperar senha esquecida (exige e-mail — decidir se vale pedir), expirar tokens antigos · 🟡
- **Revisão de segurança** periódica do código (autenticação, SQL, Durable Object) e dos segredos do Cloudflare ·
  `Manutenção` 🟢

## Técnico

- ✅ Testes da party no `e2e:api` esperam o estado (`client.until`) em vez de `sleep` fixo.
- ✅ `GET /api/health` (Worker + D1). 💡 Falta ligar um monitor externo (UptimeRobot) nele e, no painel da
  Cloudflare, uma notificação de erros do Worker.

---

## Já feito (resumo)

- Blind Power Ranking solo: pontuação por ordem entre pares; 438 personagens (368 anime + 70 games) com imagem;
  categorias Animes / Games / Free for All; resultado sem valores de poder.
- Categoria Pokémon: 1025 espécies (PokeAPI, gerações 1–9) com filtro de gerações no solo e na party; fora do Free for All.
- Dificuldade (fácil / médio / difícil) pelo `tier` de fama de cada personagem, no painel do Solo e da Party.
- Party (Durable Objects): sala por código/convite, espera ao vivo, pódio, revanche, reconexão; dono troca a categoria, expulsa e passa a dona; "Novo recorde!" no pódio.
- Tela "Minha conta" (nick, trocar senha, aparelhos e "sair de todos", excluir conta), modo gravação (configurações), botão "Apoie" (falta o link), `/api/health`.
- Conta (nick + senha) ou convidado; jogador por id (trocar nick renomeia a conta); sincronizar dispositivo.
- Rankings do Desafio Diário (o de hoje, desempate por tempo) e Acumulado (soma dos desafios), pódio dos 3 primeiros, skeleton.
- Desafio Diário: os mesmos 10 (Free for All) para todos no dia, uma tentativa, aba Diário na home (regra, status e tempo até o próximo), ranking próprio (aba Desafio).
- Admin: chaves, economia, jogadores (moedas, nick, senha temporária, suspensão), personagens (poder e imagem sem
  deploy) e moderação (denúncias de nick e de imagem).
- Moedas, loja de cosméticos (cores, molduras, títulos, avatares), Arcade (caça-níquel, Plinko, Raspadinha e Mystery Box).
- Design system "Dark Battle Interface"; testes e2e (`e2e:api`, `e2e:ui`); skills do projeto (`.claude/skills/`).
- Produção: migrações 0001–0014; deploy pela `main` via GitHub Actions, só se build + `npm test` + `e2e:api` passarem.
