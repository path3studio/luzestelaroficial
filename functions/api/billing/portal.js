/**
 * POST /api/billing/portal — Create a Stripe Customer Portal session
 * Allows users to manage their subscription, update payment, cancel, etc.
 */
export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { STRIPE_SECRET_KEY, DB } = context.env;
  const origin = new URL(context.request.url).origin;

  // Get Stripe customer ID
  const dbUser = await DB.prepare('SELECT stripe_customer_id FROM users WHERE id = ?')
    .bind(user.sub).first();

  // 2026-11-05: suscripción comprada por Google Play (app Android) → se gestiona en Play,
  // no en el portal de Stripe.
  try {
    const gp = await DB.prepare(
      "SELECT google_product_id FROM subscriptions WHERE user_id = ? AND provider = 'google_play' " +
      "AND status IN ('active','past_due','canceled','on_hold','paused') ORDER BY created_at DESC LIMIT 1"
    ).bind(user.sub).first();
    if (gp) {
      const sku = encodeURIComponent(gp.google_product_id || 'plus_mensual');
      return Response.json({
        ok: true, provider: 'google_play',
        url: `https://play.google.com/store/account/subscriptions?sku=${sku}&package=com.luzestelaroficial.app`,
      });
    }
  } catch (_) { /* columnas sin migrar → solo Stripe */ }

  if (!dbUser || !dbUser.stripe_customer_id) {
    return Response.json({ ok: false, error: 'No active subscription found' }, { status: 404 });
  }

  const body = await context.request.json().catch(() => ({}));
  const lang = body.lang || 'es';
  const returnUrl = lang === 'en'
    ? `${origin}/en/dashboard.html`
    : `${origin}/dashboard.html`;

  try {
    const params = new URLSearchParams();
    params.set('customer', dbUser.stripe_customer_id);
    params.set('return_url', returnUrl);

    const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (session.error) {
      console.error('Stripe portal error:', session.error);
      return Response.json({ ok: false, error: 'Portal service error' }, { status: 500 });
    }

    return Response.json({ ok: true, url: session.url });
  } catch (err) {
    console.error('Portal error:', err);
    return Response.json({ ok: false, error: 'Service unavailable' }, { status: 500 });
  }
}
