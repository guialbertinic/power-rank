-- Mystery Box (gacha): histórico de caixas abertas (auditoria e balanceamento). Regras em src/game/gacha.ts.
CREATE TABLE gacha_openings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players (id),
  rarity TEXT NOT NULL,                     -- common | rare | epic | legendary
  item_id TEXT NOT NULL,
  duplicate INTEGER NOT NULL DEFAULT 0,     -- 1 = já tinha o item (devolveu moedas)
  refund INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_gacha_openings_player ON gacha_openings (player_id, created_at);
