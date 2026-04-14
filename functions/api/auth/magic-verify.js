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
  const { JWT_SECRET, DB, AUTH_KV, SUBSCRIBERS } = context.env;

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
  const { email, lang, newsletter } = tokenData;

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

  let isNewUser = false;
  if (!user) {
    isNewUser = true;
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

  // Subscribe to newsletter if opted in during login
  if (newsletter && SUBSCRIBERS && email) {
    try {
      const existing = await SUBSCRIBERS.get(email);
      if (!existing) {
        await SUBSCRIBERS.put(email, JSON.stringify({
          email,
          name: user.name || '',
          lang: lang || 'es',
          source: 'magic_link',
          subscribed_at: now,
          status: 'active',
        }));
      }
    } catch (e) {
      // Non-blocking — don't fail login if newsletter write fails
      console.error('Newsletter subscribe error:', e);
    }
  }

  // Notify new registration via Telegram
  if (isNewUser) {
    notifyRegistration(context.env, email, 'email').catch(() => {});
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

  // Set cookie and redirect (honor le_redirect cookie if present)
  const defaultPath = lang === 'en' ? '/en/dashboard.html' : '/dashboard.html';
  const cookies = context.request.headers.get('cookie') || '';
  const rdMatch = cookies.match(/le_redirect=([^;]+)/);
  let redirectPath = defaultPath;
  if (rdMatch) {
    const p = decodeURIComponent(rdMatch[1].trim());
    if (p.startsWith('/') && !p.includes('//') && !p.includes('..')) redirectPath = p;
  }
  const headers = new Headers();
  headers.append('Set-Cookie', `le_token=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);
  headers.append('Set-Cookie', 'le_redirect=; Path=/; Max-Age=0');
  headers.set('Location', redirectPath);
  return new Response(null, { status: 302, headers });
}

async function notifyRegistration(env, email, method) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const escapedEmail = (email || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const methodIcon = method === 'google' ? '🔵' : '📧';
  const timeStr = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  const text = [
    `🆕 <b>¡Nuevo registro!</b>`,
    `${methodIcon} ${escapedEmail}`,
    `<i>Método: ${method} — ${timeStr}</i>`,
  ].join('\n');

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
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
