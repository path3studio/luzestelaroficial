/**
 * GET /api/admin/backup-status — Last D1 backup status
 *
 * Reads the manifest stashed by the d1-backup Worker in AUTH_KV
 * under `d1_backup:last`. Avoids hitting R2 on every check.
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

  const raw = await AUTH_KV.get('d1_backup:last');
  if (!raw) {
    return Response.json({
      ok: true,
      last_backup: null,
      note: 'No backup recorded yet — has the d1-backup worker run?',
    });
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: 'Corrupt manifest' }, { status: 500 });
  }

  // Compute age in hours so the caller can flag stale backups easily
  const finishedAt = manifest.finished_at ? new Date(manifest.finished_at) : null;
  const ageHours = finishedAt
    ? Math.round((Date.now() - finishedAt.getTime()) / 3600000)
    : null;

  return Response.json({
    ok: true,
    last_backup: manifest,
    age_hours: ageHours,
    stale: ageHours !== null && ageHours > 8 * 24, // weekly schedule + 1 day grace
  });
}
