-- Senha opcional do nick: é com ela que o dono entra em outro dispositivo (substitui o código de sincronização).
-- Formato: pbkdf2-sha256$<iterações>$<sal base64>$<hash base64>. NULL = nick de convidado (só os tokens valem).
ALTER TABLE players ADD COLUMN password_hash TEXT;
-- Proteção contra tentativa e erro: após várias senhas erradas seguidas, o nick fica bloqueado por um tempo.
ALTER TABLE players ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN locked_until INTEGER NOT NULL DEFAULT 0;

ALTER TABLE players DROP COLUMN recovery_hash;
