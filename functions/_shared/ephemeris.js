/**
 * Shared ephemeris for Cloudflare Pages Functions.
 * Mirror of the client-side /js/transits.js math, kept here so the
 * natal_chart column can be populated synchronously at profile-creation
 * time (not only on the 3AM pipeline).
 *
 * Accuracy: ±0.5° for Sun/Moon with perturbation terms, ±1° for planets.
 * Identical to the client-side engine that renders Mi Día's wheel,
 * so values shown instantly to the user match what the server computes.
 */

const DEG = Math.PI / 180;
const OBLIQUITY = 23.4392911 * DEG;

// Keplerian elements at J2000.0 with daily rates. Pluto's `w` is the
// argument of perihelion (ω), not the longitude of perihelion (ϖ) —
// confusing these two tanks Pluto by ~250°.
const ORBITS = {
  Sun:     { N:[0,0],             i:[0,0],              w:[282.9404,4.70935e-5],   a:[1,0],           e:[0.016709,-1.151e-9], M:[356.0470,0.9856002585] },
  Moon:    { N:[125.1228,-0.0529538083], i:[5.1454,0],  w:[318.0634,0.1643573223], a:[60.2666,0],     e:[0.054900,0],         M:[115.3654,13.0649929509] },
  Mercury: { N:[48.3313,3.24587e-5],     i:[7.0047,5e-8], w:[29.1241,1.01444e-5],  a:[0.387098,0],    e:[0.205635,5.59e-10],  M:[168.6562,4.0923344368] },
  Venus:   { N:[76.6799,2.4659e-5],  i:[3.3946,2.75e-8],  w:[54.8910,1.38374e-5],  a:[0.723330,0],    e:[0.006773,-1.302e-9], M:[48.0052,1.6021302244] },
  Mars:    { N:[49.5574,2.11081e-5], i:[1.8497,-1.78e-8], w:[286.5016,2.92961e-5], a:[1.523688,0],    e:[0.093405,2.516e-9],  M:[18.6021,0.5240207766] },
  Jupiter: { N:[100.4542,2.76854e-5], i:[1.3030,-1.557e-7], w:[273.8777,1.64505e-5], a:[5.20256,0],    e:[0.048498,4.469e-9],  M:[19.8950,0.0830853001] },
  Saturn:  { N:[113.6634,2.3898e-5], i:[2.4886,-1.081e-7], w:[339.3939,2.97661e-5], a:[9.55475,0],    e:[0.055546,-9.499e-9], M:[316.9670,0.0334442282] },
  Uranus:  { N:[74.0005,1.3978e-5],  i:[0.7733,1.9e-8],   w:[96.6612,3.0565e-5],   a:[19.18171,-1.55e-8], e:[0.047318,7.45e-9], M:[142.5905,0.011725806] },
  Neptune: { N:[131.7806,3.0173e-5], i:[1.7700,-2.55e-7], w:[272.8461,-6.027e-6],  a:[30.05826,3.313e-8], e:[0.008606,2.15e-9], M:[260.2471,0.005995147] },
  Pluto:   { N:[110.30,0],           i:[17.141,0],        w:[113.765,0],           a:[39.482,0],      e:[0.24885,0],          M:[14.890,0.003953] },
};

const ZODIAC_ES = ['Aries','Tauro','Géminis','Cáncer','Leo','Virgo','Libra','Escorpio','Sagitario','Capricornio','Acuario','Piscis'];
const SYMBOLS   = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
const PLANET_ES = { Sun:'Sol', Moon:'Luna', Mercury:'Mercurio', Venus:'Venus', Mars:'Marte', Jupiter:'Júpiter', Saturn:'Saturno', Uranus:'Urano', Neptune:'Neptuno', Pluto:'Plutón' };

function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
function daysSinceJ2000(date) { return date.getTime() / 86400000 + 2440587.5 - 2451543.5; }

// Newton-Raphson solve of Kepler's equation. All inputs in degrees.
function kepler(M, e) {
  const mR = M * DEG;
  let E = mR + e * Math.sin(mR) * (1 + e * Math.cos(mR));
  for (let i = 0; i < 8; i++) {
    const dE = (E - e * Math.sin(E) - mR) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-6) break;
  }
  return E / DEG;
}

function elements(orb, d) {
  return {
    N: orb.N[0] + orb.N[1] * d,
    i: orb.i[0] + orb.i[1] * d,
    w: orb.w[0] + orb.w[1] * d,
    a: orb.a[0] + orb.a[1] * d,
    e: orb.e[0] + orb.e[1] * d,
    M: norm360(orb.M[0] + orb.M[1] * d),
  };
}

