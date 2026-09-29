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
| 3 | Tradução para inglês + menu de configurações com idioma | Feature | 🟡 | 🚧 |

Quick wins logo depois: trocar os sprites do cassino por arte própria · termos de uso e privacidade · botão
"Apoie" (Patreon) · trava 18+ no cassino · compartilhar resultado.

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

Pontos de arquitetura que valem para todos (decidir uma vez) — `Arquitetura` 🟡:
- Ranking, moedas e histórico por **modo + categoria** (hoje o `mode` do `scores` já é a categoria; generalizar).
- Cada modo tem sua pontuação calculada **no servidor**; o cliente só envia escolhas.
- Dados escondidos do jogador (ex: `power`, nota, tamanho) não podem ir no bundle (ver "Dados").

---

## Modos de jogo

### 💡 Desafio Diário · `Feature` 🟡
Como o solo do Blind Power Ranking, mas com **os mesmos 10 personagens para todo mundo**, sorteados à meia-noite
(horário de Brasília) e fixos o dia inteiro. Cada jogador tem **uma tentativa** por dia.

- **Rankings:** o ranking "Hoje" atual perde o sentido e é substituído pelo **ranking do Desafio Diário**
  (desempate por tempo, como hoje). Continua existindo o **Acumulado**.
- Bom para trends: "todo mundo joga o mesmo desafio hoje" e compara nos comentários.
- Depende de: personagens no banco (senão o gabarito fica visível no código do site).
- **Perguntas em aberto:**
  - Uma tentativa por dia ou várias (vale a primeira / a melhor)?
  - De qual categoria é o desafio? Um por categoria (Animes, Games, FFA) ou um só (Free for All)?
  - O Acumulado passa a somar só os desafios diários, ou continua somando o melhor do dia no modo livre?
  - Convidado pode jogar o desafio (sem entrar no ranking)?
  - Mostrar "desafio de ontem" com o gabarito e a distribuição de pontuações?

### 💡 Blind Power Ranking — novas categorias
- **Filmes** e **Séries** (power scaling de personagens) · `Manutenção` 🟡 — decidir se heróis de quadrinhos entram
  pela versão de cinema; imagens via Wikipédia (o TMDB só tem foto de ator).
- Níveis de dificuldade · `Feature` 🟡 (adiado): fácil = personagens famosos e poderes espaçados; difícil = janela
  estreita.
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

### 🚧 Tradução para inglês · `Feature` 🟡
- Toda a interface em **português e inglês** (textos das telas, mensagens de erro, "?" das regras, loja, cassino).
- **Menu de configurações** (engrenagem na barra de perfil e na tela do nick) com o seletor de idioma; lembra a
  escolha no navegador. Primeira visita: idioma do navegador (`pt*` → português, o resto → inglês).
- Nomes de personagens e obras ficam como estão (já são nomes próprios); nomes de cosméticos e títulos da loja são
  traduzidos.
- Mensagens do servidor viram códigos (ex: `nick_taken`) traduzidos na tela, para o servidor não depender do idioma.
- Depois: título e descrição da página (SEO) por idioma; o próprio menu de configurações pode ganhar som, "reduzir
  animações" e "modo gravação".

---

## Cassino

Tudo com moedas do jogo (não compráveis, sem valor real). Sorteio sempre no servidor.

- ✅ **Caça-níquel** com pote acumulado compartilhado (jackpot proporcional à aposta), ~95% de retorno.
- ✅ **Mystery Box** (gacha): caixa de 100, 4 raridades, 10 itens exclusivos, avatar no comum.
- 💡 **Plinko** · `Feature` 🟡: bolinha cai por pinos até casas com multiplicadores; matemática simples
  (binomial), visual satisfatório, partida de 2 s.
- 💡 **Pachinko** · `Feature` 🟡: bolinhas lançadas com força regulável, pinos e bolsos que liberam um
  mini-sorteio/jackpot; mais "evento" que o Plinko (definir o que diferencia os dois na prática).
- 💡 Raspadinha · `Feature` 🟢 (ótima no celular).
- 💡 "Desafio" · `Feature` 🟡: apostar na própria partida (atingir X pontos) — só depois de ter dados reais para
  calibrar.
- 🧭 Olhar o retorno real depois de uns dias · `Manutenção` 🟢:
  `SELECT SUM(prize) * 1.0 / SUM(bet) FROM casino_spins` e `SELECT rarity, COUNT(*) FROM gacha_openings GROUP BY rarity`.
- 🧭 **Idade:** trava 18+ (ou chave para desligar) no cassino por causa do ECA Digital e loot boxes · `Feature` 🟢
  (ver "Monetização e legal").

## Economia e cosméticos

