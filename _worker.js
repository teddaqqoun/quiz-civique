import DASHBOARD_HTML from './admin/dashboard.html';

const ADMIN_HOST = 'admin.test-civique-gratuit.com';

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
            await env.DB.prepare(
              'INSERT INTO quiz_feedback (stars, difficulty, would_recommend, comment, level, mode, sandbox) VALUES (?, ?, ?, ?, ?, ?, 1)'
            ).bind(body.stars || null, body.difficulty || null, body.would_recommend != null ? (body.would_recommend ? 1 : 0) : null, body.comment || null, body.level || null, body.mode || null).run();
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
          }
          if (url.pathname === '/api/admin/sandbox/bug-report') {
            if (!body.description) return new Response(JSON.stringify({ ok: false, error: 'description required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            await env.DB.prepare('INSERT INTO bug_reports (page_url, description, sandbox) VALUES (?, ?, 1)').bind(body.page_url || null, body.description).run();
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
          }
          if (url.pathname === '/api/admin/sandbox/question-report') {
            await env.DB.prepare('INSERT INTO question_reports (question_text, level, theme, reason, sandbox) VALUES (?, ?, ?, ?, 1)').bind(body.question_text || null, body.level || null, body.theme || null, body.reason || null).run();
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
          }
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
          await env.DB.prepare(
            'INSERT INTO quiz_feedback (stars, difficulty, would_recommend, comment, level, mode) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(
            body.stars || null,
            body.difficulty || null,
            body.would_recommend != null ? (body.would_recommend ? 1 : 0) : null,
            body.comment || null,
            body.level || null,
            body.mode || null
          ).run();
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (url.pathname === '/api/bug-report') {
          if (!body.description) {
            return new Response(JSON.stringify({ ok: false, error: 'description required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          await env.DB.prepare(
            'INSERT INTO bug_reports (page_url, description) VALUES (?, ?)'
          ).bind(
            body.page_url || null,
            body.description
          ).run();
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (url.pathname === '/api/question-report') {
          await env.DB.prepare(
            'INSERT INTO question_reports (question_text, level, theme, reason) VALUES (?, ?, ?, ?)'
          ).bind(
            body.question_text || null,
            body.level || null,
            body.theme || null,
            body.reason || null
          ).run();
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
