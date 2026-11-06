/**
 * POST /api/profile/avatar { profile_id, avatar }   (2026-11-06)
 * avatar: 'criatura' | 'neutro' | 'data:image/(jpeg|webp|png);base64,…' (foto ya reducida en el teléfono, ≤ 60 KB)
 */
const MAX = 60 * 1024;
export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  let body = {}; try { body = await context.request.json(); } catch { body = {}; }
  const pid = String(body.profile_id || '');
  const av = String(body.avatar || '');
  const valido = av === 'criatura' || av === 'neutro' ||
    (/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(av) && av.length <= MAX);
  if (!pid || !valido) return Response.json({ ok: false, error: 'Imagen no válida (máx. 60 KB)' }, { status: 400 });
  try {
    const r = await context.env.DB.prepare('UPDATE birth_profiles SET avatar = ? WHERE id = ? AND user_id = ?')
      .bind(av, pid, user.sub).run();
    if (!(r.meta && r.meta.changes)) return Response.json({ ok: false, error: 'Perfil no encontrado' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    if (/no such column: avatar/i.test(String(e && e.message))) return Response.json({ ok: false, error: 'Aún no disponible' }, { status: 503 });
    console.error('[profile/avatar]', e);
    return Response.json({ ok: false, error: 'No se pudo guardar' }, { status: 500 });
  }
}
