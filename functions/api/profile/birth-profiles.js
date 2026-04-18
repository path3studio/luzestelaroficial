/**
 * POST /api/profile/birth-profiles — Create a birth profile
 * GET  /api/profile/birth-profiles — List user's birth profiles
 */

// Deterministic calculations (mirroring cross-cultural.js)
function getWesternSign(month, day) {
  const ranges = [
    [3,21,4,19,'Aries'], [4,20,5,20,'Taurus'], [5,21,6,20,'Gemini'],
    [6,21,7,22,'Cancer'], [7,23,8,22,'Leo'], [8,23,9,22,'Virgo'],
    [9,23,10,22,'Libra'], [10,23,11,21,'Scorpio'], [11,22,12,21,'Sagittarius'],
    [12,22,1,19,'Capricorn'], [1,20,2,18,'Aquarius'], [2,19,3,20,'Pisces']
  ];
  const md = month * 100 + day;
  for (const [sm,sd,em,ed,name] of ranges) {
    const s = sm*100+sd, e = em*100+ed;
    if (s > e) { if (md >= s || md <= e) return name; }
    else { if (md >= s && md <= e) return name; }
  }
  return 'Capricorn';
}

function getChineseAnimal(year) {
  const animals = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
  return animals[((year - 1924) % 12 + 12) % 12];
}

function getLifePathNumber(y, m, d) {
  function reduce(n) {
    while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
      n = String(n).split('').reduce((a,b) => a + parseInt(b), 0);
    }
    return n;
  }
  return reduce(reduce(y) + reduce(m) + reduce(d));
}

function getCelticTree(month, day) {
  const trees = [
    [12,24,1,20,'Birch'], [1,21,2,17,'Rowan'], [2,18,3,17,'Ash'],
    [3,18,4,14,'Alder'], [4,15,5,12,'Willow'], [5,13,6,9,'Hawthorn'],
    [6,10,7,7,'Oak'], [7,8,8,4,'Holly'], [8,5,9,1,'Hazel'],
    [9,2,9,29,'Vine'], [9,30,10,27,'Ivy'], [10,28,11,24,'Reed'],
    [11,25,12,23,'Elder']
  ];
  const md = month * 100 + day;
  for (const [sm,sd,em,ed,name] of trees) {
    const s = sm*100+sd, e = em*100+ed;
    if (s > e) { if (md >= s || md <= e) return name; }
    else { if (md >= s && md <= e) return name; }
  }
  return 'Birch';
}

// ── Mayan Tzolkin ──────────────────────────────────────────
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

function getMayanKin(year, month, day) {
  const jdn = gregorianToJDN(year, month, day);
  const kin = ((jdn - 584283) % 260 + 260) % 260;
  return { kin: kin + 1, seal: MAYAN_SEAL_NAMES[kin % 20], tone: (kin % 13) + 1 };
}

// ── Vedic / Jyotish ───────────────────────────────────────
const RASHI_NAMES = ['Mesha','Vrishabha','Mithuna','Karka','Simha','Kanya','Tula','Vrischika','Dhanu','Makara','Kumbha','Meena'];
const NAKSHATRA_NAMES = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha',
  'Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'
];

function approxSunLongitude(year, month, day) {
  const jdn = gregorianToJDN(year, month, day);
  const n = jdn - 2451545.0;
  let L = (280.460 + 0.9856474 * n) % 360;
  if (L < 0) L += 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
  const lambda = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
  return ((lambda % 360) + 360) % 360;
}

function getVedicProfile(year, month, day) {
  const tropical = approxSunLongitude(year, month, day);
  const ayanamsa = 23.85 + (year - 2000) * 0.01397;
  const sidereal = ((tropical - ayanamsa) % 360 + 360) % 360;
  return { rashi: RASHI_NAMES[Math.floor(sidereal / 30)], nakshatra: NAKSHATRA_NAMES[Math.floor(sidereal / (360/27))] };
}

// ── Human Design Sun Gate ─────────────────────────────────
const HD_GATE_SEQ = [
  41,19,13,49,30,55,37,63, 22,36,25,17,21,51,42,3,
  27,24,2,23,8,20,16,35,   45,12,15,52,39,53,62,56,
  31,33,7,4,29,59,40,64,   47,6,46,18,48,57,32,50,
  28,44,1,43,14,34,9,5,    26,11,10,58,38,54,61,60
];

