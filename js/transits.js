/*!
 * Luz Estelar — Transits & Ephemeris
 * ───────────────────────────────────
 * Computes geocentric ecliptic longitudes of the ten classical bodies
 * for any date, and detects Ptolemaic aspects between transit positions
 * and a natal chart.
 *
 * Accuracy target: ~0.5° for Sun/Moon, ~1° for planets. Enough for
 * daily-transit aspect detection with 3-8° orbs — not enough for
 * professional ephemeris work or for finding exact aspect timing.
 *
 * Method: simplified Keplerian elements (N, i, w, a, e, M) with linear
 * rates per day from J2000 epoch. For the Moon we add the three largest
 * perturbation terms (Evection, Variation, Annual Equation) because
 * without them the Moon wanders ~5° which is too loose for aspects.
 *
 * Source of elements + method:
 *   Paul Schlyter, "How to compute planetary positions"
 *   http://www.stjarnhimlen.se/comp/ppcomp.html
 *
 * Usage:
 *   var pos = LuzEstelar.Transits.computeTransits(new Date());
 *   // → [{ name:'Sun', longitude:27.3, sign:'Aries', degree:27.3, speed:0.98 }, ...]
 *
 *   var aspects = LuzEstelar.Transits.findAspects(natalPlanets, pos);
 *   // → [{ transit:'Saturn', natal:'Venus', type:'square', orb:1.2, exact:false, applying:true }, ...]
 */
