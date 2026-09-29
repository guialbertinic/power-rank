-- Jogador passa a ser identificado por um id numérico; o nick vira um atributo que pode mudar (trocar nick).
-- name_key continua só para garantir nick único sem diferenciar maiúsculas/acentos ("Albertini" = "albertini").
-- Tabelas que apontavam para o nick (tokens, itens) são recriadas apontando para o id.
PRAGMA defer_foreign_keys = true;

CREATE TABLE players_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                   -- nick como o dono escreveu
  name_key TEXT NOT NULL UNIQUE,        -- nick normalizado (unicidade)
  password_hash TEXT,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  avatar TEXT,
  name_color TEXT,
  frame TEXT,
  created_at INTEGER NOT NULL
);
INSERT INTO players_new (name, name_key, password_hash, failed_logins, locked_until, coins, avatar, name_color, frame, created_at)
  SELECT name, name_key, password_hash, failed_logins, locked_until, coins, avatar, name_color, frame, created_at
  FROM players ORDER BY created_at;

CREATE TABLE player_tokens_new (
  token_hash TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players_new (id),
  created_at INTEGER NOT NULL
);
INSERT INTO player_tokens_new (token_hash, player_id, created_at)
  SELECT t.token_hash, p.id, t.created_at FROM player_tokens t JOIN players_new p ON p.name_key = t.name_key;

CREATE TABLE player_items_new (
  player_id INTEGER NOT NULL REFERENCES players_new (id),
  item_id TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, item_id)
);
INSERT INTO player_items_new (player_id, item_id, acquired_at)
  SELECT p.id, i.item_id, i.acquired_at FROM player_items i JOIN players_new p ON p.name_key = i.name_key;

DROP TABLE player_tokens;
DROP TABLE player_items;
DROP TABLE players;
ALTER TABLE players_new RENAME TO players;
ALTER TABLE player_tokens_new RENAME TO player_tokens;
ALTER TABLE player_items_new RENAME TO player_items;
CREATE INDEX idx_player_tokens_player ON player_tokens (player_id);

-- Partidas e pontuações: player_id = conta; NULL = convidado (agrupado pelo nick, name_key).
-- name continua guardando o nick usado na partida (o ranking mostra o nick atual da conta).
ALTER TABLE games ADD COLUMN player_id INTEGER REFERENCES players (id);
UPDATE games SET player_id = (SELECT id FROM players p WHERE p.name_key = lower(games.name)) WHERE submitted = 0;

ALTER TABLE scores ADD COLUMN player_id INTEGER REFERENCES players (id);
UPDATE scores SET player_id = (SELECT id FROM players p WHERE p.name_key = scores.name_key);
CREATE INDEX idx_scores_account ON scores (mode, player_id, score DESC, created_at ASC);
