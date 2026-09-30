-- Desafio Diário por categoria: um desafio (e uma tentativa por jogador) para cada modo, no mesmo dia.
-- A primeira partida solo do dia em cada categoria é o desafio dela. As linhas antigas eram todas de Free for All.
CREATE TABLE daily_challenges_new (
  day TEXT NOT NULL,                        -- data de Brasília, AAAA-MM-DD
  mode TEXT NOT NULL,                       -- categoria do desafio
  character_ids TEXT NOT NULL,              -- JSON, na ordem em que aparecem
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, mode)
);
INSERT INTO daily_challenges_new (day, mode, character_ids, created_at)
  SELECT day, mode, character_ids, created_at FROM daily_challenges;
DROP TABLE daily_challenges;
ALTER TABLE daily_challenges_new RENAME TO daily_challenges;

-- DEFAULT 'all': a versão anterior do Worker (que não informa o modo) segue funcionando até o deploy.
CREATE TABLE daily_attempts_new (
  day TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'all',
  player_key TEXT NOT NULL,                 -- 'p:<players.id>' (conta) ou 'g:<nick normalizado>' (convidado)
  game_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, mode, player_key)
);
INSERT INTO daily_attempts_new (day, mode, player_key, game_id, created_at)
  SELECT day, 'all', player_key, game_id, created_at FROM daily_attempts;
DROP TABLE daily_attempts;
ALTER TABLE daily_attempts_new RENAME TO daily_attempts;

-- Ranking do desafio passa a ser por categoria.
DROP INDEX idx_scores_daily;
CREATE INDEX idx_scores_daily ON scores (daily, mode, score DESC) WHERE daily IS NOT NULL;
