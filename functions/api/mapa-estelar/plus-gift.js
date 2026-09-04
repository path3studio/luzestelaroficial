/**
 * POST /api/mapa-estelar/plus-gift — Mapa estelar de nacimiento INCLUIDO con Plus.
 *
 * 2026-09-03: Planes y el hub prometían «mapa estelar incluido con Plus» sin
 * ningún mecanismo (auditoría del catálogo). Este endpoint lo cumple SIN
 * plomería nueva: crea una Checkout Session del producto Mapa Estelar con un
 * cupón del 100 % aplicado del lado del servidor (STRIPE_COUPON_PLUS_MAPA,
 * restringido a ese producto). El total es $0, Stripe completa la sesión sin
 * cobrar, dispara el webhook del worker de consultas y el pedido entra al
 * mismo carril que un mapa pagado (consultation_checker respeta los formatos).
 *
 * Reglas: solo usuarios autenticados con tier 'premium'; un regalo por cuenta
 * (AUTH_KV plus_mapa_gift:<uid> guarda la sesión). Si la sesión anterior sigue
 * abierta se devuelve la misma URL; si expiró, se crea otra; si se completó,
 * se niega. Formatos del regalo: celular + escritorio (sin medida a la carta).
 */
export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { DB, AUTH_KV, STRIPE_SECRET_KEY, STRIPE_PRICE_MAPA_ESTELAR, STRIPE_COUPON_PLUS_MAPA } = context.env;
  if (!DB || !STRIPE_SECRET_KEY || !STRIPE_PRICE_MAPA_ESTELAR || !STRIPE_COUPON_PLUS_MAPA) {
    return Response.json({ ok: false, error: 'Gift not configured' }, { status: 503 });
  }

  const dbUser = await DB.prepare('SELECT id, email, tier, lang FROM users WHERE id = ?').bind(user.sub).first();
  if (!dbUser) return Response.json({ ok: false, error: 'User not found' }, { status: 404 });
  if (dbUser.tier !== 'premium') {
    return Response.json({ ok: false, error: 'plus_required' }, { status: 403 });
  }

  const lang = dbUser.lang === 'en' ? 'en' : 'es';
  const kvKey = `plus_mapa_gift:${dbUser.id}`;

  // ¿Ya reclamado o con sesión viva?
  if (AUTH_KV) {
    const prev = await AUTH_KV.get(kvKey, 'json').catch(() => null);
    if (prev && prev.session_id) {
      const s = await stripeGet(`/checkout/sessions/${prev.session_id}`, STRIPE_SECRET_KEY);
      if (s && s.status === 'complete') {
        return Response.json({ ok: false, error: 'already_claimed', claimed_at: prev.claimed_at || null }, { status: 409 });
      }
      if (s && s.status === 'open' && s.url) {
        return Response.json({ ok: true, url: s.url, reused: true });
      }
      // expirada → se crea otra abajo
    }
  }

  const profile = await DB.prepare(
    'SELECT nombre, fecha_nacimiento, hora_nacimiento, lugar_nacimiento FROM birth_profiles WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC LIMIT 1'
  ).bind(dbUser.id).first();
  if (!profile || !profile.fecha_nacimiento || !profile.lugar_nacimiento) {
    return Response.json({ ok: false, error: 'profile_incomplete' }, { status: 400 });
  }

  const nombre = String(profile.nombre || dbUser.email.split('@')[0]).slice(0, 60);
  const titulo = lang === 'en' ? `The sky of my birth — ${nombre}` : `El cielo de mi nacimiento — ${nombre}`;
  const origin = new URL(context.request.url).origin;
  const params = {
    'mode': 'payment',
    'customer_email': dbUser.email,
    'line_items[0][price]': STRIPE_PRICE_MAPA_ESTELAR,
    'line_items[0][quantity]': '1',
    'discounts[0][coupon]': STRIPE_COUPON_PLUS_MAPA,
    'metadata[nombre]': titulo,
    'metadata[fecha_nacimiento]': String(profile.fecha_nacimiento),
    'metadata[hora_nacimiento]': String(profile.hora_nacimiento || '12:00'),
    'metadata[lugar_nacimiento]': String(profile.lugar_nacimiento),
    'metadata[email]': dbUser.email,
    'metadata[mensaje]': 'MAPA ESTELAR | Formatos: phone,desktop | Plus: regalo incluido',
    'metadata[plan]': 'mapa_estelar',
    'metadata[lang]': lang,
    'metadata[plus_gift_user]': dbUser.id,
    'success_url': lang === 'en' ? `${origin}/en/my-day.html?mapa=gift` : `${origin}/mi-dia.html?mapa=regalo`,
    'cancel_url': lang === 'en' ? `${origin}/en/my-day.html` : `${origin}/mi-dia.html`,
  };

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const session = await res.json().catch(() => ({}));
  if (!res.ok || !session.url) {
    console.error('[plus-gift] stripe error', session.error && session.error.message);
    return Response.json({ ok: false, error: 'Could not create gift session' }, { status: 502 });
  }

  if (AUTH_KV) {
    await AUTH_KV.put(kvKey, JSON.stringify({ session_id: session.id, created_at: new Date().toISOString() }),
      { expirationTtl: 400 * 86400 }).catch(() => {});
  }
  return Response.json({ ok: true, url: session.url });
}

async function stripeGet(path, key) {
  try {
    const r = await fetch(`https://api.stripe.com/v1${path}`, { headers: { 'Authorization': `Bearer ${key}` } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
