-- Tela de admin: toda ação que muda algo fica registrada (quem, o quê, em quem, quando).
CREATE TABLE admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin TEXT NOT NULL,                      -- e-mail do Cloudflare Access ('local' no dev)
  action TEXT NOT NULL,                     -- feature | coins | rename | password
  player_id INTEGER REFERENCES players (id),
  details TEXT NOT NULL,                    -- JSON com o antes/depois
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_admin_actions_created ON admin_actions (created_at);
CREATE INDEX idx_admin_actions_player ON admin_actions (player_id);

-- Painel de economia: somas dos últimos 7 dias.
CREATE INDEX idx_scores_created ON scores (created_at);
CREATE INDEX idx_casino_spins_created ON casino_spins (created_at);
CREATE INDEX idx_gacha_openings_created ON gacha_openings (created_at);
