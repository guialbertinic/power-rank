-- Partidas sorteadas pelo servidor. Uma partida só pode enviar pontuação uma vez.
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  character_ids TEXT NOT NULL,          -- JSON array com os 10 ids sorteados
  created_at INTEGER NOT NULL,          -- epoch ms
  submitted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_games_created ON games (created_at);

CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL UNIQUE REFERENCES games (id),
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  placements TEXT NOT NULL,             -- JSON array de ids na ordem escolhida (posição 1 primeiro)
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_scores_rank ON scores (score DESC, created_at ASC);