function helio(el) {
  const E = kepler(el.M, el.e);
  const xv = el.a * (Math.cos(E * DEG) - el.e);
  const yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E * DEG);
  const v  = Math.atan2(yv, xv) / DEG;
  const r  = Math.sqrt(xv * xv + yv * yv);
  const u  = (v + el.w) * DEG;
  const N  = el.N * DEG, ii = el.i * DEG;
  const xh = r * (Math.cos(N) * Math.cos(u) - Math.sin(N) * Math.sin(u) * Math.cos(ii));
  const yh = r * (Math.sin(N) * Math.cos(u) + Math.cos(N) * Math.sin(u) * Math.cos(ii));
  const zh = r * Math.sin(u) * Math.sin(ii);
  const lon = norm360(Math.atan2(yh, xh) / DEG);
  return { x: xh, y: yh, z: zh, lon, r };
}

// Ten largest Moon perturbation terms from Schlyter. Without these the
// Moon drifts ~5° from reality; with them we hit ~0.5°.
function moonPerturb(moonEl, sunEl) {
  const Ms = norm360(sunEl.M);
  const Mm = norm360(moonEl.M);
  const Nm = norm360(moonEl.N);
  const wm = norm360(moonEl.w);
  const Lm = norm360(Nm + wm + Mm);
  const Ls = norm360(sunEl.w + Ms);
  const D  = norm360(Lm - Ls);
  let dLon = 0;
  dLon += -1.274 * Math.sin((Mm - 2 * D) * DEG);
  dLon +=  0.658 * Math.sin(2 * D * DEG);
  dLon += -0.186 * Math.sin(Ms * DEG);
  dLon += -0.059 * Math.sin((2 * Mm - 2 * D) * DEG);
  dLon += -0.057 * Math.sin((Mm - 2 * D + Ms) * DEG);
  dLon +=  0.053 * Math.sin((Mm + 2 * D) * DEG);
  dLon +=  0.046 * Math.sin((2 * D - Ms) * DEG);
  dLon +=  0.041 * Math.sin((Mm - Ms) * DEG);
  dLon += -0.035 * Math.sin(D * DEG);
  dLon += -0.031 * Math.sin((Mm + Ms) * DEG);
  return dLon;
}

export function computePositions(date) {
  const d = daysSinceJ2000(date);
  const out = {};
  const sunEl = elements(ORBITS.Sun, d);
  const sunH  = helio(sunEl);
  out.Sun = sunH.lon;
  const moonEl = elements(ORBITS.Moon, d);
  const moonH  = helio(moonEl);
  out.Moon = norm360(moonH.lon + moonPerturb(moonEl, sunEl));
  const sunVec = { x: sunH.r * Math.cos(sunH.lon * DEG), y: sunH.r * Math.sin(sunH.lon * DEG) };
  for (const name of ['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto']) {
    const el = elements(ORBITS[name], d);
    const h  = helio(el);
    const gx = h.x + sunVec.x, gy = h.y + sunVec.y;
    out[name] = norm360(Math.atan2(gy, gx) / DEG);
  }
  return out;
}

export function computeAscMc(date, latDeg, lonDeg) {
  const jdUt = date.getTime() / 86400000 + 2440587.5;
  const T = (jdUt - 2451545.0) / 36525;
  const theta0 = 280.46061837 + 360.98564736629 * (jdUt - 2451545.0)
               + 0.000387933 * T * T - (T * T * T) / 38710000;
  const gmst = ((theta0 % 360) + 360) % 360;
  const lst  = (((gmst + lonDeg) % 360) + 360) % 360;
  const lstR = lst * DEG;
  const latR = latDeg * DEG;

  // Midheaven: longitude of the point where ecliptic crosses the
  // upper meridian. atan2 gives correct quadrant directly.
  const mcR  = Math.atan2(Math.sin(lstR), Math.cos(lstR) * Math.cos(OBLIQUITY));
  const mc   = ((mcR / DEG) % 360 + 360) % 360;

  // Ascendant (Meeus): longitude of the ecliptic point rising on the
  // east horizon. The closed-form atan2( cos(RAMC), -(sin(RAMC)·cosε +
  // tanφ·sinε) ) returns the correct quadrant directly — no range
  // correction needed.
  //
  // The previous version used atan2(-cos, +…) (which is the Descendant,
  // i.e. 180° off) plus an (MC+90°, MC+270°) range flip to recover the
  // Asc. That flip mis-selected whenever Asc fell near MC+90° (a common
  // case at mid latitudes): e.g. for 1990-07-15 14:30 CDMX it returned
  // Tauro where the true rising sign is Escorpio. Fixed 2026-06-22.
  const ascR = Math.atan2(Math.cos(lstR),
                          -(Math.sin(lstR) * Math.cos(OBLIQUITY) + Math.tan(latR) * Math.sin(OBLIQUITY)));
  const asc  = ((ascR / DEG) % 360 + 360) % 360;
  return { asc, mc };
}

