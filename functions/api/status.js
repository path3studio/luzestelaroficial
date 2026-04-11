/**
 * GET /api/status — Public, sanitized status page data
 *
 * Aggregates the three internal-state signals into one boolean+severity per
 * component, suitable for displaying on a public /status.html page. Unlike
 * /api/health (which only checks "is the site up RIGHT NOW") this combines
 * uptime + backup freshness + usage health into a single overview.
 *
 * SECURITY: This endpoint is PUBLIC. It deliberately exposes only:
 *   - Boolean component states (ok / degraded / down)
 *   - Coarse age buckets (hours since last good signal)
 *   - The same checks /api/health already exposes
 *
 * It does NOT expose:
 *   - Row counts or any quantitative usage data (would leak business metrics)
 *   - Per-table backup details
 *   - User counts, KV key counts, R2 byte counts
 *   - Error messages from internal systems (could leak infrastructure detail)
 *
 * The internal admin endpoints (/api/admin/backup-status, /api/admin/usage-status)
 * still exist and require ADMIN_TOKEN for the full picture. This endpoint is the
 * "what users and you-on-mobile-without-the-token need to know" version.
 *
 * Severity model:
 *   - ok: component working as expected
 *   - degraded: stale or warning, site still usable
 *   - down: critical, site unusable or data at risk
 *
 * Overall = worst component severity. So a single 'down' tips the page red.
 */

const BACKUP_STALE_HOURS = 8 * 24;   // weekly + 1 day grace
const BACKUP_DOWN_HOURS = 14 * 24;   // 2 weeks = something is very wrong
const USAGE_STALE_HOURS = 36;        // daily + 12h grace
const USAGE_DOWN_HOURS = 72;         // 3 days = monitor itself broken

// Performance thresholds — p95 over the last 24h. Conservative; Cloudflare's
// edge usually does <300ms TTFB on /api/health and the home page is cached.
// These match the per-check thresholds in the uptime-monitor worker.
const PERF_API_P95_DEGRADED_MS = 1500;
const PERF_HOME_P95_DEGRADED_MS = 3000;
const PERF_API_P95_DOWN_MS = 3000;
const PERF_HOME_P95_DOWN_MS = 6000;
// Fail-rate over the rolling window. Anything above 10% is degraded;
// >25% means the site is effectively unusable from an external probe POV.
const PERF_FAIL_PCT_DEGRADED = 10;
const PERF_FAIL_PCT_DOWN = 25;
// Don't compute p95 from too few samples — noisy.
const PERF_MIN_SAMPLES = 6;          // 30 min of cron ticks
// If the metrics buffer hasn't been touched in a long time the cron
// probably isn't running. That's worth flagging.
const PERF_FRESH_MAX_HOURS = 1;

