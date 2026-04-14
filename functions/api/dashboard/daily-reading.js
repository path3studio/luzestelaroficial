/**
 * GET /api/dashboard/daily-reading — Personalized daily reading
 *
 * Assembles a personalized horoscope from pre-generated snippets
 * stored in KV. Zero LLM calls at request time.
 *
 * Free:    Western sign + Chinese + Numerology (3 systems)
 * Premium: All 8 systems (+ Celtic, Mayan, Vedic, Human Design, Enneagram)
 */

const MOON_PHASES_ES = [
  'Luna nueva', 'Creciente', 'Cuarto creciente', 'Gibosa creciente',
  'Luna llena', 'Gibosa menguante', 'Cuarto menguante', 'Menguante',
];
const MOON_PHASES_EN = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
];

const SYSTEM_LABELS = {
  chinese:       { es: 'Astrología China',  en: 'Chinese Astrology' },
  numerology:    { es: 'Numerología',        en: 'Numerology' },
  celtic:        { es: 'Astrología Celta',   en: 'Celtic Astrology' },
  mayan:         { es: 'Astrología Maya',    en: 'Mayan Astrology' },
  vedic:         { es: 'Astrología Védica',  en: 'Vedic Astrology' },
  human_design:  { es: 'Diseño Humano',      en: 'Human Design' },
  enneagram:     { es: 'Eneagrama',          en: 'Enneagram' },
};

function getMoonPhase(year, month, day) {
  const lp = 2551443;
  const refNew = new Date(2000, 0, 6, 18, 14, 0).getTime() / 1000;
  const target = new Date(year, month - 1, day, 12, 0, 0).getTime() / 1000;
  const phase = ((target - refNew) % lp + lp) % lp;
  const idx = Math.floor((phase / lp) * 8) % 8;
  return {
    idx,
    illumination: Math.round(50 + 50 * Math.cos(2 * Math.PI * phase / lp)),
  };
}

function getGreeting(lang, hour) {
  if (lang === 'en') {
    if (hour < 12) return 'Good morning';
    if (hour < 20) return 'Good afternoon';
    return 'Good evening';
  }
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function lookupSnippet(snippetData, archetype) {
  if (!snippetData || !archetype) return null;
  const key = String(archetype);
  if (snippetData[key]) return snippetData[key];
  // Case-insensitive fallback
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(snippetData)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { DB, AUTH_KV } = context.env;
  const url = new URL(context.request.url);
  const lang = url.searchParams.get('lang') || 'es';

  // Primary birth profile
  const profile = await DB.prepare(
    'SELECT * FROM birth_profiles WHERE user_id = ? AND is_primary = 1'
  ).bind(user.sub).first();

  if (!profile) {
    return Response.json({ ok: false, error: 'No birth profile found' }, { status: 404 });
  }

  const today = new Date();
  const dateKey = today.toISOString().split('T')[0];
  const isPremium = user.tier === 'premium';

  // Systems the user's tier can access
  const allSystems = ['chinese', 'numerology', 'celtic', 'mayan', 'vedic', 'human_design', 'enneagram'];
  const freeSystems = ['chinese', 'numerology'];
  const accessibleSystems = isPremium ? allSystems : freeSystems;

  // Map profile fields → snippet archetype keys
  const archetypeMap = {
    chinese:      profile.chinese_animal,
    numerology:   profile.numerology_number != null ? String(profile.numerology_number) : null,
    celtic:       profile.celtic_tree,
    mayan:        profile.mayan_seal,
    vedic:        profile.vedic_rashi,
    human_design: profile.human_design_gate != null ? String(profile.human_design_gate) : null,
    enneagram:    profile.enneagram_type != null ? String(profile.enneagram_type) : null,
  };

  // Build KV keys to fetch in parallel
  const horoscopeKey = `daily_${profile.western_sign}_${dateKey}_${lang}`;
  const snippetKeys = accessibleSystems.map(s => `snippets_${s}_${dateKey}_${lang}`);

  const kvPromises = [
    AUTH_KV.get(horoscopeKey).catch(() => null),
    ...snippetKeys.map(k => AUTH_KV.get(k).catch(() => null)),
  ];
  const kvResults = await Promise.all(kvPromises);

  // Parse main horoscope
  let horoscope = null;
  try {
    if (kvResults[0]) horoscope = JSON.parse(kvResults[0]);
  } catch (e) { /* ignore parse errors */ }

  // Extract user-specific snippet from each system
  const systemInsights = [];
  for (let i = 0; i < accessibleSystems.length; i++) {
    const system = accessibleSystems[i];
    const raw = kvResults[i + 1];
    if (!raw) continue;

    try {
      const data = JSON.parse(raw);
      const text = lookupSnippet(data, archetypeMap[system]);
      if (text) {
        systemInsights.push({
          system,
          label: SYSTEM_LABELS[system]?.[lang] || system,
          archetype: archetypeMap[system],
          text,
          locked: false,
        });
      }
    } catch (e) { /* ignore parse errors */ }
  }

  // Add locked previews for systems free users can't access
  if (!isPremium) {
    const lockedSystems = allSystems.filter(s => !freeSystems.includes(s));
    for (const system of lockedSystems) {
      if (archetypeMap[system]) {
        systemInsights.push({
          system,
          label: SYSTEM_LABELS[system]?.[lang] || system,
          archetype: archetypeMap[system],
          text: null,
          locked: true,
        });
      }
    }
  }

  // Energy scores — prefer KV biorhythm, deterministic fallback
  const bio = horoscope?.biorhythm || {};
  const energy = {
    love:    bio.love    || 5,
    career:  bio.career  || 5,
    health:  bio.health  || 5,
    energy:  bio.energy  || 5,
    overall: Math.round(((bio.love || 5) + (bio.career || 5) + (bio.health || 5) + (bio.energy || 5)) / 4),
  };

  // Moon phase
  const moon = getMoonPhase(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const moonPhases = lang === 'en' ? MOON_PHASES_EN : MOON_PHASES_ES;

  // Greeting (Mexico City time)
  const mxHour = parseInt(
    today.toLocaleString('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hour12: false }),
    10,
  );
  const greeting = getGreeting(lang, mxHour);

  return Response.json({
    ok: true,
    date: dateKey,
    tier: user.tier || 'free',
    greeting: `${greeting}, ${profile.nombre}`,
    profile: {
      name: profile.nombre,
      westernSign: profile.western_sign,
    },
    reading: horoscope?.text || null,
    systemInsights,
    energy,
    moon: {
      phase: moonPhases[moon.idx],
      illumination: moon.illumination,
    },
  });
}
