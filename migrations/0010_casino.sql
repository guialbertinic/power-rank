-- Cassino (caça-níquel): pote acumulado compartilhado e histórico de giros. Regras em src/game/casino.ts.
CREATE TABLE casino_pot (
  id INTEGER PRIMARY KEY CHECK (id = 1),   -- uma linha só: o pote de todo o jogo
  amount_cents INTEGER NOT NULL,            -- acumulado em centésimos de moeda (5% de uma aposta de 1 = 5)
  last_winner_id INTEGER REFERENCES players (id),
  last_prize INTEGER,                       -- em moedas
  last_won_at INTEGER
);
INSERT INTO casino_pot (id, amount_cents) VALUES (1, 50000);   -- começa com 500 moedas

-- Todo giro fica registrado (auditoria e balanceamento: retorno real, apostas médias).
CREATE TABLE casino_spins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players (id),
  bet INTEGER NOT NULL,
  reels TEXT NOT NULL,                      -- JSON com os 3 símbolos
  prize INTEGER NOT NULL,
  jackpot INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_casino_spins_player ON casino_spins (player_id, created_at);
