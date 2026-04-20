/**
 * DELETE /api/profile/:id — Delete a birth profile
 * PATCH  /api/profile/:id — Update a birth profile (label, nombre, birth data)
 *                          Auto-recomputes natal_chart when birth data changes.
 * PUT    /api/profile/:id — Set this profile as primary
 */

import { buildNatalChart } from '../../_shared/ephemeris.js';

// Same mapping as birth-profiles.js POST — keep in sync if the
// canonical list moves to _shared. Returns a UTC offset number for
// a given IANA timezone. Falls back to -6 (Mexico) for anything
// unrecognised, since the active user base is MX-first.
function inferTzOffset(timezone) {
  if (!timezone || typeof timezone !== 'string') return -6;
  if (timezone.startsWith('UTC')) {
    const m = timezone.match(/^UTC([+-]\d+)/);
    if (m) return parseInt(m[1], 10);
    return 0;
  }
  const map = {
    'America/Mexico_City': -6, 'America/Monterrey': -6, 'America/Cancun': -5,
    'America/Tijuana': -8, 'America/Hermosillo': -7,
    'America/New_York': -5, 'America/Chicago': -6,
    'America/Denver': -7, 'America/Los_Angeles': -8,
    'America/Bogota': -5, 'America/Lima': -5, 'America/Santiago': -4,
    'America/Argentina/Buenos_Aires': -3, 'America/Sao_Paulo': -3,
    'America/Caracas': -4, 'Europe/Madrid': 1, 'Europe/London': 0,
    'Europe/Paris': 1, 'Europe/Berlin': 1,
  };
  return map[timezone] !== undefined ? map[timezone] : -6;
}

// Fields that, when changed, invalidate the stored natal_chart and
// require recomputation. If none of these are touched, the expensive
// ephemeris run is skipped — only label/nombre updates hit a cheap
// UPDATE without re-computing anything.
const CHART_FIELDS = ['fecha_nacimiento', 'hora_nacimiento', 'lat', 'lon', 'timezone'];

export async function onRequestDelete(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const profileId = context.params.id;
  if (!profileId) return Response.json({ ok: false, error: 'Missing profile ID' }, { status: 400 });

  // Verify the profile belongs to this user
  const profile = await context.env.DB.prepare(
    'SELECT id, is_primary FROM birth_profiles WHERE id = ? AND user_id = ?'
  ).bind(profileId, user.sub).first();

  if (!profile) {
    return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });
  }

  // Delete the profile
  await context.env.DB.prepare(
    'DELETE FROM birth_profiles WHERE id = ? AND user_id = ?'
  ).bind(profileId, user.sub).run();

  // If it was the primary profile, promote the next one
  if (profile.is_primary) {
    const next = await context.env.DB.prepare(
      'SELECT id FROM birth_profiles WHERE user_id = ? ORDER BY created_at ASC LIMIT 1'
    ).bind(user.sub).first();
    if (next) {
      await context.env.DB.prepare(
        'UPDATE birth_profiles SET is_primary = 1 WHERE id = ?'
      ).bind(next.id).run();
    }
  }

  return Response.json({ ok: true });
}

