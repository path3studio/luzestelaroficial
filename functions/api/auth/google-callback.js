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
    // Show a friendly error page instead of raw text
    const errorHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sesi\u00f3n expirada \u2014 Luz Estelar</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #0a0a12; color: #e8e0d0; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
    .card { background: rgba(255,255,255,.04); border: 1px solid rgba(212,168,73,.2);
            border-radius: 16px; padding: 40px 32px; max-width: 400px; }
    h1 { font-size: 1.3em; margin: 16px 0 8px; color: #d4a849; }
    p { font-size: 0.95em; color: #a09880; line-height: 1.5; margin: 0 0 24px; }
    a { display: inline-block; background: #d4a849; color: #0a0a12; font-weight: 600;
        padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 0.95em; }
    a:hover { background: #e0b85a; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:2.5em">\u23F3</div>
    <h1>Sesi\u00f3n de login expirada</h1>
    <p>El enlace de autenticaci\u00f3n con Google expir\u00f3 o ya fue utilizado. Esto pasa si tardaste m\u00e1s de 15 minutos en completar el login o si refrescaste la p\u00e1gina.</p>
    <a href="/login.html">Intentar de nuevo</a>
  </div>
</body>
</html>`;
    return new Response(errorHtml, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
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
    const failHtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error de autenticaci\u00f3n \u2014 Luz Estelar</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #0a0a12; color: #e8e0d0; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
    .card { background: rgba(255,255,255,.04); border: 1px solid rgba(212,168,73,.2);
            border-radius: 16px; padding: 40px 32px; max-width: 400px; }
    h1 { font-size: 1.3em; margin: 16px 0 8px; color: #d4a849; }
    p { font-size: 0.95em; color: #a09880; line-height: 1.5; margin: 0 0 24px; }
    a { display: inline-block; background: #d4a849; color: #0a0a12; font-weight: 600;
        padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 0.95em; }
    a:hover { background: #e0b85a; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:2.5em">\u26A0\uFE0F</div>
    <h1>${lang === 'en' ? 'Authentication error' : 'Error de autenticaci\u00f3n'}</h1>
    <p>${lang === 'en' ? 'Something went wrong communicating with Google. Please try again.' : 'Hubo un problema al comunicarse con Google. Por favor int\u00e9ntalo de nuevo.'}</p>
    <a href="/${lang === 'en' ? 'en/' : ''}login.html">${lang === 'en' ? 'Try again' : 'Intentar de nuevo'}</a>
  </div>
</body>
</html>`;
    return new Response(failHtml, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
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
