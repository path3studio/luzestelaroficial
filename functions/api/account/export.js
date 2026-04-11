/**
 * GET /api/account/export — GDPR Right to Access (Art. 15) / LFPDPPP Derecho de Acceso
 *
 * Returns a JSON dump of every row in D1 that belongs to the authenticated user.
 * The user can save it locally as their personal data archive.
 *
 * Includes:
 *   - users row (account profile)
 *   - birth_profiles (all saved profiles, including computed signs/charts)
 *   - user_orders (purchase history)
 *   - subscriptions (plan history)
 *   - cached_reports (generated cross-cultural / compatibility reports)
 *
 * Does NOT include:
 *   - JWT secrets, Stripe customer secrets, or any field the user didn't provide
 *   - Other users' data (queries are scoped by user_id)
 *
 * Auth: Bearer JWT cookie (`le_token`).
 * Response: `application/json` with `Content-Disposition: attachment` so browsers download it.
 */

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { DB } = context.env;
  if (!DB) {
    return Response.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const exportedAt = new Date().toISOString();

  try {
    // Account row — explicit column list, no secrets
    const account = await DB.prepare(
      `SELECT id, email, name, picture_url, auth_provider, tier, lang,
              created_at, updated_at
         FROM users WHERE id = ?`
    ).bind(user.sub).first();

    if (!account) {
      return Response.json({ ok: false, error: 'Account not found' }, { status: 404 });
    }

    // Birth profiles
    const birthProfiles = await DB.prepare(
      `SELECT id, label, nombre, fecha_nacimiento, hora_nacimiento,
              lugar_nacimiento, lat, lon, timezone, natal_chart,
              western_sign, chinese_animal, numerology_number, celtic_tree,
              mayan_kin, mayan_seal, mayan_tone, vedic_rashi, vedic_nakshatra,
              human_design_gate, enneagram_type, enneagram_wing,
              is_primary, created_at
         FROM birth_profiles WHERE user_id = ? ORDER BY created_at ASC`
    ).bind(user.sub).all();

    // Orders (purchase history)
    const orders = await DB.prepare(
      `SELECT id, stripe_session_id, plan, amount_cents, currency, created_at
         FROM user_orders WHERE user_id = ? ORDER BY created_at ASC`
    ).bind(user.sub).all();

    // Subscriptions
    const subscriptions = await DB.prepare(
      `SELECT id, stripe_subscription_id, plan, status,
              current_period_start, current_period_end, created_at
         FROM subscriptions WHERE user_id = ? ORDER BY created_at ASC`
    ).bind(user.sub).all();

    // Cached reports — these are derived but the user paid for them, so include
    const cachedReports = await DB.prepare(
      `SELECT id, birth_profile_id, cache_key, report_json, created_at
         FROM cached_reports WHERE user_id = ? ORDER BY created_at ASC`
    ).bind(user.sub).all();

    // Parse stored JSON columns so the export is human-readable, not double-escaped
    const profiles = (birthProfiles.results || []).map(p => ({
      ...p,
      natal_chart: safeParseJson(p.natal_chart),
    }));
    const reports = (cachedReports.results || []).map(r => ({
      ...r,
      report_json: safeParseJson(r.report_json),
    }));

    const payload = {
      export_format_version: 1,
      exported_at: exportedAt,
      source: 'luzestelaroficial.com',
      notice: 'Your personal data export under GDPR Art. 15 / LFPDPPP. ' +
              'Keep this file secure — it contains your full profile and purchase history.',
      account,
      birth_profiles: profiles,
      orders: orders.results || [],
      subscriptions: subscriptions.results || [],
      cached_reports: reports,
    };

    const filename = `luzestelar-export-${exportedAt.slice(0, 10)}.json`;
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Account export error:', err);
    return Response.json(
      { ok: false, error: 'Export failed' },
      { status: 500 },
    );
  }
}

function safeParseJson(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value; // Return raw if it isn't valid JSON
  }
}
