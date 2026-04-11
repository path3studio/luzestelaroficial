/**
 * API Middleware — JWT Auth + CORS + IP Rate Limiting + Origin check
 * Runs before every /api/* route
 */

// Browser origins allowed to call /api/* with credentials.
// Same-origin calls from luzestelaroficial.com don't really need CORS,
// but locking this down provides defense-in-depth against
// cross-origin abuse from malicious sites.
const ALLOWED_ORIGINS = [
  'https://luzestelaroficial.com',
  'https://www.luzestelaroficial.com',
];

const BASE_CORS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

function corsHeadersFor(request) {
  const origin = request.headers.get('Origin') || '';
  const headers = { ...BASE_CORS };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  // No Origin header (same-origin GET, server-to-server, email link click) →
  // omit ACAO entirely. The browser will treat it as same-origin and the
  // request still completes; only cross-origin readers are blocked.
  return headers;
}

// State-changing methods must come from a known origin (or no Origin at all,
// which means same-origin top-level navigation — e.g. clicking a magic link).
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isAllowedOrigin(request) {
  if (SAFE_METHODS.has(request.method)) return true;
  const origin = request.headers.get('Origin');
  if (origin) return ALLOWED_ORIGINS.includes(origin);
  // No Origin header on a POST/PUT/DELETE: fall back to Referer.
  const referer = request.headers.get('Referer') || '';
  if (referer) return ALLOWED_ORIGINS.some(o => referer.startsWith(o + '/'));
  // No Origin AND no Referer on a state-changing request → reject.
  return false;
}

// Per-IP rate limits — applied BEFORE the route handler.
// Uses AUTH_KV with keys `ratelimit:{ip}:{bucket}`.
// `max` requests per `window` seconds. Defense-in-depth on top of
// existing application-level limits (e.g. magic-link per-email cap).
const RATE_LIMITS = [
  { match: '/api/auth/magic-link',          max: 5,  window: 900 }, // 5 per 15 min
  { match: '/api/auth/google',              max: 10, window: 60  }, // 10 per min
  { match: '/api/auth/google-callback',     max: 10, window: 60  },
  { match: '/api/auth/magic-verify',        max: 20, window: 60  },
  { match: '/api/billing/create-subscription', max: 5,  window: 300 }, // 5 per 5 min
  { match: '/api/billing/portal',           max: 10, window: 300 },
  { match: '/api/profile/birth-profiles',   max: 30, window: 60  }, // 30 per min
  { match: '/api/account/export',           max: 5,  window: 3600 }, // 5/hour — heavy DB read
  { match: '/api/account/delete',           max: 3,  window: 3600 }, // 3/hour — irreversible
  { match: '/api/admin',                    max: 30, window: 60  }, // protect against token brute-force
  { match: '/api/status',                   max: 60, window: 60  }, // public status — generous, edge-cached anyway
];

function getRateLimit(pathname) {
  for (const rule of RATE_LIMITS) {
    if (pathname === rule.match || pathname.startsWith(rule.match + '/')) {
      return rule;
    }
  }
  return null;
}

function getClientIp(request) {
  // Cloudflare always sets cf-connecting-ip
  return request.headers.get('cf-connecting-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || 'unknown';
}

async function checkRateLimit(env, ip, rule) {
  if (!env.AUTH_KV || ip === 'unknown') return { ok: true };
  const key = `ratelimit:${ip}:${rule.match}`;
  let count = 0;
  try {
    const raw = await env.AUTH_KV.get(key);
    count = raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    // KV read failed — fail open so the API doesn't go down
    return { ok: true };
  }
  if (count >= rule.max) {
    return { ok: false, retryAfter: rule.window };
  }
  // Increment with TTL — first write of the window seeds the expiry
  try {
    await env.AUTH_KV.put(key, String(count + 1), { expirationTtl: rule.window });
  } catch {
    // Fail open
  }
  return { ok: true };
}

// Increment a per-day, per-path counter every time we serve a 429.
// 30-day TTL. Read by /api/admin/ratelimit-stats. Errors are swallowed —
// metrics must never break the API.
async function recordRateLimitHit(env, pathname, ip) {
  if (!env.AUTH_KV) return;
  const date = new Date().toISOString().slice(0, 10);
  const key = `ratelimit_metric:${date}:${pathname}`;
  try {
    const raw = await env.AUTH_KV.get(key);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    await env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 30 * 86400 });
  } catch {
    // Swallow — metrics are best-effort
  }
  // Also log to console so it shows up in `wrangler pages deployment tail`
  // for live observability.
  try {
    console.log(JSON.stringify({
      event: 'rate_limit_hit',
      path: pathname,
      ip,
      date,
    }));
  } catch {}
}

async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const data = encoder.encode(headerB64 + '.' + payloadB64);
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, data);
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const isStripeWebhook = url.pathname === '/api/billing/webhook';

  // Handle CORS preflight — only echo origin if allowed
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeadersFor(context.request) });
  }

  // Origin / Referer check on state-changing requests
  // (Stripe webhook bypassed — it's a server-to-server POST without a browser Origin)
  if (!isStripeWebhook && !isAllowedOrigin(context.request)) {
    const headers = new Headers(corsHeadersFor(context.request));
    headers.set('Content-Type', 'application/json');
    return new Response(
      JSON.stringify({ ok: false, error: 'Forbidden: invalid origin' }),
      { status: 403, headers },
    );
  }

  // Skip rate limiting for Stripe webhooks (Stripe must always reach us;
  // signature verification protects them).
  if (!isStripeWebhook) {
    const rule = getRateLimit(url.pathname);
    if (rule) {
      const ip = getClientIp(context.request);
      const result = await checkRateLimit(context.env, ip, rule);
      if (!result.ok) {
        await recordRateLimitHit(context.env, url.pathname, ip);
        const headers = new Headers(corsHeadersFor(context.request));
        headers.set('Content-Type', 'application/json');
        headers.set('Retry-After', String(result.retryAfter));
        return new Response(
          JSON.stringify({ ok: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers },
        );
      }
    }
  }

  // Extract JWT from cookie or Authorization header
  const cookies = context.request.headers.get('Cookie') || '';
  const authCookie = cookies.split(';').map(c => c.trim()).find(c => c.startsWith('le_token='));
  const token = authCookie ? authCookie.split('=')[1] : null;
  const authHeader = context.request.headers.get('Authorization');
  const bearerToken = authHeader ? authHeader.replace('Bearer ', '') : null;
  const jwt = token || bearerToken;

  // Try to verify (don't block — some routes are public)
  context.data = context.data || {};
  context.data.user = null;
  if (jwt && context.env.JWT_SECRET) {
    context.data.user = await verifyJWT(jwt, context.env.JWT_SECRET);
  }

  // Continue to route handler
  const response = await context.next();

  // Skip CORS for Stripe webhooks (they need raw body/headers intact)
  if (isStripeWebhook) {
    return response;
  }

  // Add CORS headers to response (origin echoed only if allowed)
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeadersFor(context.request)).forEach(([k, v]) => newHeaders.set(k, v));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