export async function onRequestGet(context) {
  const { AUTH_KV, DB } = context.env;
  const now = Date.now();
  const components = {};

  // 1. Site liveness — same checks as /api/health, condensed.
  // We re-do the work here (not call /api/health) to avoid an internal HTTP
  // hop and the cost of double-counting against rate limits.
  components.site = await checkSite(AUTH_KV, DB);

  // 2. Backup freshness — read the manifest stash from KV. We never expose
  // the row counts or per-table data, just the timestamp + ok flag.
  components.backup = await checkBackup(AUTH_KV, now);

  // 3. Usage monitor freshness — same pattern as backup. Coarse only.
  components.usage = await checkUsage(AUTH_KV, now);

  // 4. Performance — p50/p95 over the rolling 24h metrics buffer the
  // uptime-monitor worker maintains. Sanitized: we expose round-number
  // milliseconds and the sample count, nothing about request bodies or
  // internal errors. The point is to give visitors confidence the site
  // is fast, not to leak performance data to competitors.
  components.performance = await checkPerformance(AUTH_KV, now);

  // Compute overall severity from worst component.
  const order = { ok: 0, degraded: 1, down: 2 };
  let overall = 'ok';
  for (const c of Object.values(components)) {
    if (order[c.severity] > order[overall]) overall = c.severity;
  }

  return Response.json(
    {
      overall,
      components,
      generated_at: new Date().toISOString(),
    },
    {
      // Cache for 60s at the edge — status pages get hammered when something's
      // wrong, no need to recompute every request.
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}

async function checkSite(AUTH_KV, DB) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const hourUtc = new Date().getUTCHours();
  let kvOk = false;
  let d1Ok = false;
  let dailyOk = false;

  if (AUTH_KV) {
    try {
      const es = await AUTH_KV.get(`daily_Aries_${dateKey}_es`);
      kvOk = true;
      dailyOk = !!es;
    } catch {
      // kvOk stays false
    }
  }
  if (DB) {
    try {
      const row = await DB.prepare('SELECT 1 AS ok').first();
      d1Ok = row?.ok === 1;
    } catch {
      // d1Ok stays false
    }
  }

  // Severity logic: if KV or D1 is unreachable → down. If past pipeline grace
  // window and daily content missing → degraded (site works, content stale).
  let severity = 'ok';
  if (!kvOk || !d1Ok) {
    severity = 'down';
  } else if (hourUtc >= 11 && !dailyOk) {
    severity = 'degraded';
  }

  return {
    severity,
    kv: kvOk,
    d1: d1Ok,
    daily_content: dailyOk,
  };
}

async function checkBackup(AUTH_KV, nowMs) {
  if (!AUTH_KV) {
    return { severity: 'down', last_backup_at: null, age_hours: null };
  }
  let manifest = null;
  try {
    const raw = await AUTH_KV.get('d1_backup:last');
    if (raw) manifest = JSON.parse(raw);
  } catch {
    // manifest stays null
  }
  if (!manifest || !manifest.finished_at) {
    return { severity: 'down', last_backup_at: null, age_hours: null };
  }
  const ageHours = Math.round((nowMs - Date.parse(manifest.finished_at)) / 3600000);
  let severity = 'ok';
  if (!manifest.ok) severity = 'degraded'; // backup ran but had errors
  if (ageHours >= BACKUP_STALE_HOURS) severity = 'degraded';
  if (ageHours >= BACKUP_DOWN_HOURS) severity = 'down';

  return {
    severity,
    last_backup_at: manifest.finished_at,
    age_hours: ageHours,
  };
}

/**
 * Performance check — read the uptime-monitor's rolling 24h metrics buffer
 * and compute p50/p95 TTFB for the API probe and total time for the home probe.
 *
 * Returns a sanitized component object: severity + a tiny `metrics` block
 * with rounded numbers. We deliberately do NOT expose:
 *   - Per-sample timestamps or status codes
 *   - Body sizes
 *   - Marker check failures (those bubble up via the `site` component)
 *   - Error strings from individual probe failures
 *
 * Severity logic:
 *   - down  → fail rate > 25% OR api p95 > 3s OR home p95 > 6s
 *   - degraded → fail rate > 10% OR api p95 > 1.5s OR home p95 > 3s
 *               OR buffer hasn't been touched in >1h (cron stuck?)
 *   - ok → everything within thresholds
 *
 * Edge cases:
 *   - Buffer empty / missing → "ok" with `samples: 0` (worker hasn't run yet,
 *     don't false-alarm on a fresh deploy)
 *   - Fewer than PERF_MIN_SAMPLES → "ok" with the small sample count
 *     (avoids noisy p95 from a 1-sample window)
 */
async function checkPerformance(AUTH_KV, nowMs) {
  if (!AUTH_KV) {
    return { severity: 'down', samples: 0 };
  }
  let buf = [];
  try {
    const raw = await AUTH_KV.get('uptime_monitor:metrics');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) buf = parsed;
    }
  } catch {
    // buf stays empty — same fall-through as no buffer
  }

  if (buf.length === 0) {
    return { severity: 'ok', samples: 0, note: 'no samples yet' };
  }

  // Freshness check: when was the most recent sample appended?
  const lastAt = buf[buf.length - 1]?.at;
  const lastAgeHours = lastAt
    ? Math.round((nowMs - Date.parse(lastAt)) / 3600000)
    : null;

  if (buf.length < PERF_MIN_SAMPLES) {
    return {
      severity: lastAgeHours !== null && lastAgeHours > PERF_FRESH_MAX_HOURS ? 'degraded' : 'ok',
      samples: buf.length,
      window_hours: 24,
      last_sample_age_hours: lastAgeHours,
      note: 'building baseline',
    };
  }

  // Extract numeric series (drop nulls from failed probes — those become
  // fail-rate signal, not latency signal).
  const apiTtfb = [];
  const homeTotal = [];
  let apiFails = 0;
  let homeFails = 0;
  for (const s of buf) {
    if (s?.api?.ok && typeof s.api.ttfb_ms === 'number') apiTtfb.push(s.api.ttfb_ms);
    else apiFails += 1;
    if (s?.home?.ok && typeof s.home.total_ms === 'number') homeTotal.push(s.home.total_ms);
    else homeFails += 1;
  }

  const apiP50 = percentile(apiTtfb, 0.5);
  const apiP95 = percentile(apiTtfb, 0.95);
  const homeP50 = percentile(homeTotal, 0.5);
  const homeP95 = percentile(homeTotal, 0.95);
  const failPct = Math.round(((apiFails + homeFails) / (buf.length * 2)) * 100);

  // Severity decision tree
  let severity = 'ok';
  if (
    failPct > PERF_FAIL_PCT_DEGRADED ||
    (apiP95 != null && apiP95 > PERF_API_P95_DEGRADED_MS) ||
    (homeP95 != null && homeP95 > PERF_HOME_P95_DEGRADED_MS) ||
    (lastAgeHours !== null && lastAgeHours > PERF_FRESH_MAX_HOURS)
  ) {
    severity = 'degraded';
  }
  if (
    failPct > PERF_FAIL_PCT_DOWN ||
    (apiP95 != null && apiP95 > PERF_API_P95_DOWN_MS) ||
    (homeP95 != null && homeP95 > PERF_HOME_P95_DOWN_MS)
  ) {
    severity = 'down';
  }

  return {
    severity,
    samples: buf.length,
    window_hours: 24,
    last_sample_age_hours: lastAgeHours,
    fail_pct: failPct,
    api_ttfb_p50_ms: apiP50,
    api_ttfb_p95_ms: apiP95,
    home_total_p50_ms: homeP50,
    home_total_p95_ms: homeP95,
  };
}

