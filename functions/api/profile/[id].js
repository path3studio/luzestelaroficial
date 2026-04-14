/**
 * DELETE /api/profile/:id — Delete a birth profile
 * PATCH  /api/profile/:id — Update a birth profile (label, nombre)
 */

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
  const { label, nombre } = body;

  if (!label && !nombre) {
    return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 });
  }

  // Verify the profile belongs to this user
  const profile = await context.env.DB.prepare(
    'SELECT id FROM birth_profiles WHERE id = ? AND user_id = ?'
  ).bind(profileId, user.sub).first();

  if (!profile) {
    return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });
  }

  // Build update query dynamically
  const updates = [];
  const values = [];
  if (label) { updates.push('label = ?'); values.push(label); }
  if (nombre) { updates.push('nombre = ?'); values.push(nombre); }
  values.push(profileId, user.sub);

  await context.env.DB.prepare(
    `UPDATE birth_profiles SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  ).bind(...values).run();

  return Response.json({ ok: true });
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
