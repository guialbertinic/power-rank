-- Moedas e cosméticos do perfil.
ALTER TABLE players ADD COLUMN coins INTEGER NOT NULL DEFAULT 0;
-- Visual equipado (ids do catálogo em src/game/cosmetics.ts; avatar = id do personagem).
ALTER TABLE players ADD COLUMN avatar TEXT;
ALTER TABLE players ADD COLUMN name_color TEXT;
ALTER TABLE players ADD COLUMN frame TEXT;

-- Itens comprados (avatares são "avatar:<id do personagem>").
CREATE TABLE player_items (
  name_key TEXT NOT NULL REFERENCES players (name_key),
  item_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  PRIMARY KEY (name_key, item_id)
);

-- Moedas que cada partida rendeu (histórico/auditoria).
ALTER TABLE scores ADD COLUMN coins INTEGER NOT NULL DEFAULT 0;
