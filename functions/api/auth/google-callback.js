/**
 * GET /api/auth/google-callback — Handle Google OAuth2 callback
 */

async function createJWT(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(header + '.' + body));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return header + '.' + body + '.' + sigB64;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, DB, AUTH_KV } = context.env;

  // Verify CSRF state
  const storedLang = await AUTH_KV.get('oauth_state:' + state);
  if (!storedLang) {
    return new Response('Invalid or expired state', { status: 400 });
  }
  await AUTH_KV.delete('oauth_state:' + state);
  const lang = storedLang || 'es';

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: url.origin + '/api/auth/google-callback',
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return new Response('Failed to exchange token', { status: 400 });
  }

  const tokens = await tokenRes.json();

  // Decode ID token (JWT) to get user info
  const idTokenPayload = JSON.parse(atob(tokens.id_token.split('.')[1]));
  const { email, name, picture, sub: googleId } = idTokenPayload;

  // Upsert user in D1
  const now = new Date().toISOString();
  let user = await DB.prepare('SELECT id, tier FROM users WHERE google_id = ? OR email = ?')
    .bind(googleId, email).first();

  if (!user) {
    const userId = crypto.randomUUID();
    await DB.prepare(
      'INSERT INTO users (id, email, name, picture_url, auth_provider, google_id, tier, lang, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, email, name, picture, 'google', googleId, 'free', lang, now, now).run();
    user = { id: userId, tier: 'free' };
  } else {
    await DB.prepare(
      'UPDATE users SET name = ?, picture_url = ?, google_id = ?, updated_at = ? WHERE id = ?'
    ).bind(name, picture, googleId, now, user.id).run();
  }

  // Create JWT
  const jwt = await createJWT({
    sub: user.id,
    email,
    name,
    tier: user.tier,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600, // 30 days
  }, JWT_SECRET);

  // Set cookie and redirect to dashboard
  const dashboardPath = lang === 'en' ? '/en/dashboard.html' : '/dashboard.html';
  return new Response(null, {
    status: 302,
    headers: {
      'Location': dashboardPath,
      'Set-Cookie': `le_token=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
    },
  });
}
