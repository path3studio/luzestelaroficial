/**
 * Mapa estelar incluido con Plus: uno por perfil (2026-11-06).
 *   GET  /api/mapa-estelar/perfil            → { ok, plus, mapas: { <profile_id>: { estado, urls } } }
 *   POST /api/mapa-estelar/perfil { profile_id } → pide el de ese perfil (Plus). Si ya existe, devuelve su estado.
 * Lo genera la Mac (scripts/mapas_plus.py). Mapas extra (regalos) siguen en /mapa-estelar.html.
 */
const sinTabla = (e) => /no such table: mapas_plus/i.test(String(e && e.message));
const leer = (f) => ({ estado: f.estado, urls: f.urls ? JSON.parse(f.urls) : null });

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  try {
    const r = await context.env.DB.prepare('SELECT profile_id, estado, urls FROM mapas_plus WHERE user_id = ?').bind(user.sub).all();
    const mapas = {};
    for (const f of r.results || []) mapas[f.profile_id] = leer(f);
    return Response.json({ ok: true, plus: user.tier === 'premium', mapas });
  } catch (e) {
    if (sinTabla(e)) return Response.json({ ok: true, plus: user.tier === 'premium', mapas: {}, disponible: false });
    return Response.json({ ok: false, error: 'No se pudo leer' }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (user.tier !== 'premium') return Response.json({ ok: false, error: 'plus_required' }, { status: 403 });
  let body = {}; try { body = await context.request.json(); } catch { body = {}; }
  const pid = String(body.profile_id || '');
  const { DB } = context.env;
  const perfil = await DB.prepare('SELECT id, fecha_nacimiento, lat, lon FROM birth_profiles WHERE id = ? AND user_id = ?').bind(pid, user.sub).first();
  if (!perfil) return Response.json({ ok: false, error: 'Perfil no encontrado' }, { status: 404 });
  if (!perfil.fecha_nacimiento || perfil.lat == null || perfil.lon == null) {
    return Response.json({ ok: false, error: 'Faltan datos de nacimiento (lugar) en este perfil' }, { status: 400 });
  }
  try {
    const f = await DB.prepare('SELECT estado, urls FROM mapas_plus WHERE profile_id = ?').bind(pid).first();
    if (f && f.estado !== 'error') return Response.json({ ok: true, ...leer(f) });
    await DB.prepare(
      `INSERT INTO mapas_plus (profile_id, user_id, estado, creado) VALUES (?, ?, 'pendiente', ?)
       ON CONFLICT(profile_id) DO UPDATE SET estado = 'pendiente', error = NULL, creado = excluded.creado`
    ).bind(pid, user.sub, new Date().toISOString()).run();
    return Response.json({ ok: true, estado: 'pendiente', urls: null });
  } catch (e) {
    if (sinTabla(e)) return Response.json({ ok: false, error: 'Aún no disponible' }, { status: 503 });
    console.error('[mapa-estelar/perfil]', e);
    return Response.json({ ok: false, error: 'No se pudo pedir' }, { status: 500 });
  }
}
