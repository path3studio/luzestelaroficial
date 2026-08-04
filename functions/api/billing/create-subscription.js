/**
 * POST /api/billing/create-subscription — Create a Stripe Checkout session for premium subscription
 */
export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const {
    STRIPE_SECRET_KEY,
    STRIPE_PRICE_PREMIUM,           // monthly (existing)
    STRIPE_PRICE_PREMIUM_ANNUAL,    // NEW — yearly ($29.99/yr)
    STRIPE_TRIAL_DAYS,              // optional override, defaults to 7
    DB,
  } = context.env;
  const origin = new URL(context.request.url).origin;

  // Get user's current tier
  const dbUser = await DB.prepare('SELECT tier, stripe_customer_id FROM users WHERE id = ?')
    .bind(user.sub).first();

  if (dbUser && dbUser.tier === 'premium') {
    return Response.json({ ok: false, error: 'Already subscribed to Premium' }, { status: 400 });
  }

  // Parse body: lang + cadence
  const body = await context.request.json().catch(() => ({}));
  const lang = body.lang || 'es';
  const cadence = body.cadence === 'annual' ? 'annual' : 'monthly';

  // Pick price by cadence (fall back to monthly if annual env not set yet)
  // 2026-08-04 — PRECIO POR PAÍS. La lección más cara del proyecto: cobramos
  // en USD y las tarjetas mexicanas no admiten cargos de suscripción en esa
  // moneda ("Divisa no aceptada", 11 rechazos seguidos de la única clienta).
  // Adaptive Pricing NO cubre las facturas recurrentes post-prueba: la
  // suscripción factura en la moneda del PRECIO, así que hace falta un precio
  // MXN de verdad y elegirlo aquí.
  // Fail-open deliberado: sin secreto *_MXN configurado, todo sigue en USD
  // exactamente como antes — desplegar este código sin los secretos no cambia
  // nada.
  const pais = (context.request.headers.get('CF-IPCountry') || '').toUpperCase();
  const esMx = pais === 'MX';
  const priceId = cadence === 'annual'
    ? (esMx && context.env.STRIPE_PRICE_PREMIUM_ANNUAL_MXN)
      || STRIPE_PRICE_PREMIUM_ANNUAL || STRIPE_PRICE_PREMIUM
    : (esMx && context.env.STRIPE_PRICE_PREMIUM_MXN)
      || STRIPE_PRICE_PREMIUM;

  if (!priceId) {
    console.error('create-subscription: no price id configured for cadence', cadence);
    return Response.json({ ok: false, error: 'Pricing not configured' }, { status: 500 });
  }

  // 2026-08-03: el retorno post-pago va a /mi-dia (la casa de la app: ahí
  // abre la PWA y ahí apuntan las pestañas), no a /dashboard, que ni leía el
  // parámetro. mi-dia muestra la bienvenida y la lectura ya desbloqueada.
  const successUrl = lang === 'en'
    ? `${origin}/en/my-day.html?subscription=success&cadence=${cadence}`
    : `${origin}/mi-dia.html?subscription=success&cadence=${cadence}`;
  const cancelUrl = lang === 'en'
    ? `${origin}/en/planes.html`
    : `${origin}/planes.html`;

  // Trial: 7 days by default, configurable via env; skip if <=0
  const trialDays = Number.isFinite(parseInt(STRIPE_TRIAL_DAYS, 10))
    ? parseInt(STRIPE_TRIAL_DAYS, 10)
    : 7;

  // Build Stripe session params
  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('metadata[user_id]', user.sub);
  params.set('metadata[cadence]', cadence);
  params.set('client_reference_id', user.sub);
  if (trialDays > 0) {
    params.set('subscription_data[trial_period_days]', String(trialDays));
    params.set('subscription_data[metadata][cadence]', cadence);
  } else {
    params.set('subscription_data[metadata][cadence]', cadence);
  }
  // Allow promo codes
  params.set('allow_promotion_codes', 'true');

  // Reuse existing Stripe customer if available
  if (dbUser && dbUser.stripe_customer_id) {
    params.set('customer', dbUser.stripe_customer_id);
  } else {
    params.set('customer_email', user.email);
  }

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (session.error) {
      console.error('Stripe error:', session.error);
      return Response.json({ ok: false, error: 'Payment service error' }, { status: 500 });
    }

    return Response.json({ ok: true, url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return Response.json({ ok: false, error: 'Payment service unavailable' }, { status: 500 });
  }
}
