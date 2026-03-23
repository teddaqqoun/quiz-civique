export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
