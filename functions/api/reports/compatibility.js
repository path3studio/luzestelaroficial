/**
 * GET /api/reports/compatibility?profile_a=xxx&profile_b=yyy — Cross-cultural compatibility report
 *
 * Premium only. Analyzes compatibility between two birth profiles
 * across Western, Chinese, Numerology, and Celtic systems.
 */

const ELEMENT_COMPAT = {
  'Fire-Fire': 85,   'Fire-Earth': 45,   'Fire-Air': 90,    'Fire-Water': 40,
  'Earth-Earth': 80,  'Earth-Air': 55,    'Earth-Water': 85,
  'Air-Air': 75,      'Air-Water': 50,
  'Water-Water': 80,
};

const CHINESE_COMPAT = {
  // Trines (highest compatibility groups)
  trine1: ['Rat','Dragon','Monkey'],
  trine2: ['Ox','Snake','Rooster'],
  trine3: ['Tiger','Horse','Dog'],
  trine4: ['Rabbit','Goat','Pig'],
  // Clashes
  clashes: [['Rat','Horse'],['Ox','Goat'],['Tiger','Monkey'],['Rabbit','Rooster'],['Dragon','Dog'],['Snake','Pig']],
};

const LP_COMPAT = {
  harmonious: [[1,5],[2,4],[3,6],[1,9],[2,8],[4,8],[3,9],[5,7],[6,9],[7,9]],
  challenging: [[1,4],[1,8],[4,5],[5,6],[3,4],[2,5]],
};

function getElementCompat(e1, e2) {
  const key1 = `${e1}-${e2}`;
  const key2 = `${e2}-${e1}`;
  return ELEMENT_COMPAT[key1] || ELEMENT_COMPAT[key2] || 60;
}

function getChineseCompat(a1, a2) {
  // Check trines
  for (const trine of [CHINESE_COMPAT.trine1, CHINESE_COMPAT.trine2, CHINESE_COMPAT.trine3, CHINESE_COMPAT.trine4]) {
    if (trine.includes(a1) && trine.includes(a2)) return 90;
  }
  // Check clashes
  for (const [c1, c2] of CHINESE_COMPAT.clashes) {
    if ((a1 === c1 && a2 === c2) || (a1 === c2 && a2 === c1)) return 30;
  }
  return 60;
}

function getLPCompat(n1, n2) {
  for (const [a, b] of LP_COMPAT.harmonious) {
    if ((n1 === a && n2 === b) || (n1 === b && n2 === a)) return 85;
  }
  for (const [a, b] of LP_COMPAT.challenging) {
    if ((n1 === a && n2 === b) || (n1 === b && n2 === a)) return 40;
  }
  return 65;
}

const WESTERN_ELEMENTS = {
  'Aries':'Fire','Taurus':'Earth','Gemini':'Air','Cancer':'Water',
  'Leo':'Fire','Virgo':'Earth','Libra':'Air','Scorpio':'Water',
  'Sagittarius':'Fire','Capricorn':'Earth','Aquarius':'Air','Pisces':'Water',
};

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  if (user.tier === 'free') {
    return Response.json({
      ok: false,
      error: 'Premium subscription required for compatibility reports',
      upgrade: true,
    }, { status: 403 });
  }

  const url = new URL(context.request.url);
  const profileAId = url.searchParams.get('profile_a');
  const profileBId = url.searchParams.get('profile_b');
  const lang = url.searchParams.get('lang') || 'es';
  const { DB } = context.env;

  if (!profileAId || !profileBId) {
    return Response.json({ ok: false, error: 'Two profile IDs required' }, { status: 400 });
  }

  const profileA = await DB.prepare(
    'SELECT * FROM birth_profiles WHERE id = ? AND user_id = ?'
  ).bind(profileAId, user.sub).first();

  const profileB = await DB.prepare(
    'SELECT * FROM birth_profiles WHERE id = ? AND user_id = ?'
  ).bind(profileBId, user.sub).first();

  if (!profileA || !profileB) {
    return Response.json({ ok: false, error: 'Profile(s) not found' }, { status: 404 });
  }

  // Calculate compatibility scores
  const westernScore = getElementCompat(
    WESTERN_ELEMENTS[profileA.western_sign] || 'Fire',
    WESTERN_ELEMENTS[profileB.western_sign] || 'Fire'
  );
  const chineseScore = getChineseCompat(profileA.chinese_animal, profileB.chinese_animal);
  const numScore = getLPCompat(profileA.numerology_number, profileB.numerology_number);

  // Celtic: same tree = high, similar season = medium
  const celticScore = profileA.celtic_tree === profileB.celtic_tree ? 95 : 60;

  const overallScore = Math.round((westernScore + chineseScore + numScore + celticScore) / 4);

  const report = {
    profileA: { name: profileA.nombre, birthDate: profileA.fecha_nacimiento },
    profileB: { name: profileB.nombre, birthDate: profileB.fecha_nacimiento },
    overallScore,
    breakdown: {
      western: {
        score: westernScore,
        signA: profileA.western_sign,
        signB: profileB.western_sign,
        elementA: WESTERN_ELEMENTS[profileA.western_sign],
        elementB: WESTERN_ELEMENTS[profileB.western_sign],
      },
      chinese: {
        score: chineseScore,
        animalA: profileA.chinese_animal,
        animalB: profileB.chinese_animal,
      },
      numerology: {
        score: numScore,
        numberA: profileA.numerology_number,
        numberB: profileB.numerology_number,
      },
      celtic: {
        score: celticScore,
        treeA: profileA.celtic_tree,
        treeB: profileB.celtic_tree,
      },
    },
    synthesis: lang === 'en'
      ? `${profileA.nombre} and ${profileB.nombre} share a ${overallScore}% cross-cultural compatibility. Their ${profileA.western_sign}-${profileB.western_sign} dynamic brings ${westernScore >= 70 ? 'natural harmony' : 'creative tension'}, while their Chinese zodiac pairing (${profileA.chinese_animal}-${profileB.chinese_animal}) ${chineseScore >= 70 ? 'flows with ease' : 'offers growth opportunities'}.`
      : `${profileA.nombre} y ${profileB.nombre} comparten un ${overallScore}% de compatibilidad cross-cultural. Su dinamica ${profileA.western_sign}-${profileB.western_sign} trae ${westernScore >= 70 ? 'armonia natural' : 'tension creativa'}, mientras su pareja del zodiaco chino (${profileA.chinese_animal}-${profileB.chinese_animal}) ${chineseScore >= 70 ? 'fluye con facilidad' : 'ofrece oportunidades de crecimiento'}.`,
    generatedAt: new Date().toISOString(),
  };

  return Response.json({ ok: true, report });
}
