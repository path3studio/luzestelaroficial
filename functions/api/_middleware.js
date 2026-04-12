/**
 * API Middleware — JWT Auth + CORS + Origin check
 * Runs before every /api/* route
 *
 * Rate limiting was removed 2026-04-12 to stay under free-tier KV limits.
 * See comment below for details and remaining protections.
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

// Rate limiting: REMOVED from KV (2026-04-12).
//
// Previous implementation used AUTH_KV.put() on EVERY request to
// rate-limited endpoints. With ~3,400 API requests/day, this consumed
// the entire free-tier KV put budget (1,000/day) and caused 429 errors
// on all KV writes across the project (including the publisher, uptime
// monitor, and backup workers).
//
// Existing protections that remain:
//  - magic-link: per-email rate limit in handler (magic_rate:{email} KV key)
//  - admin endpoints: CF Access gate + Bearer ADMIN_TOKEN
//  - billing: behind JWT auth
//  - Stripe webhook: signature verification
//  - CORS origin check on all state-changing requests (below)
//  - Cloudflare's built-in bot management + DDoS protection at the edge
//
// If granular rate limiting is needed again, use Cloudflare WAF Rate
// Limiting Rules (1 free rule available) at the edge level, which
// requires zero KV writes.

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
