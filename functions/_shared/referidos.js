/**
 * Referidos (2026-11-06) — «1 mes de Plus por cada cuenta nueva que entra con tu enlace y crea su carta,
 * hasta 3 meses». Lógica compartida por claim.js y status.js.
 */
export const MAX_PREMIOS = 3;
export const DIAS_PREMIO = 30;
export const VENTANA_DIAS = 14;              // el enlace cuenta si la cuenta nueva se creó hace ≤14 días
export const ENLACE_BASE = 'https://luzestelaroficial.com/probar'; // mientras la app esté en prueba cerrada

export const codigoDe = (userId) => String(userId || '').replace(/-/g, '').slice(0, 8).toLowerCase();
export const codigoValido = (c) => /^[0-9a-f]{8}$/.test(String(c || ''));

const isoZ = (d) => d.toISOString();

/** Correo «de verdad»: sin +etiqueta y, en Gmail, sin puntos (a.b+x@gmail.com = ab@gmail.com). */
export function correoNormal(email) {
  let [u, d] = String(email || '').toLowerCase().trim().split('@');
  if (!u || !d) return '';
  u = u.split('+')[0];
  if (d === 'googlemail.com') d = 'gmail.com';
  if (d === 'gmail.com') u = u.replace(/\./g, '');
  return u + '@' + d;
}

/**
 * Suma un mes de Plus de regalo al referente: alarga la fila ref_<id> si sigue viva, si no la reabre.
 * Devuelve el nuevo fin.
 */
export async function premiar(DB, referenteId, ahora = new Date()) {
  const id = 'ref_' + referenteId;
  const fila = await DB.prepare('SELECT status, current_period_end FROM subscriptions WHERE id = ?').bind(id).first();
  const base = (fila && fila.status === 'active' && fila.current_period_end && new Date(fila.current_period_end) > ahora)
    ? new Date(fila.current_period_end) : ahora;
  const fin = new Date(base.getTime() + DIAS_PREMIO * 86400000);
  await DB.prepare(
    `INSERT INTO subscriptions (id, user_id, plan, status, cadence, current_period_start, current_period_end, created_at, provider)
     VALUES (?, ?, 'premium', 'active', 'monthly', ?, ?, ?, 'regalo')
     ON CONFLICT(id) DO UPDATE SET status = 'active', current_period_end = excluded.current_period_end`
  ).bind(id, referenteId, isoZ(ahora), isoZ(fin), isoZ(ahora)).run();
  await DB.prepare("UPDATE users SET tier = 'premium', updated_at = ? WHERE id = ?").bind(isoZ(ahora), referenteId).run();
  return fin;
}

/**
 * Registra que `userId` llegó con `codigo`. Reglas: código válido de OTRA cuenta, cuenta nueva (≤14 días),
 * con al menos una carta creada, y nunca antes referida. Devuelve { estado, ... }:
 *   registrado | ya | sin_carta (reintentar luego) | invalido | propio | vieja
 */
export async function reclamar(DB, userId, codigo, ahora = new Date()) {
  codigo = String(codigo || '').toLowerCase();
  if (!codigoValido(codigo)) return { estado: 'invalido' };
  if (codigoDe(userId) === codigo) return { estado: 'propio' };

  const ya = await DB.prepare('SELECT 1 AS x FROM referidos WHERE referido_id = ?').bind(userId).first();
  if (ya) return { estado: 'ya' };

  const yo = await DB.prepare('SELECT created_at, email FROM users WHERE id = ?').bind(userId).first();
  if (!yo) return { estado: 'invalido' };
  if (ahora - new Date(yo.created_at) > VENTANA_DIAS * 86400000) return { estado: 'vieja' };

  const r = await DB.prepare("SELECT id, email FROM users WHERE lower(replace(id, '-', '')) LIKE ? LIMIT 2").bind(codigo + '%').all();
  const refs = r.results || [];
  if (refs.length !== 1) return { estado: 'invalido' };
  const referenteId = refs[0].id;
  // la misma persona con otro alias de correo (tu+1@gmail.com, t.u@gmail.com) no cuenta
  if (correoNormal(refs[0].email) && correoNormal(refs[0].email) === correoNormal(yo.email)) return { estado: 'propio' };

  const carta = await DB.prepare('SELECT 1 AS x FROM birth_profiles WHERE user_id = ? LIMIT 1').bind(userId).first();
  if (!carta) return { estado: 'sin_carta' };

  const n = await DB.prepare('SELECT count(*) AS n FROM referidos WHERE referente_id = ? AND premiado = 1').bind(referenteId).first();
  const premia = (n ? n.n : 0) < MAX_PREMIOS;
  await DB.prepare('INSERT OR IGNORE INTO referidos (referido_id, referente_id, codigo, premiado, creado) VALUES (?, ?, ?, ?, ?)')
    .bind(userId, referenteId, codigo, premia ? 1 : 0, isoZ(ahora)).run();
  if (premia) await premiar(DB, referenteId, ahora);
  return { estado: 'registrado', premiado: premia };
}

export async function estado(DB, userId) {
  const codigo = codigoDe(userId);
  let amigos = 0, premios = 0, hasta = null;
  try {
    const n = await DB.prepare('SELECT count(*) AS n, coalesce(sum(premiado), 0) AS p FROM referidos WHERE referente_id = ?').bind(userId).first();
    amigos = n ? n.n : 0; premios = n ? n.p : 0;
    const f = await DB.prepare("SELECT current_period_end AS fin, status FROM subscriptions WHERE id = ?").bind('ref_' + userId).first();
    if (f && f.status === 'active') hasta = f.fin;
  } catch (e) { /* antes de la migración 0012: todo en cero */ }
  return { codigo, enlace: `${ENLACE_BASE}?ref=${codigo}`, amigos, meses: Math.min(premios, MAX_PREMIOS), max: MAX_PREMIOS, plusHasta: hasta };
}
