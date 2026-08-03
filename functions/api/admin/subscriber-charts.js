/**
 * GET /api/admin/subscriber-charts — casas natales por email, para el
 * newsletter personalizado.
 *
 * Por qué existe (2026-08-03): el newsletter dominical manda EL MISMO texto a
 * todos. 71 personas nos dieron fecha, hora y lugar de nacimiento y nunca
 * volvimos a usar ese dato para hablarles a ellas. Con sus casas, el mismo
 * correo puede cerrar con un bloque que es solo suyo ("esta semana el cielo
 * toca tu casa 6, la de tu salud"). Un correo, no dos — el usuario fue
 * explícito en no querer sumar otro envío.
 *
 * PRIVACIDAD — se devuelve el MÍNIMO necesario:
 *   · email (la clave para casar con el suscriptor)
 *   · las 12 cúspides (grado + signo)
 *   · nombre y longitud de sus planetas
 * NO se devuelve fecha, hora ni lugar de nacimiento, ni nombre de la persona.
 * Solo perfiles PRIMARIOS y solo con carta ya calculada.
 *
 * Auth: Bearer ADMIN_TOKEN o cabecera X-Admin-Key (la que ya usa el
 * newsletter para pedir la lista de suscriptores).
 */

export async function onRequestGet(context) {
  const { ADMIN_TOKEN, ADMIN_KEY, DB } = context.env;
  const esperado = ADMIN_TOKEN || ADMIN_KEY;

  if (!esperado) {
    return Response.json({ ok: false, error: 'Admin endpoint not configured' },
                         { status: 503 });
  }
  const auth = context.request.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const viaKey = context.request.headers.get('X-Admin-Key') || '';
  if (bearer !== esperado && viaKey !== esperado) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  if (!DB) {
    return Response.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  let rows;
  try {
    const q = await DB.prepare(
      `SELECT u.email AS email, b.natal_chart AS chart
         FROM users u
         JOIN birth_profiles b ON b.user_id = u.id
        WHERE b.is_primary = 1
          AND b.natal_chart IS NOT NULL
          AND u.email IS NOT NULL`
    ).all();
    rows = q.results || [];
  } catch (e) {
    return Response.json({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  const salida = {};
  for (const r of rows) {
    try {
      const c = typeof r.chart === 'string' ? JSON.parse(r.chart) : r.chart;
      if (!c) continue;

      // Cartas antiguas: se guardaron con `ascendant` pero sin `houses`.
      // Como el sitio usa casas IGUALES desde el Ascendente, las 12 cúspides
      // se reconstruyen exactamente — no es una aproximación. Sin esto, esas
      // personas quedarían fuera del cierre personal por un cambio de formato
      // nuestro, no por falta de datos suyos.
      let casas = c.houses;
      if (!Array.isArray(casas) || casas.length !== 12) {
        const asc = c.ascendant && typeof c.ascendant.longitude === 'number'
          ? c.ascendant.longitude : null;
        if (asc === null) continue;
        const SIGNOS = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo',
                        'Libra', 'Escorpio', 'Sagitario', 'Capricornio',
                        'Acuario', 'Piscis'];
        casas = Array.from({ length: 12 }, (_, i) => {
          const lon = (asc + i * 30) % 360;
          return { house: i + 1, sign: SIGNOS[Math.floor(lon / 30)],
                   cusp_degree: lon };
        });
      }

      salida[String(r.email).toLowerCase()] = {
        houses: casas.map(h => ({ h: h.house, sign: h.sign, cusp: h.cusp_degree })),
        planets: (c.planets || []).map(p => ({
          name: p.name_es || p.name, lon: p.longitude,
        })),
      };
    } catch { /* una carta corrupta no debe tumbar el resto */ }
  }

  return Response.json({
    ok: true,
    count: Object.keys(salida).length,
    charts: salida,
    generated_at: new Date().toISOString(),
  });
}
