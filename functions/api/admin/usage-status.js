/**
 * GET /api/admin/usage-status — Last usage report from luzestelar-usage-monitor
 *
 * Reads the report stashed by the usage-monitor worker in AUTH_KV under
 * `usage_report:last`. Avoids re-running the worker on every check.
 *
 * Auth: Bearer ADMIN_TOKEN.
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

  const raw = await AUTH_KV.get('usage_report:last');
  if (!raw) {
    return Response.json({
      ok: true,
      last_report: null,
      note: 'No usage report yet — has the usage-monitor worker run?',
    });
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: 'Corrupt report' }, { status: 500 });
  }

  const generatedAt = report.generated_at ? new Date(report.generated_at) : null;
  const ageHours = generatedAt
    ? Math.round((Date.now() - generatedAt.getTime()) / 3600000)
    : null;

  return Response.json({
    ok: true,
    last_report: report,
    age_hours: ageHours,
    stale: ageHours !== null && ageHours > 36, // daily schedule + 12h grace
  });
}
