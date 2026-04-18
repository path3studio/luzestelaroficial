/**
 * GET /api/auth/me — Return current user profile
 */
export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch full profile from D1
  try {
    const row = await context.env.DB.prepare(
      'SELECT id, email, name, picture_url, tier, lang, created_at FROM users WHERE id = ?'
    ).bind(user.sub).first();

    if (!row) {
      return Response.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // Fetch birth profiles.
    // natal_chart is included so the client can render Ascendente /
    // MC / aspects without a second round-trip. The column is a JSON
    // string (see calculate_natal_chart in consultation_generator.py).
    // Typical size is ~4 KB per profile; with a 5-profile Plus cap the
    // total payload stays well under the 100 KB Worker response ceiling.
    const profiles = await context.env.DB.prepare(
      'SELECT id, label, nombre, fecha_nacimiento, hora_nacimiento, lugar_nacimiento, lat, lon, timezone, natal_chart, western_sign, chinese_animal, numerology_number, celtic_tree, mayan_kin, mayan_seal, mayan_tone, vedic_rashi, vedic_nakshatra, human_design_gate, enneagram_type, enneagram_wing, is_primary FROM birth_profiles WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC'
    ).bind(user.sub).all();

    return Response.json({
      ok: true,
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        picture: row.picture_url,
        tier: row.tier,
        lang: row.lang,
        createdAt: row.created_at,
      },
      birthProfiles: profiles.results || [],
    });
  } catch (err) {
    return Response.json({ ok: false, error: 'Database error' }, { status: 500 });
  }
}
