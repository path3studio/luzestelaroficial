/**
 * POST /api/account/delete — GDPR Right to Erasure (Art. 17) / LFPDPPP Derecho de Cancelación
 *
 * Permanently deletes the authenticated user's account and all linked data:
 *   1. Cancels any active Stripe subscriptions (so we don't keep charging)
 *   2. Deletes D1 rows in FK-safe order:
 *      cached_reports → user_orders → subscriptions → birth_profiles → users
 *   3. Clears the auth cookie
 *
 * Safety:
 *   - Requires confirmation: body must include { confirm: "DELETE" } (case-sensitive)
 *     so a stray POST can never wipe an account.
 *   - Stripe-side cancellation failures are logged but DO NOT block deletion —
 *     the user's right to be forgotten supersedes our billing convenience.
 *     The user can also independently cancel from the Stripe portal if needed.
 *   - Logs the event with the user's ID (not email) for audit trail.
 *
 * What is NOT deleted by this endpoint:
 *   - Stripe customer object itself (kept for accounting / chargeback history)
 *     but the subscription is cancelled so no further charges occur.
 *   - D1 backups in R2 (snapshots are immutable point-in-time copies; they age
 *     out naturally and contain only the data that existed at backup time).
 *     A future restore from an old snapshot would resurrect the user — this is
 *     called out in restore.md so the operator knows to re-delete after restore.
 *
 * Auth: Bearer JWT cookie (`le_token`).
 */

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { DB, STRIPE_SECRET_KEY } = context.env;
  if (!DB) {
    return Response.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  // Confirmation guard
  let body;
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }
  if (body.confirm !== 'DELETE') {
    return Response.json(
      {
        ok: false,
        error: 'Confirmation required',
        hint: 'POST body must include { "confirm": "DELETE" } to proceed',
      },
      { status: 400 },
    );
  }

  const userId = user.sub;
  const result = {
    ok: true,
    user_id: userId,
    stripe: { cancelled: 0, errors: [] },
    deleted: {},
  };

  try {
    // 1. Look up active subscriptions and cancel them at Stripe
    const subs = await DB.prepare(
      `SELECT id, stripe_subscription_id, status
         FROM subscriptions
        WHERE user_id = ? AND stripe_subscription_id IS NOT NULL`
    ).bind(userId).all();

    for (const sub of subs.results || []) {
      // Skip ones that are already in a terminal state
      if (['canceled', 'incomplete_expired'].includes(sub.status)) continue;
      if (!STRIPE_SECRET_KEY) {
        result.stripe.errors.push({ id: sub.stripe_subscription_id, error: 'STRIPE_SECRET_KEY not set' });
        continue;
      }
      try {
        const r = await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(sub.stripe_subscription_id)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
          },
        );
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
          result.stripe.errors.push({
            id: sub.stripe_subscription_id,
            error: json.error?.message || `HTTP ${r.status}`,
          });
        } else {
          result.stripe.cancelled++;
        }
      } catch (e) {
        result.stripe.errors.push({
          id: sub.stripe_subscription_id,
          error: String(e).slice(0, 200),
        });
      }
    }

    // 2. Delete D1 rows in FK-safe order
    // (D1 doesn't enforce FKs by default, but we still delete children first
    //  so a partial failure leaves no orphans behind.)
    const tables = [
      'cached_reports',
      'user_orders',
      'subscriptions',
      'birth_profiles',
    ];
    for (const table of tables) {
      const r = await DB.prepare(`DELETE FROM ${table} WHERE user_id = ?`)
        .bind(userId).run();
      result.deleted[table] = r.meta?.changes ?? 0;
    }
    const userDel = await DB.prepare('DELETE FROM users WHERE id = ?')
      .bind(userId).run();
    result.deleted.users = userDel.meta?.changes ?? 0;

    // 3. Audit log (no PII — just the ID + counts)
    console.log(JSON.stringify({
      event: 'account_deleted',
      user_id: userId,
      stripe_cancelled: result.stripe.cancelled,
      stripe_errors: result.stripe.errors.length,
      deleted: result.deleted,
      at: new Date().toISOString(),
    }));

    // 4. Clear auth cookie on the response
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append(
      'Set-Cookie',
      'le_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    );
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (err) {
    console.error('Account deletion error:', err);
    return Response.json(
      { ok: false, error: 'Deletion failed', detail: String(err).slice(0, 200) },
      { status: 500 },
    );
  }
}
