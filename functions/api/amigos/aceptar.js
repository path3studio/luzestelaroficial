/**
 * POST /api/amigos/aceptar { c } → { ok, estado: ok | propio | invalido, amigo }
 * Quien abrió el enlace y tocó «Aceptar y comparar» (su consentimiento explícito).
 */
import { aceptar } from '../../_shared/amigos.js';

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  let body = {}; try { body = await context.request.json(); } catch { body = {}; }
  try {
    const r = await aceptar(context.env.DB, user.sub, String(body.c || '').toLowerCase());
    return Response.json({ ok: r.estado === 'ok', ...r }, { status: r.estado === 'ok' ? 200 : 400 });
  } catch (e) {
    console.error('[amigos/aceptar]', e);
    return Response.json({ ok: false, error: 'No se pudo aceptar' }, { status: 500 });
  }
}
