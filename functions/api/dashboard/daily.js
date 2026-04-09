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

  // Energy scores
  const energy = getDailyEnergy(profile.western_sign, dayOfYear);
  const luckyNumber = getLuckyNumber(profile.western_sign, dayOfYear);
  const theme = DAY_THEMES[dayOfWeek];

  const response = {
    ok: true,
    date: dateKey,
    profile: {
      name: profile.nombre,
      westernSign: profile.western_sign,
      chineseAnimal: profile.chinese_animal,
      numerologyNumber: profile.numerology_number,
      celticTree: profile.celtic_tree,
    },
    moon,
    energy,
    luckyNumber,
    theme,
    horoscope: dailyContent || null,
  };

  return Response.json(response);
}
