/**
 * POST /api/auth/magic-link — Send a magic login link via email
 *
 * Body: { email, lang? }
 * Uses Resend API (RESEND_API_KEY) + AUTH_KV for token storage
 */
export async function onRequestPost(context) {
  const { RESEND_API_KEY, AUTH_KV } = context.env;
  const body = await context.request.json();
  const { email, lang, newsletter, redirect } = body;

  if (!email || !email.includes('@')) {
    return Response.json({ ok: false, error: 'Invalid email' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const language = lang || 'es';

  // Rate limit: max 3 magic links per email per 15 minutes
  const rateLimitKey = `magic_rate:${normalizedEmail}`;
  const rateCount = parseInt(await AUTH_KV.get(rateLimitKey) || '0');
  if (rateCount >= 3) {
    return Response.json({
      ok: false,
      error: language === 'en'
        ? 'Too many requests. Please wait a few minutes.'
        : 'Demasiados intentos. Espera unos minutos.'
    }, { status: 429 });
  }

  // Generate token
  const token = crypto.randomUUID() + '-' + crypto.randomUUID();
  const tokenKey = `magic_token:${token}`;

  // Store token (15 min expiry)
  await AUTH_KV.put(tokenKey, JSON.stringify({
    email: normalizedEmail,
    lang: language,
    newsletter: !!newsletter,
    redirect: redirect || null,
    createdAt: Date.now()
  }), { expirationTtl: 900 });

  // Increment rate limit
  await AUTH_KV.put(rateLimitKey, String(rateCount + 1), { expirationTtl: 900 });

  // Build magic link URL
  const origin = new URL(context.request.url).origin;
  const verifyUrl = `${origin}/api/auth/magic-verify?token=${token}`;

  // Send email via Resend
  const emailSubject = language === 'en'
    ? 'Your Luz Estelar Sign-In Link'
    : 'Tu enlace de inicio de sesion — Luz Estelar';

  const emailBody = language === 'en'
    ? `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#06061a;color:#e0dce8;padding:40px;text-align:center;">
        <div style="max-width:400px;margin:0 auto;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px;">
          <h1 style="color:#d4a849;font-family:Georgia,serif;font-size:1.8em;">Luz Estelar</h1>
          <p style="margin:20px 0;color:#9890a8;">Click the button below to sign in to your account.</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#d4a849,#c89030);color:#1a1625;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.95em;">Sign In</a>
          <p style="margin-top:24px;font-size:0.78em;color:#9890a8;">This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      </body></html>`
    : `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#06061a;color:#e0dce8;padding:40px;text-align:center;">
        <div style="max-width:400px;margin:0 auto;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px;">
          <h1 style="color:#d4a849;font-family:Georgia,serif;font-size:1.8em;">Luz Estelar</h1>
          <p style="margin:20px 0;color:#9890a8;">Haz clic en el boton para iniciar sesion en tu cuenta.</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#d4a849,#c89030);color:#1a1625;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.95em;">Iniciar Sesion</a>
          <p style="margin-top:24px;font-size:0.78em;color:#9890a8;">Este enlace caduca en 15 minutos. Si no solicitaste esto, puedes ignorar este correo.</p>
        </div>
      </body></html>`;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Luz Estelar <noreply@luzestelaroficial.com>',
        to: [normalizedEmail],
        subject: emailSubject,
        html: emailBody,
      }),
    });

    if (!resendRes.ok) {
      const errData = await resendRes.json().catch(() => ({}));
      console.error('Resend error:', errData);
      return Response.json({
        ok: false,
        error: language === 'en'
          ? 'Failed to send email. Please try again.'
          : 'Error al enviar el correo. Intenta de nuevo.'
      }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Magic link error:', err);
    return Response.json({
      ok: false,
      error: language === 'en'
        ? 'Service temporarily unavailable.'
        : 'Servicio temporalmente no disponible.'
    }, { status: 500 });
  }
}
