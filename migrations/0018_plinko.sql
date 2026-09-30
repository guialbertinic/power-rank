-- Plinko (aba do Arcade): histórico de bolinhas (auditoria e balanceamento). Regras em src/game/plinko.ts.
CREATE TABLE plinko_drops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players (id),
  bet INTEGER NOT NULL,
  risk TEXT NOT NULL,                       -- 'low' | 'medium' | 'high'
  slot INTEGER NOT NULL,                    -- casa final, 0 … 12
  multiplier INTEGER NOT NULL,              -- em décimos (16 = 1,6×)
  prize INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_plinko_drops_player ON plinko_drops (player_id, created_at);

-- Chave do minigame: começa ligada (desligar pelo /admin ou UPDATE features).
INSERT INTO features (id, enabled, updated_at) VALUES ('plinko', 1, unixepoch() * 1000);
