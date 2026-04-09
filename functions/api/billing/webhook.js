/**
 * POST /api/billing/webhook — Handle Stripe webhook events
 *
 * Events handled:
 *   checkout.session.completed — Activate subscription
 *   customer.subscription.updated — Update tier
 *   customer.subscription.deleted — Downgrade to free
 *   invoice.payment_failed — Log warning
 */
export async function onRequestPost(context) {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, DB } = context.env;

  // Verify webhook signature
  const sig = context.request.headers.get('stripe-signature');
  const body = await context.request.text();

  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    return new Response('Missing signature', { status: 400 });
  }

  // Parse Stripe signature
  const parts = {};
  sig.split(',').forEach(item => {
    const [key, val] = item.split('=');
    parts[key] = val;
  });

  const timestamp = parts['t'];
  const expectedSig = parts['v1'];

  if (!timestamp || !expectedSig) {
    return new Response('Invalid signature format', { status: 400 });
  }

  // Verify timing (reject if older than 5 minutes)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) {
    return new Response('Timestamp too old', { status: 400 });
  }

  // Compute expected signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signed = await crypto.subtle.sign(
    'HMAC', key, encoder.encode(`${timestamp}.${body}`)
  );
  const computedSig = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  if (computedSig !== expectedSig) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);
  const now = new Date().toISOString();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.user_id;
        if (!userId) break;

        // Update user tier and store customer ID
        await DB.prepare(
          'UPDATE users SET tier = ?, stripe_customer_id = ?, updated_at = ? WHERE id = ?'
        ).bind('premium', session.customer, now, userId).run();

        // Record subscription
        await DB.prepare(
          `INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_customer_id, plan, status, current_period_start, current_period_end, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), userId, session.subscription, session.customer,
          'premium', 'active', now, '', now
        ).run();
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const status = sub.status; // active, past_due, canceled, etc.
        const tier = (status === 'active' || status === 'trialing') ? 'premium' : 'free';

        // Update subscription record
        await DB.prepare(
          'UPDATE subscriptions SET status = ?, current_period_start = ?, current_period_end = ? WHERE stripe_subscription_id = ?'
        ).bind(
          status,
          new Date(sub.current_period_start * 1000).toISOString(),
          new Date(sub.current_period_end * 1000).toISOString(),
          sub.id
        ).run();

        // Update user tier
        await DB.prepare(
          'UPDATE users SET tier = ?, updated_at = ? WHERE stripe_customer_id = ?'
        ).bind(tier, now, sub.customer).run();
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await DB.prepare(
          'UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?'
        ).bind('canceled', sub.id).run();

        await DB.prepare(
          'UPDATE users SET tier = ?, updated_at = ? WHERE stripe_customer_id = ?'
        ).bind('free', now, sub.customer).run();
        break;
      }

      case 'invoice.payment_failed': {
        console.warn('Payment failed for customer:', event.data.object.customer);
        break;
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return new Response('Internal error', { status: 500 });
  }
}
