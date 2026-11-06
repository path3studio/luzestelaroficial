/**
 * /api/amigos  (2026-11-06, compatibilidad con amigos — solo por invitación)
 *   GET    → { ok, amigos: [{ id, nombre, sol, chino, numero, maya, celta, desde }], plus, gratisUsado }
 *   DELETE { amigo_id } → quita la amistad en los dos sentidos
 */
import { lista, quitar } from '../../_shared/amigos.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const { DB } = context.env;
  try {
    const amigos = await lista(DB, user.sub);
    return Response.json({ ok: true, amigos, plus: user.tier === 'premium' });
  } catch (e) {
    if (/no such table/i.test(String(e && e.message))) return Response.json({ ok: true, amigos: [], plus: user.tier === 'premium' });
    console.error('[amigos]', e);
    return Response.json({ ok: false, error: 'No se pudo leer' }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  let body = {}; try { body = await context.request.json(); } catch { body = {}; }
  if (!body.amigo_id || typeof body.amigo_id !== 'string') return Response.json({ ok: false, error: 'Falta amigo_id' }, { status: 400 });
  await quitar(context.env.DB, user.sub, body.amigo_id);
  return Response.json({ ok: true });
}
