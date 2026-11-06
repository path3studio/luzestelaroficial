/**
 * POST /api/amigos/codigo → { ok, codigo, enlace }   — al tocar «Compartir mi perfil» (consentimiento de quien comparte)
 */
import { miCodigo, ENLACE_AMIGO } from '../../_shared/amigos.js';

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  try {
    const c = await miCodigo(context.env.DB, user.sub);
    return Response.json({ ok: true, codigo: c, enlace: ENLACE_AMIGO + c });
  } catch (e) {
    console.error('[amigos/codigo]', e);
    return Response.json({ ok: false, error: 'No se pudo crear tu enlace' }, { status: 500 });
  }
}
