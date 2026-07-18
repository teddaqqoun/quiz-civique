const SUBMISSION_ID_PATTERN = /^[a-zA-Z0-9:_-]{8,128}$/;

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function requireSubmissionId(body) {
  const value = typeof body?.submission_id === 'string' ? body.submission_id.trim() : '';
  if (!SUBMISSION_ID_PATTERN.test(value)) {
    throw new FeedbackValidationError('submission_id required');
  }
  return value;
}

export function requireTrackingId(body, field) {
  const value = typeof body?.[field] === 'string' ? body[field].trim() : '';
  if (!SUBMISSION_ID_PATTERN.test(value)) {
    throw new FeedbackValidationError(`${field} required`);
  }
  return value;
}

export function optionalQuestionId(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new FeedbackValidationError('invalid question_id');
  }
  return parsed;
}

export function requireQuestionId(value) {
  const parsed = optionalQuestionId(value);
  if (parsed === null) throw new FeedbackValidationError('question_id required');
  return parsed;
}

export function requireStars(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new FeedbackValidationError('stars must be between 1 and 5');
  }
  return parsed;
}

export class FeedbackValidationError extends Error {}

export async function insertIdempotently(db, { table, sql, values, idempotencyKey }) {
  const result = await db.prepare(sql).bind(...values, idempotencyKey).run();
  const existing = await db.prepare(
    `SELECT id FROM ${table} WHERE idempotency_key = ? LIMIT 1`
  ).bind(idempotencyKey).first();

  if (!existing?.id) throw new Error('idempotent insert failed');

  return {
    id: existing.id,
    duplicate: result.meta?.changes === 0
  };
}
