-- Personagens no banco: o servidor sorteia e pontua a partir daqui, e o site recebe só o catálogo público (sem
-- `power`). A fonte de edição continua sendo data/characters.json; `npm run characters:sync` copia para cá.
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,                   -- anime | games
  series TEXT NOT NULL,
  version TEXT,
  power REAL NOT NULL,                      -- 0–100, nunca sai para o site
  image TEXT,                               -- caminho em /public (sem imagem = fora do sorteio)
  anilist_id INTEGER,
  image_version TEXT,
  active INTEGER NOT NULL DEFAULT 1,        -- 0 = removido do JSON (fica para partidas e avatares antigos)
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_characters_active ON characters (active, category);
