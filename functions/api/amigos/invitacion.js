/**
 * GET /api/amigos/invitacion?c=<código> (público) → { ok, nombre, sol, chino, numero, maya, celta, ref }
 * Solo lo que quien compartió aceptó mostrar: primer nombre y signos. Nunca fecha, hora ni lugar.
 */
import { invitacion } from '../../_shared/amigos.js';

export async function onRequestGet(context) {
  const c = new URL(context.request.url).searchParams.get('c') || '';
  try {
    const inv = await invitacion(context.env.DB, c.toLowerCase());
    if (!inv) return Response.json({ ok: false, error: 'Invitación no válida' }, { status: 404 });
    return Response.json({ ok: true, ...inv }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ ok: false, error: 'Invitación no válida' }, { status: 404 });
  }
}
