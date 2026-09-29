-- O nick passa a ser escolhido antes da partida e fica gravado nela.
ALTER TABLE games ADD COLUMN name TEXT;

-- Chave do jogador (nick normalizado) para o ranking mostrar só o melhor resultado de cada um.
-- `scores` continua guardando todas as partidas.
ALTER TABLE scores ADD COLUMN name_key TEXT NOT NULL DEFAULT '';
UPDATE scores SET name_key = lower(name);

CREATE INDEX idx_scores_player ON scores (name_key, score DESC, created_at ASC);
