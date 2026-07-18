import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FeedbackValidationError,
  insertIdempotently,
  requireQuestionId,
  requireStars,
  requireSubmissionId,
  requireTrackingId
} from '../feedback-api.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(requireStars(1), 1);
assert.equal(requireStars(5), 5);
assert.throws(() => requireStars(0), FeedbackValidationError);
assert.throws(() => requireStars(null), FeedbackValidationError);
assert.equal(requireQuestionId('340'), 340);
assert.throws(() => requireQuestionId(null), FeedbackValidationError);
assert.equal(
  requireSubmissionId({ submission_id: 'feedback:12345678' }),
  'feedback:12345678'
);
assert.throws(() => requireSubmissionId({}), FeedbackValidationError);
assert.equal(
  requireTrackingId({ session_id: 'session:12345678' }, 'session_id'),
  'session:12345678'
);

class FakeD1 {
  constructor() {
    this.rows = new Map();
    this.nextId = 1;
  }

  prepare(sql) {
    const db = this;
    return {
      bind(...values) {
        return {
          async run() {
            const key = values.at(-1);
            if (db.rows.has(key)) return { meta: { changes: 0 } };
            db.rows.set(key, { id: db.nextId++ });
            return { meta: { changes: 1 } };
          },
          async first() {
            return db.rows.get(values[0]) || null;
          }
        };
      }
    };
  }
}

const db = new FakeD1();
const insert = {
  table: 'quiz_feedback',
  sql: 'INSERT OR IGNORE INTO quiz_feedback (stars, idempotency_key) VALUES (?, ?)',
  values: [4],
  idempotencyKey: 'feedback:duplicate-test'
};
const first = await insertIdempotently(db, insert);
const duplicate = await insertIdempotently(db, insert);
assert.equal(first.id, duplicate.id);
assert.equal(first.duplicate, false);
assert.equal(duplicate.duplicate, true);
assert.equal(db.rows.size, 1);

const quizSource = fs.readFileSync(path.join(root, 'js/quiz-engine.js'), 'utf8');
assert(!quizSource.includes('selectedStars || 3'), 'la note 3 ne doit pas être envoyée par défaut');
assert(
  quizSource.includes('Quelle note donneriez-vous à l’application ?') &&
    quizSource.includes('1 = Très mauvaise · 5 = Très bonne'),
  'l’échelle de notation doit être expliquée clairement'
);
for (const reason of ['Réponse incorrecte', 'Formulation', 'Contenu obsolète', 'Hors programme']) {
  assert(quizSource.includes(`value="${reason}"`), `motif manquant : ${reason}`);
}
assert(quizSource.includes('question_id: q.id'));
assert(quizSource.includes('submission_id: reportSubmissionId'));
assert(quizSource.includes('reportBtn.hidden = true'));
assert(quizSource.includes('if (reportBtn) reportBtn.hidden = false'));
assert(quizSource.includes('answer-report-btn'));
assert(quizSource.includes('id="fb-submit" disabled'));
assert(quizSource.includes('id="qr-submit" disabled'));

const componentSource = fs.readFileSync(path.join(root, 'js/components.js'), 'utf8');
assert(componentSource.includes("submitBtn.dataset.submitting = 'true'"));
assert(componentSource.includes('submission_id: submissionId'));
assert(componentSource.includes('session_id: sessionId'));

const migration = fs.readFileSync(
  path.join(root, 'migrations/0001_feedback_idempotency.sql'),
  'utf8'
);
assert(migration.includes('DELETE FROM quiz_feedback'));
assert(migration.includes('CREATE UNIQUE INDEX idx_quiz_feedback_idempotency'));
assert(migration.includes('CREATE UNIQUE INDEX idx_question_reports_idempotency'));

console.log('Feedback validé : note explicite, traçabilité et idempotence.');
