/**
 * GET /api/reports/unified?profile_id=xxx — Generate a cross-cultural unified report
 *
 * Premium only. Combines Western astrology, Chinese zodiac, Numerology,
 * and Celtic tree system into a comprehensive personality analysis.
 * Results are cached per profile in D1.
 */

// Deterministic calculations (mirrored from birth-profiles.js / cross-cultural.js)
const WESTERN_SIGNS = {
  'Aries':       { element: 'Fire',   mode: 'Cardinal',  ruler: 'Mars' },
  'Taurus':      { element: 'Earth',  mode: 'Fixed',     ruler: 'Venus' },
  'Gemini':      { element: 'Air',    mode: 'Mutable',   ruler: 'Mercury' },
  'Cancer':      { element: 'Water',  mode: 'Cardinal',  ruler: 'Moon' },
  'Leo':         { element: 'Fire',   mode: 'Fixed',     ruler: 'Sun' },
  'Virgo':       { element: 'Earth',  mode: 'Mutable',   ruler: 'Mercury' },
  'Libra':       { element: 'Air',    mode: 'Cardinal',  ruler: 'Venus' },
  'Scorpio':     { element: 'Water',  mode: 'Fixed',     ruler: 'Pluto' },
  'Sagittarius': { element: 'Fire',   mode: 'Mutable',   ruler: 'Jupiter' },
  'Capricorn':   { element: 'Earth',  mode: 'Cardinal',  ruler: 'Saturn' },
  'Aquarius':    { element: 'Air',    mode: 'Fixed',     ruler: 'Uranus' },
  'Pisces':      { element: 'Water',  mode: 'Mutable',   ruler: 'Neptune' },
};

const CHINESE_ELEMENTS = ['Wood','Wood','Fire','Fire','Earth','Earth','Metal','Metal','Water','Water'];

const LIFE_PATH_THEMES = {
  1: 'Leadership & Independence',
  2: 'Cooperation & Sensitivity',
  3: 'Expression & Creativity',
  4: 'Structure & Discipline',
  5: 'Freedom & Adventure',
  6: 'Nurturing & Responsibility',
  7: 'Analysis & Introspection',
  8: 'Power & Material Success',
  9: 'Humanitarianism & Wisdom',
  11: 'Spiritual Insight',
  22: 'Master Builder',
  33: 'Master Teacher',
};

const CELTIC_QUALITIES = {
  'Birch':    'New beginnings, purification, determination',
  'Rowan':    'Protection, vision, personal power',
  'Ash':      'Connection, wisdom, spiritual awareness',
  'Alder':    'Strength, foundation, spiritual guidance',
  'Willow':   'Intuition, imagination, inner vision',
  'Hawthorn': 'Patience, restraint, inner beauty',
  'Oak':      'Strength, endurance, generosity',
  'Holly':    'Challenge, overcoming obstacles, royalty',
  'Hazel':    'Wisdom, creativity, inspiration',
  'Vine':     'Prophecy, celebration, introspection',
  'Ivy':      'Tenacity, transformation, patience',
  'Reed':     'Harmony, health, growth',
  'Elder':    'Transition, renewal, release',
};

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  // Premium gate
  if (user.tier === 'free') {
    return Response.json({
      ok: false,
      error: 'Premium subscription required for full reports',
      upgrade: true,
    }, { status: 403 });
  }

  const url = new URL(context.request.url);
  const profileId = url.searchParams.get('profile_id');
  const lang = url.searchParams.get('lang') || 'es';
  const { DB } = context.env;

  // Get birth profile
  let profile;
  if (profileId) {
    profile = await DB.prepare(
      'SELECT * FROM birth_profiles WHERE id = ? AND user_id = ?'
    ).bind(profileId, user.sub).first();
  } else {
    profile = await DB.prepare(
      'SELECT * FROM birth_profiles WHERE user_id = ? AND is_primary = 1'
    ).bind(user.sub).first();
  }

  if (!profile) {
    return Response.json({ ok: false, error: 'Birth profile not found' }, { status: 404 });
  }

  // Check cache
  const cacheKey = `unified_${profile.id}_${lang}`;
  const cached = await DB.prepare(
    'SELECT report_json FROM cached_reports WHERE cache_key = ? AND created_at > datetime("now", "-7 days")'
  ).bind(cacheKey).first();

  if (cached) {
    return Response.json({ ok: true, report: JSON.parse(cached.report_json), cached: true });
  }

  // Build report deterministically
  const western = WESTERN_SIGNS[profile.western_sign] || {};
  const chineseElement = CHINESE_ELEMENTS[((parseInt(profile.fecha_nacimiento.split('-')[0]) - 1924) % 10 + 10) % 10];
  const lpTheme = LIFE_PATH_THEMES[profile.numerology_number] || 'Universal';
  const celticQ = CELTIC_QUALITIES[profile.celtic_tree] || '';

  const report = {
    profileName: profile.nombre,
    birthDate: profile.fecha_nacimiento,
    systems: {
      western: {
        sign: profile.western_sign,
        element: western.element,
        mode: western.mode,
        ruler: western.ruler,
      },
      chinese: {
        animal: profile.chinese_animal,
        element: chineseElement,
      },
      numerology: {
        lifePathNumber: profile.numerology_number,
        theme: lpTheme,
      },
      celtic: {
        tree: profile.celtic_tree,
        qualities: celticQ,
      },
      mayan: {
        kin: profile.mayan_kin,
        seal: profile.mayan_seal,
        tone: profile.mayan_tone,
      },
      vedic: {
        rashi: profile.vedic_rashi,
        nakshatra: profile.vedic_nakshatra,
      },
      humanDesign: {
        gate: profile.human_design_gate,
      },
      enneagram: profile.enneagram_type ? {
        type: profile.enneagram_type,
        wing: profile.enneagram_wing,
      } : null,
    },
    synthesis: buildSynthesis(profile, western, chineseElement, lpTheme, celticQ, lang),
    generatedAt: new Date().toISOString(),
  };

  // Cache the report
  try {
    await DB.prepare(
      'INSERT OR REPLACE INTO cached_reports (id, user_id, birth_profile_id, cache_key, report_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), user.sub, profile.id, cacheKey, JSON.stringify(report), new Date().toISOString()).run();
  } catch (e) {
    console.warn('Cache write failed:', e);
  }

  return Response.json({ ok: true, report });
}

