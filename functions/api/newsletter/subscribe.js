/**
 * Luz Estelar — Newsletter Subscribe Proxy
 *
 * Same-origin endpoint that forwards to the newsletter Worker
 * (luzestelar-consulta-api.path3studio.workers.dev/subscribe).
 *
 * Why this exists: mi-dia.html / en/my-day.html ship with a strict
 * inline CSP (`connect-src 'self'`). A direct browser → Worker POST
 * is silently blocked. This proxy keeps the request same-origin so
 * the subscription flow works inside the PWA shell.
 */

const UPSTREAM = 'https://luzestelar-consulta-api.path3studio.workers.dev/subscribe';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const email = (body && body.email ? String(body.email) : '').trim();
    const lang = body && body.lang === 'en' ? 'en' : 'es';
    const source = (body && body.source ? String(body.source) : 'app').slice(0, 40);

    if (!email || email.length < 4 || !email.includes('@')) {
      return Response.json(
        { ok: false, error: lang === 'en' ? 'Invalid email.' : 'Correo inválido.' },
        { status: 400 }
      );
    }

    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email, lang, source }),
    });

    // Pass through the Worker's JSON verbatim so error/success shapes
    // stay consistent with planes.html behaviour.
    const data = await upstream.json().catch(() => ({}));
    return Response.json(data, { status: upstream.status });
  } catch (err) {
    return Response.json(
      { ok: false, error: 'Proxy error. Try again.' },
      { status: 502 }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
