-- Auto Battle: resultado de cada rodada já lutada, para pintar a trilha das rodadas (vitória, derrota, empate).
ALTER TABLE autobattle_runs ADD COLUMN history TEXT NOT NULL DEFAULT '[]';  -- JSON: ['win', 'loss', 'draw', ...]