- ✅ Loja: 16 cores, 13 molduras, 27 títulos (embaixo do nick), avatares; filtro obtidos/não obtidos.
- 💡 Fase 2: ícones/emblemas em SVG ao lado do nick, itens raros · `Feature` 🟡
- 💡 Fase 3: **conquistas** ("10/10", "venceu 5 parties", "7 dias de desafio diário") que desbloqueiam itens ·
  `Feature` 🟡
- 🧭 Balancear preços e ganhos com dados reais (`SELECT SUM(coins) FROM scores`, itens mais comprados) ·
  `Manutenção` 🟢

## Party (multiplayer)

- 💡 Testar em produção com amigos, em redes diferentes (4G + Wi-Fi), e observar a latência real · `Manutenção` 🟢
- 💡 Party nos novos modos (Desafio Diário em grupo, Size Comparison "quem vai mais longe") · `Feature` 🟡
- 💡 "Novo recorde!" na party quando bater o melhor do jogador; dono troca a categoria no lobby; expulsar
  jogador / transferir dono; contagem regressiva opcional · `Feature` 🟢 cada

## Criadores de conteúdo e crescimento

- 💡 **Compartilhar resultado** · `Feature` 🟡: imagem pronta para story/TikTok (ranking do jogador + pontuação +
  nick) e texto para copiar. É o principal motor de crescimento.
- 💡 "Modo gravação" · `Feature` 🟢: layout vertical limpo (sem barra de perfil, sem cassino), ideal para gravar a tela.
- 💡 Link de desafio · `Feature` 🟡: "tente bater meu resultado" com a mesma partida (seed) do amigo.

## Conteúdo

- 🧭 Revisar os valores de `power` em `/?review` (principalmente games e os anime mais discutíveis) · `Manutenção` 🟡
- 💡 Mais personagens de games (meta: ~200), prioridade para franquias famosas com artigo na Wikipédia ·
  `Manutenção` 🟡
- 💡 Revisar imagens aceitáveis mas não ideais: Xehanort (colagem), The Knight (capa do jogo) · `Manutenção` 🟢

## Monetização e legal

(Resumo da conversa; não é aconselhamento jurídico — validar com advogado antes de monetizar.)
- 🧭 **Trocar os sprites do Game Corner (Pokémon) do cassino por arte própria** antes de monetizar ·
  `Manutenção` 🟢 (depende de ter a arte)
- 💡 **Linkar Patreon** (ou Apoia.se / Ko-fi) · `Feature` 🟢 (botão) / 🟡 (selo automático):
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
- 💡 Páginas de **termos de uso** (moedas sem valor, não compráveis) e **política de privacidade** (LGPD);
  "excluir minha conta"; canal para pedido de remoção de imagem · `Feature` 🟢
- 💡 Idade mínima (13+ nos termos) e trava 18+ no cassino/Mystery Box (ECA Digital, loot boxes) · `Feature` 🟢

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

Área restrita (só contas marcadas como admin) para operar o jogo sem mexer em código nem em SQL:
- 💡 **Personagens:** buscar, editar `power`/nome/obra/imagem, ativar/desativar (ex: pedido de remoção de imagem),
  adicionar novos. Depende de "Personagens no banco".
- 💡 **Jogadores:** buscar conta, ver histórico, ajustar moedas, renomear/bloquear nick ofensivo, banir, marcar
  apoiador (Patreon), resetar senha a pedido.
- 💡 **Economia e cassino:** painel com moedas em circulação, retorno real do caça-níquel, raridades da Mystery Box,
  itens mais comprados; ajustar o pote.
- 💡 **Chaves (feature flags):** ligar/desligar cassino, Mystery Box, anúncios, modos novos sem deploy.
- 💡 **Moderação:** fila de pedidos de remoção de imagem e denúncias de nick.
- Acesso: papel `admin` na conta + checagem em toda rota `/api/admin/*` no servidor; registrar toda ação (quem, o
  quê, quando).

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
- **Conta:** trocar senha (pedindo a atual), recuperar senha esquecida (exige e-mail — decidir se vale pedir),
  expirar tokens antigos, listar aparelhos e "sair de todos" · 🟡
- **Revisão de segurança** periódica do código (autenticação, SQL, Durable Object) e dos segredos do Cloudflare ·
  `Manutenção` 🟢

## Técnico

- 💡 CI (GitHub Actions) com `npm test` + `e2e:api` antes do deploy · `Arquitetura` 🟢
- 💡 Testes da party no `e2e:api` esperam com `sleep` fixo: trocar por "esperar até o estado X" · `Manutenção` 🟢
- 💡 Endpoint de saúde e alerta simples de erro (observability já está ligado no `wrangler.jsonc`) ·
  `Arquitetura` 🟢

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
