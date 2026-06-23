/**
 * POST /api/billing/webhook — Handle Stripe webhook events
 *
 * Events handled:
 *   checkout.session.completed — Record order + activate subscription (if sub)
 *   customer.subscription.updated — Update tier
 *   customer.subscription.deleted — Downgrade to free
 *   invoice.payment_failed — Log warning
 *
 * Idempotency: every processed event.id is recorded in AUTH_KV
 * with a 7-day TTL. Stripe retries failed deliveries for up to 3 days,
 * so 7 days gives a safe margin. Repeated deliveries return 200 ok
 * without re-running the side effects (no duplicate INSERT).
 *
 * Notifications: on checkout.session.completed, sends a Telegram
 * alert if TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID are configured,
 * and writes to AUTH_KV:sale_notification:last for the admin panel.
 */
export async function onRequestPost(context) {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, DB, AUTH_KV } = context.env;

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

  // Idempotency check — skip if we've already processed this event.id.
  // Stripe guarantees event.id is unique per event (not per delivery).
  if (event.id && AUTH_KV) {
    const dedupeKey = `stripe_event:${event.id}`;
    try {
      const seen = await AUTH_KV.get(dedupeKey);
      if (seen) {
        // Already processed — acknowledge so Stripe stops retrying.
        console.log(JSON.stringify({
          event: 'stripe_webhook_dedupe',
          stripe_event_id: event.id,
          stripe_event_type: event.type,
        }));
        return new Response('ok (deduped)', { status: 200 });
      }
    } catch (e) {
      // KV read failure — fall through and process. Better to risk a
      // duplicate than to silently drop a real subscription event.
      console.warn('Idempotency KV read failed:', e);
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.user_id;
        if (!userId) break;

        const plan = session.metadata?.plan || 'premium';
        const cadence = session.metadata?.cadence === 'annual' ? 'annual' : 'monthly';
        const amountCents = session.amount_total || 0;
        const customerEmail = session.customer_details?.email || session.customer_email || '';
        const isSubscription = session.mode === 'subscription';

        // Update user: store customer ID, upgrade tier if subscription
        if (isSubscription) {
          await DB.prepare(
            'UPDATE users SET tier = ?, stripe_customer_id = ?, updated_at = ? WHERE id = ?'
          ).bind('premium', session.customer, now, userId).run();

          // Fetch subscription trial_end from Stripe (checkout session doesn't include it directly)
          let trialEnd = null;
          try {
            if (session.subscription && STRIPE_SECRET_KEY) {
              const subRes = await fetch(
                `https://api.stripe.com/v1/subscriptions/${session.subscription}`,
                { headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` } }
              );
              const subObj = await subRes.json();
              if (subObj?.trial_end) {
                trialEnd = new Date(subObj.trial_end * 1000).toISOString();
              }
            }
          } catch (e) {
            console.warn('trial_end fetch failed (non-fatal):', e.message);
          }

          // Record subscription — try new schema first, fall back to old if columns missing
          try {
            await DB.prepare(
              `INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_customer_id, plan, cadence, status, current_period_start, current_period_end, trial_end, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              crypto.randomUUID(), userId, session.subscription, session.customer,
              plan, cadence, 'active', now, '', trialEnd, now
            ).run();
          } catch (e) {
            // Schema migration 0004 not applied yet — use legacy columns
            console.warn('subscriptions insert (new schema) failed, using legacy:', e.message);
            await DB.prepare(
              `INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_customer_id, plan, status, current_period_start, current_period_end, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              crypto.randomUUID(), userId, session.subscription, session.customer,
              plan, 'active', now, '', now
            ).run();
          }
        } else {
          // One-time purchase — just store customer ID
          await DB.prepare(
            'UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, ?), updated_at = ? WHERE id = ?'
          ).bind(session.customer, now, userId).run();
        }

        // Record order in user_orders (for ALL purchase types)
        try {
          await DB.prepare(
            `INSERT OR IGNORE INTO user_orders (id, user_id, stripe_session_id, plan, amount_cents, currency, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            crypto.randomUUID(), userId, session.id,
            plan, amountCents, session.currency || 'usd', now
          ).run();
        } catch (orderErr) {
          console.warn('Order insert failed (non-fatal):', orderErr.message);
        }

        // ── Notifications (non-fatal) ──
        // Telegram alert (pass isSubscription so a $0 trial isn't called a "sale")
        await notifyTelegram(context.env, plan, amountCents, customerEmail, isSubscription).catch(() => {});

        // Write to KV for admin panel instant visibility
        if (AUTH_KV) {
          const saleNote = JSON.stringify({
            plan, amount_cents: amountCents, email: customerEmail,
            session_id: session.id, timestamp: now,
          });
          await AUTH_KV.put('sale_notification:last', saleNote, {
            expirationTtl: 7 * 86400,
          }).catch(() => {});
        }

        console.log(JSON.stringify({
          event: 'checkout_completed',
          plan, amount_cents: amountCents, mode: session.mode,
        }));
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

      case 'invoice.paid': {
        // Real money arrived: a trial converted to paid, or a renewal charged.
        // The $0 trial-start invoice already pinged as a TRIAL via
        // checkout.session.completed, so skip zero-amount invoices here to
        // avoid a duplicate "sale" alert with no money behind it. (2026-06-16)
        const invoice = event.data.object;
        const amountCents = invoice.amount_paid || 0;
        if (amountCents > 0) {
          const email = invoice.customer_email || '';
          let plan = 'premium';
          try {
            if (invoice.subscription) {
              const subRow = await DB.prepare(
                'SELECT plan FROM subscriptions WHERE stripe_subscription_id = ?'
              ).bind(invoice.subscription).first();
              if (subRow?.plan) plan = subRow.plan;
            }
          } catch (e) { /* non-fatal — fall back to 'premium' */ }

          await notifyTelegram(context.env, plan, amountCents, email, true, 'payment').catch(() => {});

          if (AUTH_KV) {
            await AUTH_KV.put('sale_notification:last', JSON.stringify({
              plan, amount_cents: amountCents, email,
              invoice_id: invoice.id, billing_reason: invoice.billing_reason,
              timestamp: now, kind: 'payment',
            }), { expirationTtl: 7 * 86400 }).catch(() => {});
          }
          console.log(JSON.stringify({
            event: 'invoice_paid', plan, amount_cents: amountCents,
            billing_reason: invoice.billing_reason,
          }));
        }
        break;
      }
    }

    // Mark as processed AFTER successful handling, so Stripe retries
    // any event whose handler threw before we got here.
    if (event.id && AUTH_KV) {
      try {
        await AUTH_KV.put(
          `stripe_event:${event.id}`,
          JSON.stringify({ type: event.type, processed_at: now }),
          { expirationTtl: 7 * 86400 },
        );
      } catch (e) {
        // Idempotency-store write failed — log but don't error the webhook.
        // Worst case Stripe re-delivers and we re-process (matters mainly
        // for INSERT statements without UNIQUE constraints).
        console.warn('Idempotency KV write failed:', e);
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return new Response('Internal error', { status: 500 });
  }
}

// ── Telegram notification helper ────────────────────────────────

const PRODUCT_NAMES = {
  esencial: 'Consulta Esencial',
  completo: 'Consulta Completa',
  mapa_estelar: 'Mapa Estelar',
  mapa_estelar_custom: 'Mapa Estelar Custom',
  'plan-estelar': 'Plan Estelar (suscripción)',
  premium: 'Suscripción Premium',
};

async function notifyTelegram(env, plan, amountCents, email, isSubscription = false, kind = null) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // Telegram not configured — skip silently

  const productName = PRODUCT_NAMES[plan] || plan;
  const amount = (amountCents / 100).toFixed(2);
  const escapedEmail = (email || 'anónimo').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const when = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  // A subscription that charges $0 right now is a FREE-TRIAL start, not a sale.
  // Don't cry "¡Nueva venta!" until money actually moves. (2026-06-16)
  // kind='payment' = a real invoice was paid (invoice.paid) — trial converted
  // or a renewal; real money arrived.
  const isTrial = kind !== 'payment' && isSubscription && amountCents === 0;

  let text;
  if (isTrial) {
    text = [
      `🎁 <b>Nueva prueba de Premium</b>`,
      `${productName} — gratis (prueba de 7 días)`,
      `<i>${escapedEmail}</i>`,
      `<i>${when}</i>`,
      `Se vuelve venta cuando termine la prueba, si no cancela.`,
    ].join('\n');
  } else if (kind === 'payment') {
    text = [
      `💰 <b>Pago de suscripción recibido</b>`,
      `${productName} — $${amount} USD`,
      `<i>${escapedEmail}</i>`,
      `<i>${when}</i>`,
    ].join('\n');
  } else {
    text = [
      `💰 <b>¡Nueva venta!</b>`,
      `${productName} — $${amount} USD`,
      `<i>${escapedEmail}</i>`,
      `<i>${when}</i>`,
    ].join('\n');
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
}
