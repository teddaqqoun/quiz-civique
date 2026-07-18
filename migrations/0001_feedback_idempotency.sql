-- Remove only byte-for-byte duplicate feedback rows already stored.
-- The oldest row in each exact group is retained.
CREATE TABLE IF NOT EXISTS quiz_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  stars INTEGER NOT NULL,
  difficulty TEXT,
  would_recommend INTEGER,
  comment TEXT,
  level TEXT,
  mode TEXT,
  sandbox INTEGER DEFAULT 0,
  shared_via TEXT
);

CREATE TABLE IF NOT EXISTS bug_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  page_url TEXT,
  description TEXT NOT NULL,
  sandbox INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS question_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  question_text TEXT,
  level TEXT,
  theme TEXT,
  reason TEXT,
  sandbox INTEGER DEFAULT 0
);

DELETE FROM quiz_feedback
WHERE id NOT IN (
  SELECT MIN(id)
  FROM quiz_feedback
  GROUP BY
    created_at,
    stars,
    difficulty,
    would_recommend,
    comment,
    level,
    mode,
    sandbox,
    shared_via
);

ALTER TABLE quiz_feedback ADD COLUMN question_id INTEGER;
ALTER TABLE quiz_feedback ADD COLUMN quiz_id TEXT;
ALTER TABLE quiz_feedback ADD COLUMN session_id TEXT;
ALTER TABLE quiz_feedback ADD COLUMN idempotency_key TEXT;

ALTER TABLE bug_reports ADD COLUMN session_id TEXT;
ALTER TABLE bug_reports ADD COLUMN idempotency_key TEXT;

ALTER TABLE question_reports ADD COLUMN question_id INTEGER;
ALTER TABLE question_reports ADD COLUMN quiz_id TEXT;
ALTER TABLE question_reports ADD COLUMN session_id TEXT;
ALTER TABLE question_reports ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX idx_quiz_feedback_idempotency
  ON quiz_feedback(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX idx_bug_reports_idempotency
  ON bug_reports(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX idx_question_reports_idempotency
  ON question_reports(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
