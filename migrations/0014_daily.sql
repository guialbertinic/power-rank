-- Desafio Diário: os mesmos 10 personagens (na mesma ordem) para todo mundo no dia (meia-noite de Brasília).
-- O desafio é sorteado na primeira vez que alguém pede o do dia e fica fixo (mudanças no catálogo não o alteram).
CREATE TABLE daily_challenges (
  day TEXT PRIMARY KEY,                     -- data de Brasília, AAAA-MM-DD
  mode TEXT NOT NULL,                       -- categoria de onde saíram os personagens
  character_ids TEXT NOT NULL,              -- JSON, na ordem em que aparecem
  created_at INTEGER NOT NULL
);

-- Uma tentativa por jogador por dia, gasta ao começar (abandonar não libera outra).
-- player_key: 'p:<players.id>' (conta) ou 'g:<nick normalizado>' (convidado).
CREATE TABLE daily_attempts (
  day TEXT NOT NULL,
  player_key TEXT NOT NULL,
  game_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, player_key)
);

-- Partida e pontuação do desafio guardam o dia dele (NULL = partida normal). A pontuação continua na categoria
-- (`mode`), então entra também no "Hoje" e no "Acumulado" dela (que já contam só o melhor de cada dia).
ALTER TABLE games ADD COLUMN daily TEXT;
ALTER TABLE scores ADD COLUMN daily TEXT;
CREATE INDEX idx_scores_daily ON scores (daily, score DESC) WHERE daily IS NOT NULL;
