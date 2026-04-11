/**
 * GET /api/health — Public health probe
 *
 * Verifies the things that determine "is the site usable RIGHT NOW":
 *   1. KV is reachable
 *   2. D1 is reachable
 *   3. Today's daily horoscope content exists in KV (ES + EN)
 *
 * Returns 200 if everything is fine, 503 if anything is broken or stale.
 * Designed to be polled by:
 *   - Local `health_monitor.py` (every 2h)
 *   - External Cloudflare Worker monitor (every 5 min)
 *
 * Public, no auth — exposes only boolean checks, no PII.
 *
 * Pipeline timing: daily content is uploaded ~4 AM Mexico City
 * (UTC-6, no DST since 2022) = ~10 UTC. We allow a 90 min grace
 * window (until 11:30 UTC) before flagging as stale.
 */

const PIPELINE_GRACE_HOUR_UTC = 11; // = 5 AM Mexico City + 1h grace
const SAMPLE_SIGN = 'Aries';        // First sign alphabetically — canonical sentinel

export async function onRequestGet(context) {
  const { AUTH_KV, DB } = context.env;
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const hourUtc = now.getUTCHours();
  const checks = {};
  let healthy = true;

  // 1. KV reachable + today's content exists
  if (AUTH_KV) {
    try {
      const [es, en] = await Promise.all([
        AUTH_KV.get(`daily_${SAMPLE_SIGN}_${dateKey}_es`),
        AUTH_KV.get(`daily_${SAMPLE_SIGN}_${dateKey}_en`),
      ]);
      checks.kv = true;
      checks.daily_es = !!es;
      checks.daily_en = !!en;
    } catch (e) {
      checks.kv = false;
      checks.kv_error = String(e).slice(0, 200);
      healthy = false;
    }
  } else {
    checks.kv = false;
    healthy = false;
  }

  // 2. D1 reachable (cheap query — won't touch any user data)
  if (DB) {
    try {
      const row = await DB.prepare('SELECT 1 AS ok').first();
      checks.d1 = row?.ok === 1;
      if (!checks.d1) healthy = false;
    } catch (e) {
      checks.d1 = false;
      checks.d1_error = String(e).slice(0, 200);
      healthy = false;
    }
  } else {
    checks.d1 = false;
    healthy = false;
  }

  // 3. Freshness — only enforce after the daily pipeline grace window.
  // Hard fail: missing ES content (the canonical language).
  // Soft warning: missing EN content (dashboard falls back to ES).
  const pastGrace = hourUtc >= PIPELINE_GRACE_HOUR_UTC;
  const stale = pastGrace && !checks.daily_es;
  if (stale) {
    healthy = false;
    checks.stale = true;
  }
  if (pastGrace && !checks.daily_en) {
    checks.warning_en_missing = true;
  }

  return Response.json({
    ok: healthy,
    date: dateKey,
    hour_utc: hourUtc,
    past_pipeline_grace: pastGrace,
    checks,
    generated_at: now.toISOString(),
  }, { status: healthy ? 200 : 503 });
}
