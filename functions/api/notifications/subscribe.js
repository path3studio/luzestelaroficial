/**
 * POST /api/notifications/subscribe
 * Persists a browser PushSubscription for the authenticated user.
 *
 * Body:
 *   {
 *     subscription: { endpoint, keys: { p256dh, auth } },
 *     lang:        'es' | 'en'                 // optional, defaults to user.lang
 *     timezone:    'America/Mexico_City'       // IANA zone, optional
 *     sendHourLocal: 8                         // 0-23, defaults to 8
 *   }
 *
 * Idempotent: upserts on `endpoint` (unique).
 * Returns: { ok: true, id }
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

  const sub = body && body.subscription;
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return Response.json(
      { ok: false, error: 'Invalid subscription payload' },
      { status: 400 }
    );
  }

  const lang = (body.lang === 'en') ? 'en' : 'es';
  const timezone = typeof body.timezone === 'string' && body.timezone.length < 64
    ? body.timezone
    : 'America/Mexico_City';
  let sendHour = parseInt(body.sendHourLocal, 10);
  if (!Number.isFinite(sendHour) || sendHour < 0 || sendHour > 23) sendHour = 8;
  // notify_aspects is opt-OUT: undefined/true/1 → store 1, only explicit
  // false/0 disables. Existing subscribers default to 1 via the schema.
  const notifyAspects = (body.notifyAspects === false || body.notifyAspects === 0) ? 0 : 1;

  const ua = (context.request.headers.get('User-Agent') || '').slice(0, 200);
  const nowIso = new Date().toISOString();

  try {
    // Upsert on endpoint — one physical device per endpoint.
    await DB.prepare(
      `INSERT INTO push_subscriptions
         (user_id, endpoint, p256dh, auth, lang, timezone, send_hour_local, notify_aspects, user_agent, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id         = excluded.user_id,
         p256dh          = excluded.p256dh,
         auth            = excluded.auth,
         lang            = excluded.lang,
         timezone        = excluded.timezone,
         send_hour_local = excluded.send_hour_local,
         notify_aspects  = excluded.notify_aspects,
         user_agent      = excluded.user_agent,
         last_seen_at    = excluded.last_seen_at`
    ).bind(
      user.sub,
      sub.endpoint,
      sub.keys.p256dh,
      sub.keys.auth,
      lang,
      timezone,
      sendHour,
      notifyAspects,
      ua,
      nowIso,
      nowIso
    ).run();

    const row = await DB.prepare(
      `SELECT id FROM push_subscriptions WHERE endpoint = ? LIMIT 1`
    ).bind(sub.endpoint).first();

    return Response.json({ ok: true, id: row ? row.id : null });
  } catch (e) {
    console.error('[push/subscribe] error', e);
    return Response.json(
      { ok: false, error: 'Could not save subscription' },
      { status: 500 }
    );
  }
}
