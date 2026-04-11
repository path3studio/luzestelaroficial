/**
 * POST /api/profile/enneagram — Save enneagram quiz result to birth profile
 * Body: { enneagramType: number (1-9), enneagramWing: string, profileId?: string }
 */
export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { enneagramType, enneagramWing, profileId } = body;

  if (!enneagramType || enneagramType < 1 || enneagramType > 9) {
    return Response.json({ ok: false, error: 'Invalid enneagram type (must be 1-9)' }, { status: 400 });
  }

  const { DB } = context.env;

  try {
    let result;
    if (profileId) {
      result = await DB.prepare(
        'UPDATE birth_profiles SET enneagram_type = ?, enneagram_wing = ? WHERE id = ? AND user_id = ?'
      ).bind(enneagramType, enneagramWing || null, profileId, user.sub).run();
    } else {
      result = await DB.prepare(
        'UPDATE birth_profiles SET enneagram_type = ?, enneagram_wing = ? WHERE user_id = ? AND is_primary = 1'
      ).bind(enneagramType, enneagramWing || null, user.sub).run();
    }

    if (result.meta.changes === 0) {
      return Response.json({ ok: false, error: 'No birth profile found to update' }, { status: 404 });
    }

    return Response.json({ ok: true, enneagramType, enneagramWing: enneagramWing || null });
  } catch (err) {
    console.error('Enneagram save error:', err);
    return Response.json({ ok: false, error: 'Database error' }, { status: 500 });
  }
}
