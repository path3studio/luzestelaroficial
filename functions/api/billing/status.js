/**
 * GET /api/billing/status — Get user's subscription status
 */
export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { DB } = context.env;

  const sub = await DB.prepare(
    `SELECT plan, status, current_period_start, current_period_end, created_at
     FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(user.sub).first();

  const dbUser = await DB.prepare('SELECT tier FROM users WHERE id = ?')
    .bind(user.sub).first();

  return Response.json({
    ok: true,
    tier: dbUser ? dbUser.tier : 'free',
    subscription: sub ? {
      plan: sub.plan,
      status: sub.status,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      createdAt: sub.created_at,
    } : null,
  });
}
