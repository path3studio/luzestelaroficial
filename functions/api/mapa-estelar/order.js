/**
 * POST /api/mapa-estelar/order
 * Audit log for Mapa Estelar checkout attempts.
 *
 * Called client-side right before redirecting to Stripe Checkout. Writes a
 * `pending` row to D1 so we have an independent record of the order — even
 * if the buyer abandons the payment screen. The consulta-api worker later
 * reconciles paid rows from Stripe webhooks.
 *
 * Public endpoint (no auth): gifts can be bought without an account.
 * Protection:
 *   - Validates required fields and length caps
 *   - Hashes client IP with a salt (no raw IP is stored)
 *   - `mapa_orders` is append-only; reconciliation updates `status`/`paid_at`
 *     via a separate admin path, not this handler.
 *
 * Body (all strings unless noted):
 *   titulo, fecha (ISO), hora?, lugar, email, lang ('es'|'en')
 *   formatos: string[] (required, at least one)
 *   customSize?: "WxH" string, notas?
 *   isGift: boolean, regaloNombre?, regaloFechaEntrega?, regaloMensaje?
 *
 * Returns: { ok: true, id }
 */

function str(v, max) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max || 500);
}

async function sha256Hex(input) {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function onRequestPost(context) {
  const { DB, IP_HASH_SALT } = context.env;
  if (!DB) {
    return Response.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let body;
  try { body = await context.request.json(); }
  catch { body = {}; }

  const titulo = str(body.titulo, 300);
  const fecha = str(body.fecha, 20);
  const lugar = str(body.lugar, 300);
  const email = str(body.email, 200);
  if (!titulo || !fecha || !lugar || !email) {
    return Response.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, error: 'Invalid email' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return Response.json({ ok: false, error: 'Invalid date' }, { status: 400 });
  }

  const formatos = Array.isArray(body.formatos)
    ? body.formatos.filter((x) => typeof x === 'string' && x.length < 40).slice(0, 10)
    : [];
  if (!formatos.length) {
    return Response.json({ ok: false, error: 'At least one format required' }, { status: 400 });
  }

  const hora = str(body.hora, 10);
  const customSize = str(body.customSize, 30);
  const notas = str(body.notas, 500);
  const lang = body.lang === 'en' ? 'en' : 'es';

  const isGift = body.isGift ? 1 : 0;
  const regaloNombre = isGift ? str(body.regaloNombre, 200) : null;
  const regaloFecha = isGift && /^\d{4}-\d{2}-\d{2}$/.test(body.regaloFechaEntrega || '')
    ? body.regaloFechaEntrega
    : null;
  const regaloMensaje = isGift ? str(body.regaloMensaje, 500) : null;

  // Hash IP with a salt (defense against re-identification)
  const ip = context.request.headers.get('CF-Connecting-IP')
          || context.request.headers.get('X-Forwarded-For')
          || '';
  let ipHash = null;
  if (ip) {
    const salt = IP_HASH_SALT || 'luzestelar-default-salt';
    ipHash = await sha256Hex(ip + '::' + salt);
  }
  const ua = (context.request.headers.get('User-Agent') || '').slice(0, 300);
  const ref = (context.request.headers.get('Referer') || '').slice(0, 300);

  try {
    const res = await DB.prepare(
      `INSERT INTO mapa_orders
        (lang, titulo, fecha, hora, lugar, email,
         formatos, custom_size, notas,
         is_gift, regalo_nombre, regalo_fecha_entrega, regalo_mensaje,
         ip_hash, user_agent, referer, status)
       VALUES (?, ?, ?, ?, ?, ?,
               ?, ?, ?,
               ?, ?, ?, ?,
               ?, ?, ?, 'pending')`
    ).bind(
      lang, titulo, fecha, hora, lugar, email,
      JSON.stringify(formatos), customSize, notas,
      isGift, regaloNombre, regaloFecha, regaloMensaje,
      ipHash, ua, ref
    ).run();

    const id = res && res.meta ? res.meta.last_row_id : null;
    return Response.json({ ok: true, id });
  } catch (e) {
    console.error('[mapa-estelar/order] insert failed', e);
    return Response.json({ ok: false, error: 'Could not save order' }, { status: 500 });
  }
}
