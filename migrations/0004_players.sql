-- Dono de cada nick: o primeiro navegador que usa um nick fica com ele.
-- Tokens e código de recuperação são guardados só como hash (SHA-256).
CREATE TABLE players (
  name_key TEXT PRIMARY KEY,            -- nick normalizado (sem diferenciar maiúsculas)
  name TEXT NOT NULL,                   -- como o dono escreveu
  recovery_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Um token por navegador/aparelho do dono (o código de recuperação gera um novo).
CREATE TABLE player_tokens (
  token_hash TEXT PRIMARY KEY,
  name_key TEXT NOT NULL REFERENCES players (name_key),
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_player_tokens_key ON player_tokens (name_key);
