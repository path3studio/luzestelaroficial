/**
 * GET /api/notifications/status
 * Returns push-notification metadata for the authenticated user:
 *   - vapidPublicKey: base64url-encoded public key the browser must use
 *     when calling pushManager.subscribe(). Comes from the VAPID_PUBLIC_KEY env var.
 *   - hasAny: true if this user has at least one active subscription row.
 *   - subscriptions: [{ id, endpoint, sendHourLocal, timezone, lang, lastSeenAt }]
 *
 * Front-end uses this to:
 *   - Know which public key to pass to pushManager.subscribe()
 *   - Show current opt-in state in the Settings toggle
 */

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const { DB, VAPID_PUBLIC_KEY } = context.env;

  let subscriptions = [];
  if (DB) {
    try {
      const res = await DB.prepare(
        `SELECT id, endpoint, send_hour_local, timezone, lang, notify_aspects, last_seen_at
           FROM push_subscriptions
          WHERE user_id = ?
          ORDER BY id DESC`
      ).bind(user.sub).all();
      subscriptions = (res.results || []).map(r => ({
        id: r.id,
        endpoint: r.endpoint,
        sendHourLocal: r.send_hour_local,
        timezone: r.timezone,
        lang: r.lang,
        notifyAspects: r.notify_aspects == null ? 1 : !!r.notify_aspects,
        lastSeenAt: r.last_seen_at,
      }));
    } catch (e) {
      console.error('[push/status] DB error', e);
    }
  }

  return Response.json({
    ok: true,
    vapidPublicKey: VAPID_PUBLIC_KEY || null,
    hasAny: subscriptions.length > 0,
    subscriptions,
  });
}
