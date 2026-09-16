/**
 * tz.js — huso horario aproximado desde lat/lon cuando el perfil no trae
 * timezone (2026-09-16, caso Jorge/Rosario: la regla round(lon/15) daba -4 a
 * Argentina (-3) y -7 a Ciudad de México (-6): 1 h de error = ~15° de
 * Ascendente = signo cambiado en 7 de los 10 perfiles sin timezone).
 * Husos POLÍTICOS por cajas geográficas de nuestros países. No contempla
 * horario de verano histórico (error ≤1 h en fechas de verano de países con DST).
 */
export function tzFromLatLon(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  const inBox = (la1, la2, lo1, lo2) => lat >= la1 && lat <= la2 && lon >= lo1 && lon <= lo2;
  // México
  if (inBox(14, 33, -118.5, -86)) {
    if (lon < -114 && lat > 28) return -8;          // Baja California
    if (lon < -105.5 && lat > 22.5) return -7;      // Sonora, Sinaloa, Chihuahua, BCS, Nayarit norte
    if (lon > -89.5 && lat > 17.5) return -5;       // Quintana Roo
    return -6;
  }
  if (inBox(7, 18.5, -92.5, -77)) return lon > -80 ? -5 : -6;   // Centroamérica (Panamá -5)
  if (inBox(19, 24, -85, -74)) return -5;           // Cuba
  if (inBox(17.5, 20, -74, -68)) return -4;         // Rep. Dominicana / Haití(-5, aprox)
  if (inBox(17.5, 18.6, -67.5, -65.2)) return -4;   // Puerto Rico
  if (inBox(-4.5, 13, -79.5, -66.5)) return -5;     // Colombia, Ecuador (continental), Venezuela oeste → Venezuela abajo
  if (inBox(0, 13, -73.5, -59.5)) return -4;        // Venezuela
  if (inBox(-18.5, 0, -81.5, -68.5)) return -5;     // Perú
  if (inBox(-23, -9.5, -69.7, -57.5)) return -4;    // Bolivia
  if (inBox(-27.7, -19, -62.7, -54.2)) return -4;   // Paraguay
  if (inBox(-56, -17.5, -76, -66.4)) return -4;     // Chile continental
  if (inBox(-55.5, -21.7, -73.6, -53) ) return -3;  // Argentina
  if (inBox(-35.1, -30, -58.5, -53) ) return -3;    // Uruguay
  if (inBox(-34, 5.5, -74, -34.7)) return -3;       // Brasil (mayoría; oeste -4 aprox)
  if (inBox(24.5, 49.5, -125, -66.5)) {             // EE. UU. continental
    if (lon < -114) return -8; if (lon < -102) return -7; if (lon < -87) return -6; return -5;
  }
  if (inBox(35.9, 43.9, -9.6, 4.4)) return 1;       // España peninsular
  if (inBox(27.5, 29.5, -18.5, -13.3)) return 0;    // Canarias
  return Math.max(-12, Math.min(14, Math.round(lon / 15)));
}

// ── Zona IANA por lat/lon + desfase HISTÓRICO real (con horario de verano) ──
// 2026-09-16, caso Jorge (Rosario, 22/12/1988 08:50): Argentina estaba en
// horario de verano (UTC-2). Con -3 fijo el Ascendente salía Acuario 8°; el
// real es Capricornio 25°. El runtime (Workers/Node) trae la base de datos de
// husos (ICU): Intl resuelve el desfase de cualquier fecha del siglo XX.
export function ianaFromLatLon(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  const inBox = (la1, la2, lo1, lo2) => lat >= la1 && lat <= la2 && lon >= lo1 && lon <= lo2;
  if (inBox(14, 33, -118.5, -86)) {
    if (lon < -114 && lat > 28) return 'America/Tijuana';
    if (lon < -108.5 && lat > 26) return 'America/Hermosillo';
    if (lon < -105.5 && lat > 22.5) return 'America/Mazatlan';
    if (lon > -89.5 && lat > 17.5) return 'America/Cancun';
    return 'America/Mexico_City';
  }
  if (inBox(7, 18.5, -92.5, -77)) return lon > -80 ? 'America/Panama' : 'America/Guatemala';
  if (inBox(19, 24, -85, -74)) return 'America/Havana';
  if (inBox(17.5, 20, -74, -68)) return 'America/Santo_Domingo';
  if (inBox(17.5, 18.6, -67.5, -65.2)) return 'America/Puerto_Rico';
  if (inBox(0, 13, -73.5, -59.5)) return 'America/Caracas';
  if (inBox(-4.5, 13, -79.5, -66.5)) return lon > -76 && lat > -1 && lat < 4 ? 'America/Bogota' : 'America/Bogota';
  if (inBox(-18.5, 0, -81.5, -68.5)) return 'America/Lima';
  if (inBox(-23, -9.5, -69.7, -57.5)) return 'America/La_Paz';
  if (inBox(-27.7, -19, -62.7, -54.2)) return 'America/Asuncion';
  if (inBox(-56, -17.5, -76, -66.4)) return 'America/Santiago';
  if (inBox(-55.5, -21.7, -73.6, -53)) return 'America/Argentina/Buenos_Aires';
  if (inBox(-35.1, -30, -58.5, -53)) return 'America/Montevideo';
  if (inBox(-34, 5.5, -74, -34.7)) return 'America/Sao_Paulo';
  if (inBox(24.5, 49.5, -125, -66.5)) {
    if (lon < -114) return 'America/Los_Angeles'; if (lon < -102) return 'America/Denver';
    if (lon < -87) return 'America/Chicago'; return 'America/New_York';
  }
  if (inBox(35.9, 43.9, -9.6, 4.4)) return 'Europe/Madrid';
  if (inBox(27.5, 29.5, -18.5, -13.3)) return 'Atlantic/Canary';
  return null;
}

function _offsetAtUtc(iana, utcMs) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: iana, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {}; for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return (asUtc - utcMs) / 3600000;   // horas (p. ej. -2 para Argentina en verano 1988)
}

/** Desfase (horas) vigente en `iana` para una hora LOCAL de nacimiento. */
export function offsetHoursAt(iana, year, month, day, hour, minute) {
  try {
    const localAsUtc = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
    let off = _offsetAtUtc(iana, localAsUtc);            // 1ª aproximación
    off = _offsetAtUtc(iana, localAsUtc - off * 3600000); // corregida con el instante real
    return Math.round(off * 4) / 4;
  } catch (e) {
    return null;
  }
}