(function () {
  'use strict';

  var ns = (window.LuzEstelar = window.LuzEstelar || {});
  if (ns.Transits) return;

  var DEG = Math.PI / 180;
  var TAU = Math.PI * 2;

  // ── Orbital elements ────────────────────────────────────────────
  // Each field: [value at epoch J2000.0, daily rate of change].
  // N = longitude of ascending node      (°)
  // i = inclination                      (°)
  // w = argument of perihelion           (°)
  // a = semi-major axis                  (AU)
  // e = eccentricity                     (unitless)
  // M = mean anomaly                     (°)
  // Epoch is "d = 0" = 2000 Jan 0, 00:00 TDT (= JD 2451543.5).
  var ORBIT = {
    // Sun's "orbit" is actually Earth's orbit around the Sun, as seen
    // from the Earth — a = 1, geocentric longitude = Sun's true longitude.
    Sun: {
      N: [0.0,       0.0],
      i: [0.0,       0.0],
      w: [282.9404,  4.70935e-5],
      a: [1.000000,  0.0],
      e: [0.016709, -1.151e-9],
      M: [356.0470,  0.9856002585],
    },
    Moon: {
      N: [125.1228, -0.0529538083],
      i: [5.1454,    0.0],
      w: [318.0634,  0.1643573223],
      a: [60.2666,   0.0],         // Earth radii
      e: [0.054900,  0.0],
      M: [115.3654,  13.0649929509],
    },
    Mercury: {
      N: [48.3313,   3.24587e-5],
      i: [7.0047,    5.00e-8],
      w: [29.1241,   1.01444e-5],
      a: [0.387098,  0.0],
      e: [0.205635,  5.59e-10],
      M: [168.6562,  4.0923344368],
    },
    Venus: {
      N: [76.6799,   2.46590e-5],
      i: [3.3946,    2.75e-8],
      w: [54.8910,   1.38374e-5],
      a: [0.723330,  0.0],
      e: [0.006773, -1.302e-9],
      M: [48.0052,   1.6021302244],
    },
    Mars: {
      N: [49.5574,   2.11081e-5],
      i: [1.8497,   -1.78e-8],
      w: [286.5016,  2.92961e-5],
      a: [1.523688,  0.0],
      e: [0.093405,  2.516e-9],
      M: [18.6021,   0.5240207766],
    },
    Jupiter: {
      N: [100.4542,  2.76854e-5],
      i: [1.3030,   -1.557e-7],
      w: [273.8777,  1.64505e-5],
      a: [5.20256,   0.0],
      e: [0.048498,  4.469e-9],
      M: [19.8950,   0.0830853001],
    },
    Saturn: {
      N: [113.6634,  2.38980e-5],
      i: [2.4886,   -1.081e-7],
      w: [339.3939,  2.97661e-5],
      a: [9.55475,   0.0],
      e: [0.055546, -9.499e-9],
      M: [316.9670,  0.0334442282],
    },
    Uranus: {
      N: [74.0005,   1.3978e-5],
      i: [0.7733,    1.9e-8],
      w: [96.6612,   3.0565e-5],
      a: [19.18171, -1.55e-8],
      e: [0.047318,  7.45e-9],
      M: [142.5905,  0.011725806],
    },
    Neptune: {
      N: [131.7806,  3.0173e-5],
      i: [1.7700,   -2.55e-7],
      w: [272.8461, -6.027e-6],
      a: [30.05826,  3.313e-8],
      e: [0.008606,  2.15e-9],
      M: [260.2471,  0.005995147],
    },
    // Pluto — chaotic orbit but mean elements from JPL SSD are fine
    // for transit-accuracy purposes. IMPORTANT: w is the ARGUMENT of
    // perihelion (ω = ϖ − Ω), not the longitude of perihelion (ϖ).
    // Earlier draft had w = 224.09 (ϖ), giving Pluto 250° off.
    Pluto: {
      N: [110.30,    0.0],
      i: [17.141,    0.0],
      w: [113.765,   0.0],
      a: [39.482,    0.0],
      e: [0.24885,   0.0],
      M: [14.890,    0.003953],
    }
  };

  var ZODIAC_EN = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
                   'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

  // ── Time helpers ────────────────────────────────────────────────
  // Days since 2000 Jan 0, 00:00 TDT. TT/TDT differ from UTC by ~70s in
  // the 2020s; we ignore the offset because it's well under our target
  // accuracy.
  function daysSinceJ2000(date) {
    // JD of 2000 Jan 0 00:00 = 2451543.5
    return (date.getTime() / 86400000) + 2440587.5 - 2451543.5;
  }

  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }

  // Solve Kepler's equation M = E − e·sin(E) for E (all in degrees).
  // Newton-Raphson with a generous tolerance (0.001°) since we don't
  // need arcsecond precision.
  function kepler(M, e) {
    var M_r = M * DEG;
    var E = M_r + e * Math.sin(M_r) * (1 + e * Math.cos(M_r));
    for (var iter = 0; iter < 8; iter++) {
      var dE = (E - e * Math.sin(E) - M_r) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-6) break;
    }
    return E / DEG;
  }

  // ── Heliocentric rectangular → geocentric ecliptic longitude ──
  function rectGeoLon(x, y) {
    var lon = Math.atan2(y, x) / DEG;
    return norm360(lon);
  }

  // ── Compute one body's position ─────────────────────────────────
  // Returns geocentric ecliptic longitude in degrees [0, 360), AND
  // heliocentric rectangular coordinates (for composing other bodies'
  // geocentric positions — specifically, we need the Sun's helio
  // position to convert any planet's helio to geocentric).
  function computeElements(orb, d) {
    return {
      N: orb.N[0] + orb.N[1] * d,
      i: orb.i[0] + orb.i[1] * d,
      w: orb.w[0] + orb.w[1] * d,
      a: orb.a[0] + orb.a[1] * d,
      e: orb.e[0] + orb.e[1] * d,
      M: norm360(orb.M[0] + orb.M[1] * d),
    };
  }

  // Returns { x, y, z, lon, lat, r } — heliocentric ecliptic rectangular
  // and spherical (longitude, latitude, radius vector). For the Sun we
  // set the helio output to zero (origin) and the "geo from earth" is
  // just the Sun's apparent longitude.
  function heliocentric(el) {
    var M = el.M, e = el.e;
    var E = kepler(M, e);                               // eccentric anomaly (°)
    var xv = el.a * (Math.cos(E * DEG) - e);
    var yv = el.a * Math.sqrt(1 - e * e) * Math.sin(E * DEG);
    var v = Math.atan2(yv, xv) / DEG;                    // true anomaly
    var r = Math.sqrt(xv * xv + yv * yv);                // helio distance
    var u = (v + el.w) * DEG;                            // argument of latitude
    var N = el.N * DEG, i = el.i * DEG;
    var xh = r * (Math.cos(N) * Math.cos(u) - Math.sin(N) * Math.sin(u) * Math.cos(i));
    var yh = r * (Math.sin(N) * Math.cos(u) + Math.cos(N) * Math.sin(u) * Math.cos(i));
    var zh = r * Math.sin(u) * Math.sin(i);
    var lon = norm360(Math.atan2(yh, xh) / DEG);
    var lat = Math.atan2(zh, Math.sqrt(xh * xh + yh * yh)) / DEG;
    return { x: xh, y: yh, z: zh, lon: lon, lat: lat, r: r };
  }

  // ── Moon perturbations ──────────────────────────────────────────
  // Without these the Moon drifts ~5° from reality. With the three
  // largest terms (Evection, Variation, Annual Equation) we land within
  // ~0.5° — fine for aspect detection.
  function moonPerturbations(moonElH, sunEl, d) {
    var Ms = norm360(sunEl.M);
    var Mm = norm360(moonElH.M);
    var Nm = norm360(moonElH.N);
    var wm = norm360(moonElH.w);
    var Lm = norm360(Nm + wm + Mm);           // moon mean longitude
    var Ls = norm360(sunEl.w + Ms);           // sun mean longitude
    var D  = norm360(Lm - Ls);                 // mean elongation
    var F  = norm360(Lm - Nm);                 // argument of latitude
    // Longitude perturbations:
    var dLon = 0;
    dLon += -1.274 * Math.sin((Mm - 2 * D) * DEG);        // Evection
    dLon +=  0.658 * Math.sin(2 * D * DEG);               // Variation
    dLon += -0.186 * Math.sin(Ms * DEG);                  // Annual equation
    dLon += -0.059 * Math.sin((2 * Mm - 2 * D) * DEG);
    dLon += -0.057 * Math.sin((Mm - 2 * D + Ms) * DEG);
    dLon +=  0.053 * Math.sin((Mm + 2 * D) * DEG);
    dLon +=  0.046 * Math.sin((2 * D - Ms) * DEG);
    dLon +=  0.041 * Math.sin((Mm - Ms) * DEG);
    dLon += -0.035 * Math.sin(D * DEG);
    dLon += -0.031 * Math.sin((Mm + Ms) * DEG);
    return dLon;
  }

  // ── Public: compute transit positions for a moment ──────────────
  function computeTransits(date) {
    var d = daysSinceJ2000(date || new Date());
    var result = [];

    // Sun first — needed for geocentric reduction of other planets.
    var sunEl = computeElements(ORBIT.Sun, d);
    var sunHelio = heliocentric(sunEl);                  // w.r.t. geocentre actually for Sun
    // For the Sun, the "heliocentric" output IS the geocentric position
    // (since Sun orbits Earth-sun barycentre ≈ Sun, and our elements
    // describe the apparent Sun). So sun's geocentric lon = sunHelio.lon.
    result.push(makeEntry('Sun', sunHelio.lon, dailyRate('Sun')));

    // Moon — geocentric directly from its elements, plus perturbations.
    var moonEl = computeElements(ORBIT.Moon, d);
    var moonGeo = heliocentric(moonEl);                  // Moon elements are ALREADY geocentric
    var moonLon = norm360(moonGeo.lon + moonPerturbations(moonEl, sunEl, d));
    result.push(makeEntry('Moon', moonLon, dailyRate('Moon')));

    // Inner + outer planets: compute helio, subtract Sun's helio to get
    // geocentric rectangular, then convert to longitude.
    var sunRect = { x: -sunHelio.r * Math.cos(sunHelio.lon * DEG),
                    y: -sunHelio.r * Math.sin(sunHelio.lon * DEG),
                    z: 0 };
    // Actually: the Sun's geocentric position is at (rS cos L, rS sin L)
    // where L = sun's apparent longitude. Earth's helio is the negative
    // of that. For geocentric of a planet: planetHelio - earthHelio
    // = planetHelio + sunGeoVec.
    // sunGeoVec = (sunHelio.r * cos(sunHelio.lon), sunHelio.r * sin(sunHelio.lon), 0)
    var sunVec = {
      x: sunHelio.r * Math.cos(sunHelio.lon * DEG),
      y: sunHelio.r * Math.sin(sunHelio.lon * DEG),
    };

    var PLANETS = ['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
    for (var i = 0; i < PLANETS.length; i++) {
      var name = PLANETS[i];
      var el = computeElements(ORBIT[name], d);
      var helio = heliocentric(el);
      // Geo = helio - earthHelio = helio + sunVec
      var gx = helio.x + sunVec.x;
      var gy = helio.y + sunVec.y;
      var gLon = rectGeoLon(gx, gy);
      result.push(makeEntry(name, gLon, dailyRate(name)));
    }

    return result;
  }

  // Rough daily motion (deg/day) of each body — used for "applying vs
  // separating" detection in aspects, and to hint retrograde.
  function dailyRate(name) {
    var table = {
      Sun: 0.986, Moon: 13.176,
      Mercury: 1.383, Venus: 1.602, Mars: 0.524,
      Jupiter: 0.083, Saturn: 0.034,
      Uranus: 0.012, Neptune: 0.006, Pluto: 0.004
    };
    return table[name] || 0;
  }

  function makeEntry(name, lon, speed) {
    lon = norm360(lon);
    var signIdx = Math.floor(lon / 30) % 12;
    return {
      name: name,
      longitude: lon,
      sign: ZODIAC_EN[signIdx],
      degree: lon - signIdx * 30,
      speed: speed,
    };
  }

  // ── Aspect detection ────────────────────────────────────────────
  // Ptolemaic five, with default orbs tuned for natal-vs-transit
  // relevance (tighter than natal-vs-natal).
  var ASPECTS = [
    { name: 'conjunction', angle:   0, orb: 8 },
    { name: 'sextile',     angle:  60, orb: 4 },
    { name: 'square',      angle:  90, orb: 6 },
    { name: 'trine',       angle: 120, orb: 6 },
    { name: 'opposition',  angle: 180, orb: 8 },
  ];

  // Importance weight per aspect (used when ranking a day's top aspects).
  var ASPECT_WEIGHT = {
    conjunction: 1.0, opposition: 0.9, square: 0.85,
    trine: 0.7, sextile: 0.55,
  };

  // Per-planet "importance" multiplier — Sun/Moon always interesting,
  // outer planets only when hitting personal bodies.
  var PLANET_WEIGHT = {
    Sun: 1.0, Moon: 1.0,
    Mercury: 0.8, Venus: 0.85, Mars: 0.85,
    Jupiter: 0.75, Saturn: 0.9,
    Uranus: 0.7, Neptune: 0.7, Pluto: 0.8,
    NorthNode: 0.5, Chiron: 0.6,
    Ascendant: 0.9, Midheaven: 0.85,
  };

  // Smallest angular distance between two ecliptic longitudes, in [0, 180].
  function angularDistance(a, b) {
    var d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  /**
   * Find aspects between transit positions and natal chart positions.
   *
   *   natalPlanets: [{ name, longitude }] from chartData.planets
   *   transits:     [{ name, longitude, speed }] from computeTransits()
   *   opts.maxOrb:  override orb cap (default uses per-aspect orbs)
   *
   * Returns aspects sorted by descending "relevance" = weight / (orb+0.5).
   */
  function findAspects(natalPlanets, transits, opts) {
    opts = opts || {};
    var out = [];
    if (!natalPlanets || !transits) return out;
    for (var i = 0; i < transits.length; i++) {
      var tr = transits[i];
      for (var j = 0; j < natalPlanets.length; j++) {
        var na = natalPlanets[j];
        if (typeof na.longitude !== 'number') continue;
        var dist = angularDistance(tr.longitude, na.longitude);
        for (var k = 0; k < ASPECTS.length; k++) {
          var asp = ASPECTS[k];
          var orb = Math.abs(dist - asp.angle);
          if (orb <= asp.orb) {
            var weight = (ASPECT_WEIGHT[asp.name] || 0.5)
                       * (PLANET_WEIGHT[tr.name]  || 0.5)
                       * (PLANET_WEIGHT[na.name]  || 0.5);
            var relevance = weight / (orb + 0.5);
            out.push({
              transit:  tr.name,
              natal:    na.name,
              type:     asp.name,
              orb:      Math.round(orb * 100) / 100,
              exact:    orb < 1,
              relevance: relevance,
              // transit speed > 0 closing distance → applying
              // (rough heuristic; ignores retrograde inflection)
              applying: (tr.speed || 0) > 0,
              transitLon: tr.longitude,
              natalLon:   na.longitude,
            });
            break; // only count the closest aspect per pair
          }
        }
      }
    }
    out.sort(function (a, b) { return b.relevance - a.relevance; });
    return out;
  }

  // ── Ascendant + Midheaven ───────────────────────────────────────
  // Meeus-style closed-form from LST + latitude. Good for ±0.1°
  // when the input time is known to the minute. Returns degrees.
  function computeAscMc(utcDate, latDeg, lonDeg) {
    var jdUt = utcDate.getTime() / 86400000 + 2440587.5;
    var T = (jdUt - 2451545.0) / 36525;
    var theta0 = 280.46061837 + 360.98564736629 * (jdUt - 2451545.0)
               + 0.000387933 * T * T - (T * T * T) / 38710000;
    var gmst = ((theta0 % 360) + 360) % 360;
    var lst = (((gmst + lonDeg) % 360) + 360) % 360;
    var lstR = lst * DEG;
    var latR = latDeg * DEG;

    // MC = atan2(sin LST, cos LST · cos ε)
    var mcR = Math.atan2(Math.sin(lstR), Math.cos(lstR) * Math.cos(OBLIQUITY));
    var mc = ((mcR / DEG) % 360 + 360) % 360;

    // Ascendant: tangent equation yields two solutions 180° apart.
    // Select the one in the rising semicircle (CCW: MC+90° → MC+270°).
    // This matches the chart convention Asc-at-9, MC-at-12 with zodiac
    // advancing CCW — the Ascendant is the ecliptic point where the
    // local meridian has already passed by a quarter of the day.
    var ascR = Math.atan2(-Math.cos(lstR),
                          Math.sin(lstR) * Math.cos(OBLIQUITY) + Math.tan(latR) * Math.sin(OBLIQUITY));
    var asc = ((ascR / DEG) % 360 + 360) % 360;
    var lo = (mc + 90) % 360;
    var hi = (mc + 270) % 360;
    var inRange = (lo < hi)
      ? (asc > lo && asc < hi)
      : (asc > lo || asc < hi);   // wraps 360→0
    if (!inRange) asc = (asc + 180) % 360;
    return { asc: asc, mc: mc, lst: lst };
  }
  var OBLIQUITY = 23.4392911 * DEG;

  // Also expose angular helpers so other modules can reuse them
  ns.Transits = {
    computeTransits: computeTransits,
    computeAscMc: computeAscMc,
    findAspects: findAspects,
    angularDistance: angularDistance,
    ASPECTS: ASPECTS,
    ZODIAC_EN: ZODIAC_EN,
  };
})();
