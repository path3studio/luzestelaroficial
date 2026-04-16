/**
 * GET /api/billing/status — Get user's subscription status
 */
export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { DB } = context.env;

  // Try new schema (with cadence + trial_end); fall back to old if migration 0004 not applied
  let sub;
  try {
    sub = await DB.prepare(
      `SELECT plan, cadence, status, current_period_start, current_period_end, trial_end, created_at
       FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).bind(user.sub).first();
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
