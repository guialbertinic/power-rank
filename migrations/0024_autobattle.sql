-- Auto Battle (seção "Mais jogos"): roguelike de montar time. Regras em src/game/autobattle.ts.
-- Uma run ativa por conta; o estado inteiro (time, loja, moedas da run) fica no servidor.
CREATE TABLE autobattle_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players (id),
  status TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'done'
  round INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL,                    -- moedas da run (não são as da conta)
  team TEXT NOT NULL,                       -- JSON: [{ id, copies }]
  shop TEXT NOT NULL,                       -- JSON: ids das ofertas (null = comprada)
  version INTEGER NOT NULL DEFAULT 0,       -- sobe a cada mudança: dois cliques não aplicam a mesma ação duas vezes
  coins_earned INTEGER NOT NULL DEFAULT 0,  -- moedas da conta pagas no fim
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_autobattle_runs_active ON autobattle_runs (player_id) WHERE status = 'active';
CREATE INDEX idx_autobattle_runs_player ON autobattle_runs (player_id, created_at);

-- Fantasmas: o time de cada conta em cada rodada (o mais recente), enfrentado pelos outros jogadores.
CREATE TABLE autobattle_ghosts (
  player_id INTEGER NOT NULL REFERENCES players (id),
  round INTEGER NOT NULL,
  wins INTEGER NOT NULL,                    -- campanha de quem salvou, antes da luta (para parear parecido)
  team TEXT NOT NULL,                       -- JSON: [{ id, copies }]
  created_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, round)
);
CREATE INDEX idx_autobattle_ghosts_round ON autobattle_ghosts (round, wins);

-- Chave do jogo: começa desligada (ligar pelo /admin ou UPDATE features).
INSERT INTO features (id, enabled, updated_at) VALUES ('autobattle', 0, unixepoch() * 1000);