const ASPECTS = [
  { name_es: 'Conjunción', angle: 0,   orb: 8 },
  { name_es: 'Oposición',  angle: 180, orb: 8 },
  { name_es: 'Cuadratura', angle: 90,  orb: 7 },
  { name_es: 'Trígono',    angle: 120, orb: 7 },
  { name_es: 'Sextil',     angle: 60,  orb: 5 },
];

function angDist(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

function detectAspects(planets) {
  const out = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const dist = angDist(planets[i].longitude, planets[j].longitude);
      for (let k = 0; k < ASPECTS.length; k++) {
        const a = ASPECTS[k];
        const orb = Math.abs(dist - a.angle);
        if (orb <= a.orb) {
          out.push({
            planet1: planets[i].name,
            planet2: planets[j].name,
            aspect: a.name_es,
            angle: a.angle,
            orb: Math.round(orb * 10) / 10,
          });
          break;
        }
      }
    }
  }
  return out;
}

function signInfo(lonDeg) {
  const L = norm360(lonDeg);
  const idx = Math.floor(L / 30);
  return {
    sign_es: ZODIAC_ES[idx],
    symbol:  SYMBOLS[idx],
    degree:  Math.round((L - idx * 30) * 100) / 100,
  };
}

/**
 * Build a complete natal_chart JSON matching the shape expected by
 * mi-dia.html (planets, positions, ascendant, midheaven, houses,
 * aspects, utc_time, ascendantVerified).
 *
 * If `hour` is null or lat/lon missing, planets + aspects still compute
 * (using noon UTC as a rough centroid) but Ascendant, Midheaven, and
 * houses are omitted — those require exact birth time + coordinates.
 */
export function buildNatalChart({ year, month, day, hour, minute, lat, lon, tzOffsetHours }) {
  const effHour = typeof hour === 'number' ? hour : 12;
  const effMin  = typeof minute === 'number' ? minute : 0;
  const effTz   = typeof tzOffsetHours === 'number' ? tzOffsetHours : -6;
  const birthUTC = new Date(Date.UTC(year, month - 1, day, effHour - effTz, effMin));

  const pos = computePositions(birthUTC);
  const planets = Object.keys(pos).map(function (name) {
    const si = signInfo(pos[name]);
    return {
      name,
      name_es: PLANET_ES[name],
      sign: si.sign_es,
      degree: si.degree,
      longitude: Math.round(pos[name] * 100) / 100,
      symbol: si.symbol,
    };
  });

  const positions = {};
  Object.keys(pos).forEach(function (n) { positions[n] = pos[n]; });

  const aspects = detectAspects(planets);

  const chart = {
    planets,
    positions,
    aspects,
    utc_time: birthUTC.toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  };

  // Ascendant + MC only meaningful with exact hour + location.
  const hasAngles = typeof hour === 'number' && typeof lat === 'number' && typeof lon === 'number';
  if (hasAngles) {
    const am = computeAscMc(birthUTC, lat, lon);
    const ascInfo = signInfo(am.asc);
    const mcInfo  = signInfo(am.mc);
    chart.ascendant = { sign: ascInfo.sign_es, degree: ascInfo.degree, longitude: Math.round(am.asc * 100) / 100 };
    chart.midheaven = { sign: mcInfo.sign_es,  degree: mcInfo.degree,  longitude: Math.round(am.mc * 100) / 100 };
    chart.houses = [];
    for (let h = 0; h < 12; h++) {
      const cusp = norm360(am.asc + 30 * h);
      const hs = signInfo(cusp);
      chart.houses.push({ house: h + 1, cusp_degree: Math.round(cusp * 10) / 10, sign: hs.sign_es, degree: hs.degree });
    }
    chart.ascendantVerified = true;
  } else {
    chart.ascendantVerified = false;
  }

  return chart;
}
