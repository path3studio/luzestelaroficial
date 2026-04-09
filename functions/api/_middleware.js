/**
 * API Middleware — JWT Auth + CORS
 * Runs before every /api/* route
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

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
  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
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
  const url = new URL(context.request.url);
  if (url.pathname === '/api/billing/webhook') {
    return response;
  }

  // Add CORS headers to response
  const newHeaders = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
