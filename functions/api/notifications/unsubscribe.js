/**
 * POST /api/notifications/unsubscribe
 * Removes a PushSubscription row for the authenticated user.
 *
 * Body: { endpoint: 'https://...' }
 *
 * No-op if the row doesn't exist (still returns ok:true).
 * User-scoped — will not delete another user's endpoint even if supplied.
 */

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const { DB } = context.env;
  if (!DB) {
    return Response.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let body;
  try { body = await context.request.json(); }
  catch { body = {}; }
  const endpoint = body && typeof body.endpoint === 'string' ? body.endpoint : null;
  if (!endpoint) {
    return Response.json({ ok: false, error: 'endpoint required' }, { status: 400 });
  }

  try {
    await DB.prepare(
      `DELETE FROM push_subscriptions
        WHERE endpoint = ? AND user_id = ?`
    ).bind(endpoint, user.sub).run();
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[push/unsubscribe] error', e);
    return Response.json({ ok: false, error: 'Could not unsubscribe' }, { status: 500 });
  }
}
