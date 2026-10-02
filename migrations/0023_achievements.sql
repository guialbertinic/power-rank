-- Emblema equipado (ícone SVG ao lado do nick): id do cosmético `badge-*`.
ALTER TABLE players ADD COLUMN badge TEXT;

-- Contadores das conquistas, atualizados a cada partida e vitória de party. Sem retroativo: começam do zero.
-- `modes_700` = categorias com 700+ pontos, no formato ',anime,games,'.
CREATE TABLE player_stats (
  player_id INTEGER PRIMARY KEY REFERENCES players (id),
  games INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  party_wins INTEGER NOT NULL DEFAULT 0,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  daily_last TEXT,
  modes_700 TEXT NOT NULL DEFAULT ','
);

-- Conquistas desbloqueadas. `seen` = 0 até o jogador ver o aviso (a da party aparece ao voltar para a home).
CREATE TABLE player_achievements (
  player_id INTEGER NOT NULL REFERENCES players (id),
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, achievement_id)
);
