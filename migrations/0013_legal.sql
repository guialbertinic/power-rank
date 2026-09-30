-- Trava 18+ do cassino e da Mystery Box: quando a conta declarou ter 18 anos ou mais (NULL = ainda não declarou).
ALTER TABLE players ADD COLUMN adult_confirmed_at INTEGER;

-- Registro de acesso para investigar abuso e trapaça (política de privacidade: guardado por 90 dias e apagado
-- automaticamente). event: signup, login, login_failed, score, party. player_id NULL = convidado (vale o nick).
CREATE TABLE access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  player_id INTEGER,
  name TEXT,
  ip TEXT NOT NULL,
  country TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_access_log_created ON access_log (created_at);
CREATE INDEX idx_access_log_ip ON access_log (ip, created_at);
CREATE INDEX idx_access_log_player ON access_log (player_id, created_at);
