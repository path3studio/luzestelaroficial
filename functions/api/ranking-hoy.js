/**
 * GET /api/ranking-hoy → { ok, fecha, url }   (2026-11-06)
 * La misma imagen del ranking de los 12 signos que va a la historia exclusiva de suscriptores
 * (scripts/story_suscriptores.py la sube a R2 a las 07:30 y deja la URL en AUTH_KV «ranking_hoy»).
 * Es parte de Plus (Semillas incluye Plus): gratis → { ok:false, plus:true }.
 */
export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (user.tier !== 'premium') return Response.json({ ok: false, plus: true });
  try {
    const raw = await context.env.AUTH_KV.get('ranking_hoy');
    const d = raw ? JSON.parse(raw) : null;
    if (!d || !d.url) return Response.json({ ok: false, error: 'Todavía no está el ranking de hoy (sale a las 7:30).' });
    return Response.json({ ok: true, fecha: d.fecha, url: d.url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ ok: false, error: 'No se pudo leer el ranking' }, { status: 500 });
  }
}