/**
 * Linear-interpolation percentile. Returns null on empty input.
 * Not the world's most precise estimator but more than enough for ms-scale
 * latency monitoring on a 24h window.
 */
function percentile(arr, p) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return Math.round(sorted[lo]);
  const frac = idx - lo;
  return Math.round(sorted[lo] * (1 - frac) + sorted[hi] * frac);
}

async function checkUsage(AUTH_KV, nowMs) {
  if (!AUTH_KV) {
    return { severity: 'down', last_report_at: null, age_hours: null };
  }
  let report = null;
  try {
    const raw = await AUTH_KV.get('usage_report:last');
    if (raw) report = JSON.parse(raw);
  } catch {
    // report stays null
  }
  if (!report || !report.generated_at) {
    return { severity: 'degraded', last_report_at: null, age_hours: null };
  }
  const ageHours = Math.round((nowMs - Date.parse(report.generated_at)) / 3600000);
  let severity = 'ok';
  // Map the worker's own amber/red flags through, plus our own staleness check.
  if ((report.amber && report.amber.length > 0) || (report.errors && report.errors.length > 0)) {
    severity = 'degraded';
  }
  if (report.red && report.red.length > 0) severity = 'down';
  if (ageHours >= USAGE_STALE_HOURS && severity === 'ok') severity = 'degraded';
  if (ageHours >= USAGE_DOWN_HOURS) severity = 'down';

  return {
    severity,
    last_report_at: report.generated_at,
    age_hours: ageHours,
  };
}
