/**
 * GET /api/dashboard/daily — Get daily horoscope & cosmic data for user's profile
 *
 * Returns pre-generated daily content from KV, falling back to
 * deterministic calculation if KV data is unavailable.
 */

const DAY_THEMES = [
  'introspection', 'action', 'creativity', 'stability',
  'communication', 'nurturing', 'analysis',
];

const MOON_PHASES = [
  'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
  'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent',
];

function getMoonPhase(year, month, day) {
  // Simplified moon phase calculation
  const lp = 2551443; // lunar period in seconds
  const refNew = new Date(2000, 0, 6, 18, 14, 0).getTime() / 1000;
  const target = new Date(year, month - 1, day, 12, 0, 0).getTime() / 1000;
  const phase = ((target - refNew) % lp + lp) % lp;
  const phaseIndex = Math.floor((phase / lp) * 8) % 8;
  return {
    phase: MOON_PHASES[phaseIndex],
    illumination: Math.round(50 + 50 * Math.cos(2 * Math.PI * phase / lp)),
  };
}

function getDailyEnergy(sign, day) {
  // Deterministic "energy" based on sign and day of year
  const signIndex = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'].indexOf(sign);
  const seed = (signIndex * 31 + day) % 100;
  return {
    overall: 60 + (seed % 35),
    love: 50 + ((seed * 3 + 7) % 45),
    career: 55 + ((seed * 5 + 13) % 40),
    health: 60 + ((seed * 7 + 19) % 35),
  };
}

function getLuckyNumber(sign, day) {
  const signIndex = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'].indexOf(sign);
  return ((signIndex * 7 + day * 3) % 99) + 1;
}

// ── Mayan Tzolkin day (seal + tone) ──
const MAYAN_SEAL_NAMES = [
  'Imix','Ik','Akbal','Kan','Chicchan','Cimi','Manik','Lamat',
  'Muluc','Oc','Chuen','Eb','Ben','Ix','Men','Cib',
  'Caban','Etznab','Cauac','Ahau'
];

function gregorianToJDN(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y
       + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function getTzolkinDay(year, month, day) {
  const jdn = gregorianToJDN(year, month, day);
  const kin = ((jdn - 584283) % 260 + 260) % 260;
  return {
    kin: kin + 1,
    seal: MAYAN_SEAL_NAMES[kin % 20],
    tone: (kin % 13) + 1,
  };
}

// ── Vedic Nakshatra of the day (approx, lunar longitude-based) ──
const NAKSHATRA_NAMES = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha',
  'Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'
];

function getNakshatraOfDay(year, month, day) {
  // Approximate moon longitude using simplified mean elements
  const jdn = gregorianToJDN(year, month, day);
  const daysSinceJ2000 = jdn - 2451545.0;
  let moonLong = (218.316 + 13.176396 * daysSinceJ2000) % 360;
  if (moonLong < 0) moonLong += 360;
  // Apply approximate ayanamsa for sidereal
  const ayanamsa = 23.85 + (year - 2000) * 0.01397;
  const sidereal = ((moonLong - ayanamsa) % 360 + 360) % 360;
  const idx = Math.floor(sidereal / (360 / 27));
  return NAKSHATRA_NAMES[idx];
}

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { DB, AUTH_KV } = context.env;
  const url = new URL(context.request.url);
  const lang = url.searchParams.get('lang') || 'es';

  // Get primary profile
  const profile = await DB.prepare(
    'SELECT * FROM birth_profiles WHERE user_id = ? AND is_primary = 1'
  ).bind(user.sub).first();

  if (!profile) {
    return Response.json({ ok: false, error: 'No birth profile found' }, { status: 404 });
  }

  const today = new Date();
  const dateKey = today.toISOString().split('T')[0];
  const dayOfYear = Math.ceil((today - new Date(today.getFullYear(), 0, 1)) / 86400000);
  const dayOfWeek = today.getDay();

  // Try to get pre-generated content from KV
  const kvKey = `daily_${profile.western_sign}_${dateKey}_${lang}`;
  let dailyContent = null;

  try {
    const kvData = await AUTH_KV.get(kvKey);
    if (kvData) {
      dailyContent = JSON.parse(kvData);
    }
  } catch (e) {
    console.warn('KV read error:', e);
  }

  // Moon phase
  const moon = getMoonPhase(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // Multi-system cosmic data for today (light touch — hook to learn more)
  const tzolkinToday = getTzolkinDay(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const nakshatraToday = getNakshatraOfDay(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // Energy scores
  const energy = getDailyEnergy(profile.western_sign, dayOfYear);
  const luckyNumber = getLuckyNumber(profile.western_sign, dayOfYear);
  const theme = DAY_THEMES[dayOfWeek];

  const isPremium = user.tier === 'premium';

  const response = {
    ok: true,
    date: dateKey,
    tier: user.tier || 'free',
    profile: {
      name: profile.nombre,
      westernSign: profile.western_sign,
      chineseAnimal: profile.chinese_animal,
      numerologyNumber: profile.numerology_number,
      celticTree: profile.celtic_tree,
      mayanSeal: profile.mayan_seal,
      mayanKin: profile.mayan_kin,
      vedicRashi: profile.vedic_rashi,
      humanDesignGate: profile.human_design_gate,
    },
    moon,
    energy,
    luckyNumber,
    theme,
    cosmicToday: {
      mayanSeal: tzolkinToday.seal,
      mayanTone: tzolkinToday.tone,
      mayanKin: tzolkinToday.kin,
      nakshatra: nakshatraToday,
    },
    horoscope: dailyContent || null,
  };

  // Premium users get expanded transit data and multi-system daily insights
  if (isPremium) {
    const signIndex = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'].indexOf(profile.western_sign);
    const transitHouse = ((signIndex + dayOfYear) % 12) + 1;
    const mayanToneDay = ((dayOfYear + (profile.mayan_kin || 0)) % 13) + 1;

    response.expanded = {
      transitHouse,
      transitPlanet: ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'][dayOfWeek],
      mayanToneDay,
      vedicTithi: ((dayOfYear * 3 + signIndex * 7) % 30) + 1,
      hdLineActive: ((dayOfYear + (profile.human_design_gate || 1)) % 6) + 1,
      weeklyForecast: dailyContent ? (dailyContent.weeklyExpanded || null) : null,
    };
  }

  return Response.json(response);
}