export async function onRequestPatch(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const profileId = context.params.id;
  if (!profileId) return Response.json({ ok: false, error: 'Missing profile ID' }, { status: 400 });

  const body = await context.request.json();

  // Accept both camelCase (client-side convention) and snake_case
  // (DB column names) for the birth-data fields. This keeps the
  // endpoint flexible whether the caller is the built-in PWA or any
  // future mobile/native client that prefers one convention.
  const changes = {
    label:             body.label,
    nombre:            body.nombre,
    fecha_nacimiento:  body.fechaNacimiento  ?? body.fecha_nacimiento,
    hora_nacimiento:   body.horaNacimiento   ?? body.hora_nacimiento,
    lugar_nacimiento:  body.lugarNacimiento  ?? body.lugar_nacimiento,
    lat:               body.lat,
    lon:               body.lon,
    timezone:          body.timezone,
  };

  // Strip undefined so we only UPDATE fields the client actually sent.
  // Empty string is a valid "clear this field" on nullable columns,
  // so we distinguish undefined (don't touch) from null/'' (unset).
  for (const k of Object.keys(changes)) {
    if (changes[k] === undefined) delete changes[k];
  }

  if (Object.keys(changes).length === 0) {
    return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 });
  }

  // Fetch the profile fully — we need the existing values for fields
  // the caller didn't override, so the natal_chart recompute uses
  // the complete (new + old) record. Ownership check is implicit in
  // the WHERE user_id clause.
  const existing = await context.env.DB.prepare(
    `SELECT id, fecha_nacimiento, hora_nacimiento, lat, lon, timezone, natal_chart
     FROM birth_profiles WHERE id = ? AND user_id = ?`
  ).bind(profileId, user.sub).first();

  if (!existing) {
    return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });
  }

  // Decide whether the natal_chart needs to be recomputed.
  // Two conditions trigger a recompute:
  //   1. Any chart-affecting field is in the changes (date/time/lat/lon/tz)
  //   2. The stored natal_chart is NULL and all required fields are now present
  //      (backfill path for profiles created before auto-compute landed)
  const chartFieldChanged = CHART_FIELDS.some(f => f in changes);
  const merged = {
    fecha_nacimiento: changes.fecha_nacimiento ?? existing.fecha_nacimiento,
    hora_nacimiento:  changes.hora_nacimiento  ?? existing.hora_nacimiento,
    lat:              changes.lat              ?? existing.lat,
    lon:              changes.lon              ?? existing.lon,
    timezone:         changes.timezone         ?? existing.timezone,
  };
  const hasCompleteBirthData = merged.fecha_nacimiento && merged.lat != null && merged.lon != null;
  const needsBackfill = existing.natal_chart == null && hasCompleteBirthData;
  const shouldRecompute = (chartFieldChanged && hasCompleteBirthData) || needsBackfill;

  let newChartJson = null;
  if (shouldRecompute) {
    try {
      const [y, m, d] = merged.fecha_nacimiento.split('-').map(Number);
      const [hh, mm] = (merged.hora_nacimiento || '').split(':').map(Number);
      const chart = buildNatalChart({
        year: y, month: m, day: d,
        hour:   Number.isFinite(hh) ? hh : null,
        minute: Number.isFinite(mm) ? mm : null,
        lat:    typeof merged.lat === 'number' ? merged.lat : null,
        lon:    typeof merged.lon === 'number' ? merged.lon : null,
        tzOffsetHours: inferTzOffset(merged.timezone),
      });
      newChartJson = JSON.stringify(chart);
    } catch (e) {
      // Non-fatal — the field updates still apply. The nightly
      // pipeline will catch up on natal_chart at 3AM, and if that
      // also fails the user sees "No disponible" on the Ascendant,
      // which is the same state they were in before this PATCH.
      console.warn('[profile patch] natal_chart recompute failed:', e.message);
    }
  }

  // Build the UPDATE dynamically. Snake_case column names match the
  // schema exactly.
  const setClauses = [];
  const values = [];
  for (const [col, val] of Object.entries(changes)) {
    setClauses.push(`${col} = ?`);
    values.push(val);
  }
  if (newChartJson != null) {
    setClauses.push('natal_chart = ?');
    values.push(newChartJson);
  }
  values.push(profileId, user.sub);

  await context.env.DB.prepare(
    `UPDATE birth_profiles SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run();

  // If the birth data changed, ANY cached reading for this profile
  // becomes stale (it was generated against the old natal chart).
  // Invalidate the on-demand cache so the next /mi-dia load triggers
  // a fresh generation against the new chart. Use DELETE rather than
  // UPDATE to keep the UNIQUE index clean; it's also cheap (0-1 row).
  if (shouldRecompute && context.env.DB) {
    try {
      await context.env.DB
        .prepare('DELETE FROM ondemand_generations WHERE profile_id = ?')
        .bind(profileId).run();
    } catch { /* table may not exist yet on some envs — silent */ }
  }

  return Response.json({ ok: true, recomputed: shouldRecompute });
}

export async function onRequestPut(context) {
  // Set a profile as primary
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const profileId = context.params.id;
  if (!profileId) return Response.json({ ok: false, error: 'Missing profile ID' }, { status: 400 });

  // Verify the profile belongs to this user
  const profile = await context.env.DB.prepare(
    'SELECT id FROM birth_profiles WHERE id = ? AND user_id = ?'
  ).bind(profileId, user.sub).first();

  if (!profile) {
    return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });
  }

  // Remove primary from all, set this one
  await context.env.DB.batch([
    context.env.DB.prepare('UPDATE birth_profiles SET is_primary = 0 WHERE user_id = ?').bind(user.sub),
    context.env.DB.prepare('UPDATE birth_profiles SET is_primary = 1 WHERE id = ? AND user_id = ?').bind(profileId, user.sub),
  ]);

  return Response.json({ ok: true });
}
