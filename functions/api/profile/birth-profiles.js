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
  const { nombre, fechaNacimiento, horaNacimiento, lugarNacimiento, lat, lon, timezone, label } = body;

  if (!nombre || !fechaNacimiento || !lugarNacimiento) {
    return Response.json({ ok: false, error: 'Missing required fields: nombre, fechaNacimiento, lugarNacimiento' }, { status: 400 });
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

  const maxProfiles = user.tier === 'free' ? 1 : 10;
  if (countRes.cnt >= maxProfiles) {
    return Response.json({
      ok: false,
      error: user.tier === 'free'
        ? 'Free tier limited to 1 profile. Upgrade to Premium for up to 10.'
        : 'Maximum 10 profiles reached.'
    }, { status: 403 });
  }

  // Calculate multi-system assignments
  const westernSign = getWesternSign(month, day);
  const chineseAnimal = getChineseAnimal(year);
  const numerologyNumber = getLifePathNumber(year, month, day);
  const celticTree = getCelticTree(month, day);

  const profileId = crypto.randomUUID();
  const isPrimary = countRes.cnt === 0 ? 1 : 0;
  const now = new Date().toISOString();

  await context.env.DB.prepare(
    `INSERT INTO birth_profiles (id, user_id, label, nombre, fecha_nacimiento, hora_nacimiento, lugar_nacimiento, lat, lon, timezone, western_sign, chinese_animal, numerology_number, celtic_tree, is_primary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    profileId, user.sub, label || 'Mi Perfil', nombre, fechaNacimiento,
    horaNacimiento || null, lugarNacimiento, lat || null, lon || null,
    timezone || null, westernSign, chineseAnimal, numerologyNumber, celticTree,
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
      isPrimary,
    }
  }, { status: 201 });
}
