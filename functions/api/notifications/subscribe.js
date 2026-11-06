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
  // 2026-11-06: si el cliente NO manda la preferencia (p. ej. al cambiar la hora) se CONSERVA la
  // guardada; antes cambiar la hora volvía a encender los tránsitos que la persona había apagado.
  const flag = (v) => (v === undefined || v === null) ? null : ((v === false || v === 0) ? 0 : 1);
  const notifyAspects = flag(body.notifyAspects);
  const notifyCielo = flag(body.notifyCielo); // «Avisos del cielo» (migración 0011)

  const ua = (context.request.headers.get('User-Agent') || '').slice(0, 200);
  const nowIso = new Date().toISOString();

  try {
    // Upsert on endpoint — one physical device per endpoint.
    // Preferencias: al crear, null → 1; al actualizar, null → se queda la que había.
    const upsert = (conCielo) => DB.prepare(
      `INSERT INTO push_subscriptions
         (user_id, endpoint, p256dh, auth, lang, timezone, send_hour_local, notify_aspects,${conCielo ? ' notify_cielo,' : ''} user_agent, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 1),${conCielo ? ' COALESCE(?, 1),' : ''} ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id         = excluded.user_id,
         p256dh          = excluded.p256dh,
         auth            = excluded.auth,
         lang            = excluded.lang,
         timezone        = excluded.timezone,
         send_hour_local = excluded.send_hour_local,
         notify_aspects  = COALESCE(?, push_subscriptions.notify_aspects),${conCielo ? `
         notify_cielo    = COALESCE(?, push_subscriptions.notify_cielo),` : ''}
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
      ...(conCielo ? [notifyCielo] : []),
      ua,
      nowIso,
      nowIso,
      notifyAspects,
      ...(conCielo ? [notifyCielo] : []),
    ).run();
    try {
      await upsert(true);
    } catch (e) {
      // Antes de aplicar la migración 0011 la columna no existe: se guarda sin ella.
      if (!/notify_cielo/i.test(String(e && e.message))) throw e;
      await upsert(false);
    }

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
