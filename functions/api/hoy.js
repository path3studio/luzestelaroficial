/**
 * GET /api/hoy — el horóscopo del día de los 12 signos, PÚBLICO.
 *
 * Por qué (5/ago/2026): el texto diario ya estaba pagado y generado en KV,
 * pero solo lo veían los usuarios logueados (vía dashboard API). El botón
 * "Tu horóscopo de hoy" de /links mandaba a YouTube por no existir esta
 * página. Ahora el tráfico de links y Google puede LEER en el sitio — y
 * desde ahí, descubrir el perfil cósmico.
 *
 * Sin auth a propósito: es el mismo contenido gratuito del video diario.
 * Cache público de 10 min — el contenido cambia una vez al día.
 */

const SIGNS_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
                  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn',
                  'Aquarius', 'Pisces'];

export async function onRequestGet(context) {
  const { AUTH_KV } = context.env;
  if (!AUTH_KV) {
    return Response.json({ ok: false, error: 'kv_unavailable' }, { status: 503 });
  }
  const url = new URL(context.request.url);
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es';

  // Hoy en horario de México (el pipeline publica con fecha CDMX)
  const now = new Date(Date.now() - 6 * 3600 * 1000);
  const dateKey = now.toISOString().slice(0, 10);

  const reads = await Promise.all(
    SIGNS_EN.map(s => AUTH_KV.get(`daily_${s}_${dateKey}_${lang}`))
  );

  const signs = [];
  for (const raw of reads) {
    if (!raw) continue;
    try {
      const d = JSON.parse(raw);
      signs.push({
        sign: d.sign_es || d.sign,
        symbol: d.symbol || '',
        element: d.element || '',
        text: d.text || '',
        bio: d.biorhythm || null,
      });
    } catch { /* una clave corrupta no tumba el resto */ }
  }

  // Ayer como respaldo si el pipeline de hoy aún no termina (madrugada)
  if (!signs.length) {
    const ayer = new Date(now.getTime() - 24 * 3600 * 1000)
      .toISOString().slice(0, 10);
    const prev = await Promise.all(
      SIGNS_EN.map(s => AUTH_KV.get(`daily_${s}_${ayer}_${lang}`))
    );
    for (const raw of prev) {
      if (!raw) continue;
      try {
        const d = JSON.parse(raw);
        signs.push({ sign: d.sign_es || d.sign, symbol: d.symbol || '',
                     element: d.element || '', text: d.text || '',
                     bio: d.biorhythm || null });
      } catch { /* ídem */ }
    }
    if (signs.length) {
      return Response.json({ ok: true, date: ayer, stale: true, signs },
        { headers: { 'cache-control': 'public, max-age=300' } });
    }
  }

  return Response.json({ ok: true, date: dateKey, signs },
    { headers: { 'cache-control': 'public, max-age=600' } });
}
