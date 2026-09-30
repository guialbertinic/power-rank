-- Chaves (feature flags) dos minigames do Arcade: ligar/desligar sem deploy.
--   npm run db -- "UPDATE features SET enabled = 0, updated_at = unixepoch() * 1000 WHERE id = 'slots'"
-- Sem linha = desligado. O servidor recusa (403 feature_disabled) e o site esconde a aba.
CREATE TABLE features (
  id TEXT PRIMARY KEY,                      -- 'slots' | 'mystery_box' (src/game/features.ts)
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
INSERT INTO features (id, enabled, updated_at) VALUES
  ('slots', 1, unixepoch() * 1000),
  ('mystery_box', 1, unixepoch() * 1000);
