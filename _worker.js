import DASHBOARD_HTML from './admin/dashboard.html';
import {
  FeedbackValidationError,
  insertIdempotently,
  jsonResponse,
  optionalQuestionId,
  requireQuestionId,
  requireStars,
  requireSubmissionId,
  requireTrackingId
} from './feedback-api.mjs';

const ADMIN_HOST = 'admin.test-civique-gratuit.com';
const QUESTION_REPORT_REASONS = [
  'Réponse incorrecte',
  'Formulation',
  'Contenu obsolète',
  'Hors programme'
];

function nullableText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requireQuestionReportReason(value) {
  if (!QUESTION_REPORT_REASONS.includes(value)) {
    throw new FeedbackValidationError('invalid reason');
  }
  return value;
}

function feedbackErrorResponse(error) {
  const status = error instanceof FeedbackValidationError ? 400 : 500;
  return jsonResponse({ ok: false, error: error.message }, status);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Admin dashboard (protected by Cloudflare Access on admin subdomain)
    if (url.hostname === ADMIN_HOST) {
      // Serve dashboard HTML
      if (url.pathname === '/' || url.pathname === '') {
        return new Response(DASHBOARD_HTML, { headers: { 'Content-Type': 'text/html' } });
      }

      // Admin API: read endpoints
      if (url.pathname === '/api/admin/feedback') {
        const { results } = await env.DB.prepare('SELECT * FROM quiz_feedback ORDER BY created_at DESC').all();
        return new Response(JSON.stringify({ data: results }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (url.pathname === '/api/admin/bug-reports') {
        const { results } = await env.DB.prepare('SELECT * FROM bug_reports ORDER BY created_at DESC').all();
        return new Response(JSON.stringify({ data: results }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (url.pathname === '/api/admin/question-reports') {
        const { results } = await env.DB.prepare('SELECT * FROM question_reports ORDER BY created_at DESC').all();
        return new Response(JSON.stringify({ data: results }), { headers: { 'Content-Type': 'application/json' } });
      }

      // Sandbox write endpoints (same as public but via admin)
      if (url.pathname.startsWith('/api/admin/sandbox/') && request.method === 'POST') {
        try {
          const body = await request.json();
          if (url.pathname === '/api/admin/sandbox/feedback') {
            const result = await insertIdempotently(env.DB, {
              table: 'quiz_feedback',
              sql: 'INSERT OR IGNORE INTO quiz_feedback (stars, difficulty, would_recommend, comment, level, mode, question_id, quiz_id, session_id, sandbox, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
              values: [
                requireStars(body.stars),
                nullableText(body.difficulty),
                body.would_recommend != null ? (body.would_recommend ? 1 : 0) : null,
                nullableText(body.comment),
                nullableText(body.level),
                nullableText(body.mode),
                optionalQuestionId(body.question_id),
                requireTrackingId(body, 'quiz_id'),
                requireTrackingId(body, 'session_id')
              ],
              idempotencyKey: requireSubmissionId(body)
            });
            return jsonResponse({ ok: true, ...result });
          }
          if (url.pathname === '/api/admin/sandbox/bug-report') {
            const description = nullableText(body.description);
            if (!description) throw new FeedbackValidationError('description required');
            const result = await insertIdempotently(env.DB, {
              table: 'bug_reports',
              sql: 'INSERT OR IGNORE INTO bug_reports (page_url, description, session_id, sandbox, idempotency_key) VALUES (?, ?, ?, 1, ?)',
              values: [
                nullableText(body.page_url),
                description,
                requireTrackingId(body, 'session_id')
              ],
              idempotencyKey: requireSubmissionId(body)
            });
            return jsonResponse({ ok: true, ...result });
          }
          if (url.pathname === '/api/admin/sandbox/question-report') {
            const result = await insertIdempotently(env.DB, {
              table: 'question_reports',
              sql: 'INSERT OR IGNORE INTO question_reports (question_text, question_id, quiz_id, session_id, level, theme, reason, sandbox, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
              values: [
                nullableText(body.question_text),
                requireQuestionId(body.question_id),
                requireTrackingId(body, 'quiz_id'),
                requireTrackingId(body, 'session_id'),
                nullableText(body.level),
                nullableText(body.theme),
                requireQuestionReportReason(body.reason)
              ],
              idempotencyKey: requireSubmissionId(body)
            });
            return jsonResponse({ ok: true, ...result });
          }
        } catch (err) {
          return feedbackErrorResponse(err);
        }
      }

      // Share tracking (admin)
      const adminShareMatch = url.pathname.match(/^\/api\/admin\/feedback\/(\d+)\/share$/);
      if (adminShareMatch && request.method === 'POST') {
        try {
          const body = await request.json();
          const allowed = ['whatsapp', 'facebook', 'x', 'reddit', 'telegram', 'copy'];
          if (!allowed.includes(body.platform)) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid platform' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          await env.DB.prepare('UPDATE quiz_feedback SET shared_via = ? WHERE id = ?').bind(body.platform, adminShareMatch[1]).run();
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      return new Response('Not found', { status: 404 });
    }

    // Public write API endpoints
    if (url.pathname.startsWith('/api/') && request.method === 'POST') {
      try {
        const body = await request.json();

        if (url.pathname === '/api/feedback') {
          const result = await insertIdempotently(env.DB, {
            table: 'quiz_feedback',
            sql: 'INSERT OR IGNORE INTO quiz_feedback (stars, difficulty, would_recommend, comment, level, mode, question_id, quiz_id, session_id, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            values: [
              requireStars(body.stars),
              nullableText(body.difficulty),
              body.would_recommend != null ? (body.would_recommend ? 1 : 0) : null,
              nullableText(body.comment),
              nullableText(body.level),
              nullableText(body.mode),
              optionalQuestionId(body.question_id),
              requireTrackingId(body, 'quiz_id'),
              requireTrackingId(body, 'session_id')
            ],
            idempotencyKey: requireSubmissionId(body)
          });
          return jsonResponse({ ok: true, ...result });
        }

        if (url.pathname === '/api/bug-report') {
          const description = nullableText(body.description);
          if (!description) throw new FeedbackValidationError('description required');
          const result = await insertIdempotently(env.DB, {
            table: 'bug_reports',
            sql: 'INSERT OR IGNORE INTO bug_reports (page_url, description, session_id, idempotency_key) VALUES (?, ?, ?, ?)',
            values: [
              nullableText(body.page_url),
              description,
              requireTrackingId(body, 'session_id')
            ],
            idempotencyKey: requireSubmissionId(body)
          });
          return jsonResponse({ ok: true, ...result });
        }

        if (url.pathname === '/api/question-report') {
          const result = await insertIdempotently(env.DB, {
            table: 'question_reports',
            sql: 'INSERT OR IGNORE INTO question_reports (question_text, question_id, quiz_id, session_id, level, theme, reason, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            values: [
              nullableText(body.question_text),
              requireQuestionId(body.question_id),
              requireTrackingId(body, 'quiz_id'),
              requireTrackingId(body, 'session_id'),
              nullableText(body.level),
              nullableText(body.theme),
              requireQuestionReportReason(body.reason)
            ],
            idempotencyKey: requireSubmissionId(body)
          });
          return jsonResponse({ ok: true, ...result });
        }

        const shareMatch = url.pathname.match(/^\/api\/feedback\/(\d+)\/share$/);
        if (shareMatch) {
          const allowed = ['whatsapp', 'facebook', 'x', 'reddit', 'telegram', 'copy'];
          if (!allowed.includes(body.platform)) {
            return new Response(JSON.stringify({ ok: false, error: 'invalid platform' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          await env.DB.prepare('UPDATE quiz_feedback SET shared_via = ? WHERE id = ?').bind(body.platform, shareMatch[1]).run();
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return feedbackErrorResponse(err);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
