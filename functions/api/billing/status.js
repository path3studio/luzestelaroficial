/**
 * GET /api/billing/status — Get user's subscription status
 *
 * 2026-11-05: las suscripciones compradas por Google Play (app Android) llevan
 * provider = 'google_play'. Si su periodo ya venció, antes de responder volvemos a
 * preguntar a Google (renovación o baja) por si la notificación RTDN no llegó.
 */
import { syncPurchaseToken } from '../../_shared/google-play.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { DB } = context.env;

  // Try new schema (with cadence + trial_end); fall back to old if migration 0004 not applied
  let sub;
  try {
    sub = await DB.prepare(
      `SELECT plan, cadence, status, current_period_start, current_period_end, trial_end, created_at,
              provider, google_purchase_token, google_product_id, google_checked_at
       FROM subscriptions WHERE user_id = ? AND status <> 'replaced' ORDER BY created_at DESC LIMIT 1`
    ).bind(user.sub).first();
    if (sub && sub.provider === 'google_play' && sub.google_purchase_token
        && context.env.GOOGLE_PLAY_SERVICE_ACCOUNT) {
      const vencida = !sub.current_period_end || new Date(sub.current_period_end) < new Date();
      const viva = ['active', 'past_due', 'canceled', 'on_hold', 'paused', 'pending'].includes(sub.status);
      const hace = sub.google_checked_at ? (Date.now() - new Date(sub.google_checked_at).getTime()) : Infinity;
      if (viva && vencida && hace > 10 * 60 * 1000) {
        try {
          await syncPurchaseToken(context.env, sub.google_purchase_token, sub.google_product_id);
          sub = await DB.prepare(
            `SELECT plan, cadence, status, current_period_start, current_period_end, trial_end, created_at,
                    provider, google_purchase_token, google_product_id, google_checked_at
             FROM subscriptions WHERE user_id = ? AND status <> 'replaced' ORDER BY created_at DESC LIMIT 1`
          ).bind(user.sub).first();
        } catch (e) {
          console.warn('google play resync:', e.message);
        }
      }
    }
  } catch {
    sub = await DB.prepare(
      `SELECT plan, status, current_period_start, current_period_end, created_at
       FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).bind(user.sub).first();
  }

  const dbUser = await DB.prepare('SELECT tier FROM users WHERE id = ?')
    .bind(user.sub).first();

  return Response.json({
    ok: true,
    tier: dbUser ? dbUser.tier : 'free',
    subscription: sub ? {
      provider: sub.provider || 'stripe',
      plan: sub.plan,
      cadence: sub.cadence || 'monthly',
      status: sub.status,
      inTrial: sub.status === 'trialing' || (sub.trial_end && new Date(sub.trial_end) > new Date()),
      trialEnd: sub.trial_end || null,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      createdAt: sub.created_at,
    } : null,
  });
}
