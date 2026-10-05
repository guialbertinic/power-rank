-- Auto Battle: banco de reservas da run (personagens guardados, que não lutam).
ALTER TABLE autobattle_runs ADD COLUMN bench TEXT NOT NULL DEFAULT '[]';  -- JSON: [{ id, copies }]
