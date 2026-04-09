/**
 * GET /api/auth/magic-verify?token=xxx — Verify magic link and create session
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
  const token = url.searchParams.get('token');
  const { JWT_SECRET, DB, AUTH_KV } = context.env;

  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  // Retrieve and consume token (one-time use)
  const tokenKey = `magic_token:${token}`;
  const tokenDataStr = await AUTH_KV.get(tokenKey);

  if (!tokenDataStr) {
    return new Response(errorPage('es', 'El enlace ha expirado o ya fue utilizado.', 'The link has expired or has already been used.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  }

  // Delete token immediately (prevent reuse)
  await AUTH_KV.delete(tokenKey);

  const tokenData = JSON.parse(tokenDataStr);
  const { email, lang } = tokenData;

  // Check expiry (15 min)
  if (Date.now() - tokenData.createdAt > 15 * 60 * 1000) {
    return new Response(errorPage(lang, 'El enlace ha expirado.', 'The link has expired.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  }

  // Upsert user in D1
  const now = new Date().toISOString();
  let user = await DB.prepare('SELECT id, tier, name FROM users WHERE email = ?')
    .bind(email).first();

  if (!user) {
    const userId = crypto.randomUUID();
    const displayName = email.split('@')[0];
    await DB.prepare(
      'INSERT INTO users (id, email, name, auth_provider, tier, lang, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, email, displayName, 'email', 'free', lang || 'es', now, now).run();
    user = { id: userId, tier: 'free', name: displayName };
  } else {
    await DB.prepare('UPDATE users SET updated_at = ? WHERE id = ?')
      .bind(now, user.id).run();
  }

  // Create JWT
  const jwt = await createJWT({
    sub: user.id,
    email,
    name: user.name,
    tier: user.tier,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
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

function errorPage(lang, msgEs, msgEn) {
  const msg = lang === 'en' ? msgEn : msgEs;
  const btnText = lang === 'en' ? 'Try Again' : 'Intentar de nuevo';
  const loginUrl = lang === 'en' ? '/en/login.html' : '/login.html';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Luz Estelar</title></head>
<body style="font-family:sans-serif;background:#06061a;color:#e0dce8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
<div style="text-align:center;max-width:400px;padding:40px;">
<h1 style="color:#d4a849;font-family:Georgia,serif;">Luz Estelar</h1>
<p style="margin:20px 0;color:#9890a8;">${msg}</p>
<a href="${loginUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#d4a849,#c89030);color:#1a1625;border-radius:10px;text-decoration:none;font-weight:700;">${btnText}</a>
</div></body></html>`;
}
