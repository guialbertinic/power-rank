-- Banimento: a conta suspensa não entra nem usa os tokens que sobraram. 0 = liberada; BAN_FOREVER = permanente.
ALTER TABLE players ADD COLUMN banned_until INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN ban_reason TEXT;

-- Edição de personagens pelo admin: campos editados (JSON, ex: ["power","image"]) que o `characters:sync` não
-- sobrescreve mais. NULL = tudo segue o data/characters.json.
ALTER TABLE characters ADD COLUMN admin_fields TEXT;

-- Imagens enviadas pelo admin (WebP 240px, poucos KB), servidas por /api/img/:id. A coluna `image` do personagem
-- passa a apontar para 'api/img/<id>'.
CREATE TABLE character_images (
  character_id TEXT PRIMARY KEY,
  data BLOB NOT NULL,
  content_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Fila de moderação: denúncias de nick e pedidos de remoção de imagem, feitos pelos jogadores.
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                       -- nick | image
  target TEXT NOT NULL,                     -- nick: name_key do nick denunciado; image: id do personagem
  target_name TEXT NOT NULL,                -- nick como apareceu na tela, ou nome do personagem
  target_player_id INTEGER,                 -- nick de conta (NULL = convidado)
  reason TEXT NOT NULL,                     -- offensive | impersonation | wrong | rights | other
  reporter TEXT NOT NULL,                   -- 'p:<id>' da conta ou 'ip:<hash>' do convidado (uma denúncia aberta por alvo)
  status TEXT NOT NULL DEFAULT 'open',      -- open | resolved | dismissed
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  closed_by TEXT
);
CREATE INDEX idx_reports_open ON reports (status, kind, target);
CREATE UNIQUE INDEX idx_reports_once ON reports (kind, target, reporter) WHERE status = 'open';
