/**
 * GET /api/admin/ratelimit-stats — Aggregated 429 counters
 *
 * Reads all `ratelimit_metric:{date}:{path}` keys from AUTH_KV and
 * returns a per-day, per-endpoint breakdown.
 *
 * Auth: Bearer token in `Authorization` header must match env.ADMIN_TOKEN.
 * Without ADMIN_TOKEN configured the endpoint refuses to serve (no
 * unauthenticated default — fail closed).
 */

export async function onRequestGet(context) {
  const { ADMIN_TOKEN, AUTH_KV } = context.env;

  if (!ADMIN_TOKEN) {
    return Response.json(
      { ok: false, error: 'Admin endpoint not configured' },
      { status: 503 },
    );
  }

  const auth = context.request.headers.get('Authorization') || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (provided !== ADMIN_TOKEN) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  if (!AUTH_KV) {
    return Response.json({ ok: false, error: 'KV unavailable' }, { status: 503 });
  }

  // Page through all metric keys (KV list caps at 1000 per call)
  const prefix = 'ratelimit_metric:';
  const entries = [];
  let cursor = undefined;
  let pages = 0;
  do {
    const page = await AUTH_KV.list({ prefix, cursor, limit: 1000 });
    for (const k of page.keys) entries.push(k.name);
    cursor = page.list_complete ? undefined : page.cursor;
    pages += 1;
    if (pages > 10) break; // safety cap — 10k keys is way more than expected
  } while (cursor);

  // Read all values in parallel (KV reads are cached at edge)
  const values = await Promise.all(
    entries.map(async (name) => {
      try {
        const raw = await AUTH_KV.get(name);
        return { name, count: raw ? parseInt(raw, 10) || 0 : 0 };
      } catch {
        return { name, count: 0 };
      }
    }),
  );

  // Aggregate: by date → by path
  const byDate = {};
  const byPath = {};
  let total = 0;
  for (const { name, count } of values) {
    // name format: ratelimit_metric:YYYY-MM-DD:/api/path
    const rest = name.slice(prefix.length);
    const colonIdx = rest.indexOf(':');
    if (colonIdx === -1) continue;
    const date = rest.slice(0, colonIdx);
    const path = rest.slice(colonIdx + 1);
    byDate[date] = byDate[date] || {};
    byDate[date][path] = (byDate[date][path] || 0) + count;
    byPath[path] = (byPath[path] || 0) + count;
    total += count;
  }

  return Response.json({
    ok: true,
    total_429s: total,
    window_days: 30,
    by_date: byDate,
    by_path: byPath,
    generated_at: new Date().toISOString(),
  });
}