function getHumanDesignGate(year, month, day) {
  const sunLong = approxSunLongitude(year, month, day);
  const gateIdx = Math.floor(sunLong / 5.625) % 64;
  return HD_GATE_SEQ[gateIdx];
}

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const profiles = await context.env.DB.prepare(
    'SELECT * FROM birth_profiles WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC'
  ).bind(user.sub).all();

  return Response.json({ ok: true, profiles: profiles.results || [] });
}

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = await context.request.json();
  let { nombre, fechaNacimiento, horaNacimiento, lugarNacimiento, lat, lon, timezone, label } = body;

  if (!nombre || !fechaNacimiento || !lugarNacimiento) {
    return Response.json({ ok: false, error: 'Missing required fields: nombre, fechaNacimiento, lugarNacimiento' }, { status: 400 });
  }

  // Server-side geocoding safety-net: if the client didn't resolve
  // coordinates (autocomplete was skipped, freeform typing, older
  // UI versions, etc.), try Nominatim via our /api/geocode proxy.
  // Without this, the profile row ends up with lat/lon NULL and the
  // Cielo Real view + any observational features fail downstream.
  if ((lat == null || lon == null) && lugarNacimiento) {
    try {
      const gUrl = new URL('/api/geocode', context.request.url);
      gUrl.searchParams.set('q', lugarNacimiento);
      // Default to Spanish — matches most of our user base. Could be
      // inferred from user.lang in a future iteration.
      gUrl.searchParams.set('lang', 'es');
      const gRes = await fetch(gUrl.toString(), {
        headers: { 'User-Agent': 'LuzEstelar-Profile-Backfill/1.0' },
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData && gData.ok && gData.results && gData.results[0]) {
          lat = gData.results[0].lat;
          lon = gData.results[0].lon;
        }
      }
    } catch (_) {
      // Non-fatal — profile still gets created, just without
      // coordinates. User can resubmit with proper autocomplete.
    }
  }

  // Parse birth date
  const [year, month, day] = fechaNacimiento.split('-').map(Number);
  if (!year || !month || !day) {
    return Response.json({ ok: false, error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
  }

  // Check profile limit
  const countRes = await context.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM birth_profiles WHERE user_id = ?'
  ).bind(user.sub).first();

  const maxProfiles = user.tier === 'free' ? 1 : 5;
  if (countRes.cnt >= maxProfiles) {
    return Response.json({
      ok: false,
      error: user.tier === 'free'
        ? 'Free tier limited to 1 profile. Upgrade to Premium for up to 5.'
        : 'Maximum 5 profiles reached.'
    }, { status: 403 });
  }

  // Calculate multi-system assignments
  const westernSign = getWesternSign(month, day);
  const chineseAnimal = getChineseAnimal(year);
  const numerologyNumber = getLifePathNumber(year, month, day);
  const celticTree = getCelticTree(month, day);
  const mayan = getMayanKin(year, month, day);
  const vedic = getVedicProfile(year, month, day);
  const hdGate = getHumanDesignGate(year, month, day);

  const profileId = crypto.randomUUID();
  const isPrimary = countRes.cnt === 0 ? 1 : 0;
  const now = new Date().toISOString();

  await context.env.DB.prepare(
    `INSERT INTO birth_profiles (id, user_id, label, nombre, fecha_nacimiento, hora_nacimiento, lugar_nacimiento, lat, lon, timezone, western_sign, chinese_animal, numerology_number, celtic_tree, mayan_kin, mayan_seal, mayan_tone, vedic_rashi, vedic_nakshatra, human_design_gate, is_primary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    profileId, user.sub, label || 'Mi Perfil', nombre, fechaNacimiento,
    horaNacimiento || null, lugarNacimiento, lat || null, lon || null,
    timezone || null, westernSign, chineseAnimal, numerologyNumber, celticTree,
    mayan.kin, mayan.seal, mayan.tone, vedic.rashi, vedic.nakshatra, hdGate,
    isPrimary, now
  ).run();

  return Response.json({
    ok: true,
    profile: {
      id: profileId,
      label: label || 'Mi Perfil',
      nombre,
      fechaNacimiento,
      westernSign,
      chineseAnimal,
      numerologyNumber,
      celticTree,
      mayanKin: mayan.kin,
      mayanSeal: mayan.seal,
      mayanTone: mayan.tone,
      vedicRashi: vedic.rashi,
      vedicNakshatra: vedic.nakshatra,
      humanDesignGate: hdGate,
      isPrimary,
    }
  }, { status: 201 });
}
