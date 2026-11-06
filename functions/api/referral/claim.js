/**
 * POST /api/referral/claim  { ref: "<código de 8>" }
 * La cuenta nueva que llegó con el enlace de alguien lo registra (mi-dia lo manda solo cuando ya hay carta).
 * Respuesta: { ok, estado: registrado | ya | sin_carta | invalido | propio | vieja }
 */
import { reclamar } from '../../_shared/referidos.js';

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const { DB } = context.env;
  if (!DB) return Response.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  try {
    const r = await reclamar(DB, user.sub, body.ref);
    return Response.json({ ok: true, estado: r.estado });
  } catch (e) {
    console.error('[referral/claim]', e);
    return Response.json({ ok: false, error: 'No se pudo registrar' }, { status: 500 });
  }
}
