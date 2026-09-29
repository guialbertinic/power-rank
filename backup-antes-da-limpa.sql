PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_scores.sql','2026-09-29 13:52:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_player_best.sql','2026-09-29 13:52:16');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_categories.sql','2026-09-29 16:40:23');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0004_players.sql','2026-09-29 16:40:23');
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  character_ids TEXT NOT NULL,          
  created_at INTEGER NOT NULL,          
  submitted INTEGER NOT NULL DEFAULT 0
, name TEXT, mode TEXT NOT NULL DEFAULT 'anime');
INSERT INTO "games" ("id","character_ids","created_at","submitted","name","mode") VALUES('b5c15bd2-030c-4ab1-a88e-282eff82f924','["mob","netero","meruem","zoro","saitama","genos","makima","gojo","eren","ichigo"]',1790690213022,1,'albertini','anime');
INSERT INTO "games" ("id","character_ids","created_at","submitted","name","mode") VALUES('3a3d7da8-6497-487e-a312-9cdcd98856f5','["light","goku","meruem","killua","kenshiro","eren","gojo","boros","netero","sukuna"]',1790690240161,1,'albertini','anime');
INSERT INTO "games" ("id","character_ids","created_at","submitted","name","mode") VALUES('0488c728-c6ff-4ea8-92b7-2a6f5ffe1021','["zoro","luffy","levi","vegeta","sasuke","asta","eren","genos","frieren","sukuna"]',1790690296176,0,'albertini','anime');
INSERT INTO "games" ("id","character_ids","created_at","submitted","name","mode") VALUES('4b6097cb-1375-495a-8251-151b7e9441da','["genos","saitama","madara","sukuna","yuji","father","goku","eren","sasuke","makima"]',1790690609768,1,'mariw','anime');
CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL UNIQUE REFERENCES games (id),
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  placements TEXT NOT NULL,             
  created_at INTEGER NOT NULL
, name_key TEXT NOT NULL DEFAULT '', mode TEXT NOT NULL DEFAULT 'anime');
INSERT INTO "scores" ("id","game_id","name","score","placements","created_at","name_key","mode") VALUES(1,'b5c15bd2-030c-4ab1-a88e-282eff82f924','albertini',400,'["saitama","mob","genos","meruem","netero","makima","zoro","gojo","eren","ichigo"]',1790690226325,'albertini','anime');
INSERT INTO "scores" ("id","game_id","name","score","placements","created_at","name_key","mode") VALUES(2,'3a3d7da8-6497-487e-a312-9cdcd98856f5','albertini',667,'["goku","eren","gojo","meruem","killua","kenshiro","boros","netero","sukuna","light"]',1790690280780,'albertini','anime');
INSERT INTO "scores" ("id","game_id","name","score","placements","created_at","name_key","mode") VALUES(3,'4b6097cb-1375-495a-8251-151b7e9441da','mariw',622,'["madara","saitama","sukuna","genos","father","goku","yuji","sasuke","makima","eren"]',1790690784467,'mariw','anime');
CREATE TABLE players (
  name_key TEXT PRIMARY KEY,            
  name TEXT NOT NULL,                   
  recovery_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
INSERT INTO "players" ("name_key","name","recovery_hash","created_at") VALUES('albertini','albertini','bc68cb379ced4e5dd54188ce534f4577a83daa7e302ebe0155b9bf36640f5161',1790700993261);
CREATE TABLE player_tokens (
  token_hash TEXT PRIMARY KEY,
  name_key TEXT NOT NULL REFERENCES players (name_key),
  created_at INTEGER NOT NULL
);
INSERT INTO "player_tokens" ("token_hash","name_key","created_at") VALUES('d43ad9853241428a6c2a7bee18b3622328186ab275c386da84155810f1bcb0e2','albertini',1790700993413);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',4);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('scores',3);
CREATE INDEX idx_games_created ON games (created_at);
CREATE INDEX idx_scores_rank ON scores (score DESC, created_at ASC);
CREATE INDEX idx_scores_player ON scores (mode, name_key, score DESC, created_at ASC);
CREATE INDEX idx_player_tokens_key ON player_tokens (name_key);
