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
  const priceId = cadence === 'annual'
    ? (STRIPE_PRICE_PREMIUM_ANNUAL || STRIPE_PRICE_PREMIUM)
    : STRIPE_PRICE_PREMIUM;

  if (!priceId) {
    console.error('create-subscription: no price id configured for cadence', cadence);
    return Response.json({ ok: false, error: 'Pricing not configured' }, { status: 500 });
  }

  const successUrl = lang === 'en'
    ? `${origin}/en/dashboard.html?subscription=success&cadence=${cadence}`
    : `${origin}/dashboard.html?subscription=success&cadence=${cadence}`;
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
