-- Raspadinha (aba do Arcade): histórico de cartelas (auditoria e balanceamento). Regras em src/game/scratch.ts.
CREATE TABLE scratch_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players (id),
  bet INTEGER NOT NULL,
  symbol TEXT,                              -- trio da cartela ('ss' … 'd'); NULL = sem prêmio
  multiplier INTEGER NOT NULL,              -- 0 sem trio
  prize INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_scratch_cards_player ON scratch_cards (player_id, created_at);

-- Chave do minigame: começa ligada (desligar pelo /admin ou UPDATE features).
INSERT INTO features (id, enabled, updated_at) VALUES ('scratch', 1, unixepoch() * 1000);