function buildSynthesis(profile, western, chineseElement, lpTheme, celticQ, lang) {
  const elemMap = { 'Fire': 'action', 'Earth': 'stability', 'Air': 'intellect', 'Water': 'emotion', 'Wood': 'growth', 'Metal': 'precision' };
  const westernE = elemMap[western.element] || 'balance';
  const chineseE = elemMap[chineseElement] || 'harmony';

  if (lang === 'en') {
    return {
      elementalBalance: `Your Western ${western.element} nature combined with Chinese ${chineseElement} creates a dynamic of ${westernE} meeting ${chineseE}. This blend shapes how you interact with the world.`,
      coreIdentity: `As a ${profile.western_sign} (${western.mode} ${western.element}), your foundational energy is guided by ${western.ruler}. The ${profile.chinese_animal} adds layers of ${chineseElement} wisdom, while your Life Path ${profile.numerology_number} points to ${lpTheme}.`,
      soulPath: `The Celtic ${profile.celtic_tree} tree — associated with ${celticQ} — illuminates your deeper soul journey. Combined with Life Path ${profile.numerology_number} (${lpTheme}), your path leads toward meaningful integration of these ancient traditions.`,
      strengths: `The synergy between ${profile.western_sign}'s ${western.element} energy and the ${profile.chinese_animal}'s ${chineseElement} nature gives you a unique capacity for both ${westernE} and ${chineseE}. Your Celtic ${profile.celtic_tree} grounds this potential.`,
    };
  }

  return {
    elementalBalance: `Tu naturaleza ${western.element} occidental combinada con el ${chineseElement} chino crea una dinamica de ${westernE} encontrando ${chineseE}. Esta mezcla moldea como interactuas con el mundo.`,
    coreIdentity: `Como ${profile.western_sign} (${western.mode} ${western.element}), tu energia fundamental esta guiada por ${western.ruler}. El ${profile.chinese_animal} anade capas de sabiduria ${chineseElement}, mientras tu Numero de Vida ${profile.numerology_number} apunta a ${lpTheme}.`,
    soulPath: `El arbol celta ${profile.celtic_tree} — asociado con ${celticQ} — ilumina tu viaje del alma mas profundo. Combinado con el Numero de Vida ${profile.numerology_number} (${lpTheme}), tu camino conduce hacia la integracion significativa de estas tradiciones ancestrales.`,
    strengths: `La sinergia entre la energia ${western.element} de ${profile.western_sign} y la naturaleza ${chineseElement} del ${profile.chinese_animal} te da una capacidad unica para ${westernE} y ${chineseE}. Tu arbol celta ${profile.celtic_tree} enraiza este potencial.`,
  };
}
