CREATE TABLE IF NOT EXISTS quiz_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  stars INTEGER NOT NULL,
  difficulty TEXT,
  would_recommend INTEGER,
  comment TEXT,
  level TEXT,
  mode TEXT,
  question_id INTEGER,
  quiz_id TEXT,
  session_id TEXT,
  idempotency_key TEXT,
  sandbox INTEGER DEFAULT 0,
  shared_via TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_feedback_idempotency
  ON quiz_feedback(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS bug_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  page_url TEXT,
  description TEXT NOT NULL,
  session_id TEXT,
  idempotency_key TEXT,
  sandbox INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bug_reports_idempotency
  ON bug_reports(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS question_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  question_text TEXT,
  question_id INTEGER,
  quiz_id TEXT,
  session_id TEXT,
  level TEXT,
  theme TEXT,
  reason TEXT,
  idempotency_key TEXT,
  sandbox INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_reports_idempotency
  ON question_reports(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
