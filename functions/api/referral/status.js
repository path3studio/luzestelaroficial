/**
 * GET /api/referral/status → { ok, codigo, enlace, amigos, meses, max, plusHasta }
 * Para la tarjeta «Comparte Luz Estelar» de Ajustes.
 */
import { estado } from '../../_shared/referidos.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const { DB } = context.env;
  if (!DB) return Response.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  return Response.json({ ok: true, ...(await estado(DB, user.sub)) });
}
