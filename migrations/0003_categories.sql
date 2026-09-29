-- Categorias (anime, games, all = free for all) com rankings separados.
-- Tudo o que já existe foi jogado com personagens de anime.
ALTER TABLE games ADD COLUMN mode TEXT NOT NULL DEFAULT 'anime';
ALTER TABLE scores ADD COLUMN mode TEXT NOT NULL DEFAULT 'anime';

DROP INDEX idx_scores_player;
CREATE INDEX idx_scores_player ON scores (mode, name_key, score DESC, created_at ASC);
