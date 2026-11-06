/**
 * Compatibilidad con amigos (2026-11-06). Solo por invitación; sin datos de nacimiento hacia fuera.
 * Lógica compartida por /api/amigos/* y /api/reports/compatibility.
 */
import { codigoDe } from './referidos.js';

export const ENLACE_AMIGO = 'https://luzestelaroficial.com/amigo?c=';
const iso = () => new Date().toISOString();
export const codigoAmigoValido = (c) => /^[a-z0-9]{10}$/.test(String(c || ''));

function nuevoCodigo() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';   // sin 0/o/1/l para dictarlo sin errores
  const b = new Uint8Array(10); crypto.getRandomValues(b);
  return Array.from(b, (x) => abc[x % abc.length]).join('');
}

/** Perfil principal de una cuenta, SOLO con lo que se puede mostrar a un amigo. */
export async function perfilPublico(DB, userId) {
  const sel = (extra) => DB.prepare(
    `SELECT id, nombre, western_sign, chinese_animal, numerology_number, mayan_seal, celtic_tree${extra}
       FROM birth_profiles WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC LIMIT 1`
  ).bind(userId).first();
  let p;
  try { p = await sel(', avatar'); }
  catch (e) { if (!/no such column: avatar/i.test(String(e && e.message))) throw e; p = await sel(''); }
  if (!p) return null;
  const nombre = String(p.nombre || '').trim().split(/\s+/)[0] || 'Tu amigo';   // solo el primer nombre
  return { profileId: p.id, nombre, sol: p.western_sign || null, chino: p.chinese_animal || null,
           numero: p.numerology_number ?? null, maya: p.mayan_seal || null, celta: p.celtic_tree || null,
           avatar: p.avatar || null };
}

export async function miCodigo(DB, userId) {
  const f = await DB.prepare('SELECT codigo FROM amigo_codigos WHERE user_id = ?').bind(userId).first();
  if (f) return f.codigo;
  for (let i = 0; i < 4; i++) {
    const c = nuevoCodigo();
    try {
      await DB.prepare('INSERT INTO amigo_codigos (user_id, codigo, creado) VALUES (?, ?, ?)').bind(userId, c, iso()).run();
      return c;
    } catch (e) { /* choque de código (rarísimo) o carrera: reintenta / relee */ }
    const g = await DB.prepare('SELECT codigo FROM amigo_codigos WHERE user_id = ?').bind(userId).first();
    if (g) return g.codigo;
  }
  throw new Error('no se pudo crear el código');
}

export async function duenoDeCodigo(DB, codigo) {
  if (!codigoAmigoValido(codigo)) return null;
  const f = await DB.prepare('SELECT user_id FROM amigo_codigos WHERE codigo = ?').bind(codigo).first();
  return f ? f.user_id : null;
}

/** Para la página /amigo/<código>: quién invita (nombre y signos) + su código de referidos. */
export async function invitacion(DB, codigo) {
  const uid = await duenoDeCodigo(DB, codigo);
  if (!uid) return null;
  const p = await perfilPublico(DB, uid);
  if (!p) return null;
  const { profileId, ...visible } = p;
  return { ...visible, ref: codigoDe(uid) };
}

export async function aceptar(DB, userId, codigo) {
  const uid = await duenoDeCodigo(DB, codigo);
  if (!uid) return { estado: 'invalido' };
  if (uid === userId) return { estado: 'propio' };
  const ahora = iso();
  await DB.prepare('INSERT OR IGNORE INTO amistades (user_id, amigo_id, creado) VALUES (?, ?, ?)').bind(userId, uid, ahora).run();
  await DB.prepare('INSERT OR IGNORE INTO amistades (user_id, amigo_id, creado) VALUES (?, ?, ?)').bind(uid, userId, ahora).run();
  const p = await perfilPublico(DB, uid);
  return { estado: 'ok', amigo: p ? { id: uid, nombre: p.nombre } : { id: uid } };
}

export async function quitar(DB, userId, amigoId) {
  await DB.prepare('DELETE FROM amistades WHERE (user_id = ? AND amigo_id = ?) OR (user_id = ? AND amigo_id = ?)')
    .bind(userId, amigoId, amigoId, userId).run();
}

/** Lista de amigos (más antiguo primero: el primero es el que puede comparar la cuenta gratis). */
export async function lista(DB, userId) {
  const r = await DB.prepare('SELECT amigo_id, creado FROM amistades WHERE user_id = ? ORDER BY creado ASC, amigo_id ASC')
    .bind(userId).all();
  const out = [];
  for (const f of r.results || []) {
    const p = await perfilPublico(DB, f.amigo_id);
    if (!p) continue;
    const { profileId, ...visible } = p;
    out.push({ id: f.amigo_id, desde: f.creado, ...visible });
  }
  return out;
}

/** ¿Puede `userId` (tier) comparar con `amigoId`? Plus: con todos; gratis: solo con el primero. */
export async function puedeComparar(DB, userId, tier, amigoId) {
  const amigos = await lista(DB, userId);
  const i = amigos.findIndex((a) => a.id === amigoId);
  if (i < 0) return { ok: false, motivo: 'no_amigo' };
  if (tier === 'premium' || i === 0) return { ok: true };
  return { ok: false, motivo: 'plus' };
}
