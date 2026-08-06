/*!
 * Luz Estelar — Sky Map (realistic celestial renderer)
 * ─────────────────────────────────────────────────────
 * Renders the ACTUAL sky as seen from a given location + time:
 *   - Stars positioned via equatorial → horizontal → stereographic
 *     projection from the observer's zenith (same transform used
 *     by Stellarium, planetarium software, etc.)
 *   - Constellation "stick figures" drawn from a curated catalog
 *   - Optionally: planet positions overlaid at their real sky
 *     locations for the given UTC moment (not zodiac-symbolic)
 *
 * Intentionally zero-dependency — pure vanilla ES5 so it lives in
 * an installed PWA without a build step, and the canvas render is
 * fast enough to re-draw on resize / date slider / drag.
 *
 * Usage:
 *   LuzEstelar.SkyMap.render(canvas, {
 *     lat: 25.6866,          // observer latitude  °N
 *     lng: -100.3161,        // observer longitude °E (west neg)
 *     utc: <Date or {y,m,d,h,min}>,
 *     stars: starCatalog.stars,            // [[id,name,ra,dec,mag,con,bayer]]
 *     constellations: constellations,      // [{id, name_es, lines:[[id,id]]}]
 *     planets: [                            // optional overlay
 *       {name:'Sol', ra: 10.5, dec: 5.2, color:'#FFD700'},
 *     ],
 *     size: 320,
 *     showLabels: true,
 *     zodiacRing: { focusSign: 'Leo' },    // optional: symbolic 12-band ring
 *     eclipticBand: { focusSign: 'Leo' },  // optional: REAL zodiac positions
 *     cardinals: {W:'W'},   // optional; defaults to Spanish (W → "O")
 *   });
 *
 * Source of truth for the astronomy:
 *   - Meeus, "Astronomical Algorithms" 2nd ed., ch 12 (Sidereal time)
 *     and ch 13 (transformation of coordinates)
 */
(function () {
  'use strict';

  var ns = (window.LuzEstelar = window.LuzEstelar || {});
  if (ns.SkyMap) return;

  // ── Constants ─────────────────────────────────────────────────
  var DEG = Math.PI / 180;
  var HR  = 15 * DEG;          // 1 RA hour = 15°
  var TAU = 2 * Math.PI;

  // ── Time helpers ──────────────────────────────────────────────
  /**
   * Julian Date from civil UTC date components.
   * Gregorian calendar assumed (valid for y >= 1583).
   */
  function julianDate(y, m, d, h, min, sec) {
    h = h || 0; min = min || 0; sec = sec || 0;
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    var jd = Math.floor(365.25 * (y + 4716))
           + Math.floor(30.6001 * (m + 1))
           + d + B - 1524.5;
    jd += (h + min / 60 + sec / 3600) / 24;
    return jd;
  }

  /**
   * Greenwich Mean Sidereal Time in hours [0,24). Meeus eq. 12.4.
   * Accurate to ~0.1 s of time — plenty for a 320px canvas.
   */
  function gmst(jd) {
    var T = (jd - 2451545.0) / 36525;
    // Seconds of time as decimal
    var theta0 = 280.46061837
               + 360.98564736629 * (jd - 2451545.0)
               + 0.000387933 * T * T
               - (T * T * T) / 38710000;
    // Normalize to [0, 360) then convert to hours
    theta0 = ((theta0 % 360) + 360) % 360;
    return theta0 / 15;
  }

  function localSiderealTime(jd, lngDeg) {
    var lst = gmst(jd) + lngDeg / 15;
    return ((lst % 24) + 24) % 24;
  }

  // ── Coordinate transforms ────────────────────────────────────
  /**
   * (RA hours, Dec deg) + observer (LST hours, Lat deg) → (Alt, Az) radians.
   * Azimuth measured from North, increasing East (0 = N, 90 = E, 180 = S, 270 = W).
   * Meeus eq. 13.5-13.6, with quadrant-safe atan2 form.
   */
  function equatorialToHorizontal(raH, decD, lstH, latD) {
    var H = (lstH - raH) * HR;      // hour angle (rad), west positive
    var dec = decD * DEG;
    var lat = latD * DEG;
    var sinLat = Math.sin(lat), cosLat = Math.cos(lat);
    var sinDec = Math.sin(dec), cosDec = Math.cos(dec);

    var sinAlt = sinLat * sinDec + cosLat * cosDec * Math.cos(H);
    var alt = Math.asin(sinAlt);

    // Meeus uses atan2 form for safe quadrant resolution:
    //   A = atan2(sin H, cos H sin φ − tan δ cos φ)   (from N, west positive)
    var y = Math.sin(H);
    var x = Math.cos(H) * sinLat - (cosLat === 0 ? 0 : Math.tan(dec) * cosLat);
    var A = Math.atan2(y, x);
    // Convert from "west of south" (Meeus convention) to "east of north":
    //   az = π + A   (mod 2π)
    var az = (Math.PI + A + TAU) % TAU;
    return { alt: alt, az: az };
  }

  /**
   * Stereographic projection from zenith onto 2D plane.
   * Input alt in radians; below-horizon stars are returned with r>1.
   * Output (x, y) is in unit disc: r = tan((π/2 − alt) / 2).
   * (−cos for y because screen-Y is inverted; north is up.)
   */
  function stereographicFromZenith(alt, az) {
    var zd = Math.PI / 2 - alt;
    var r  = Math.tan(zd / 2);
    return {
      x:  r * Math.sin(az),
      y: -r * Math.cos(az),
      r: r,
    };
  }

  // ── Ecliptic → Equatorial ────────────────────────────────────
  // For a given epoch (J2000 close enough for birth-chart PWA
  // plotting — no sub-arcminute accuracy needed), transform ecliptic
  // longitude to equatorial RA/Dec assuming zero latitude (planets
  // stay within ±8° of the ecliptic).
  var OBLIQUITY = 23.4392911 * DEG;

  function eclipticLonToEquatorial(lonDeg) {
    var lon = lonDeg * DEG;
    var sinLon = Math.sin(lon), cosLon = Math.cos(lon);
    var sinDec = Math.sin(OBLIQUITY) * sinLon;
    var dec = Math.asin(sinDec);
    var ra = Math.atan2(Math.cos(OBLIQUITY) * sinLon, cosLon);
    if (ra < 0) ra += TAU;
    return {
      ra: (ra / DEG) / 15,     // hours
      dec: dec / DEG,          // degrees
    };
  }

  /**
   * (RA hours, Dec deg) → (ecliptic lon deg, ecliptic lat deg).
   * Used for the geocentric natal-chart view: given a star's
   * equatorial coordinates, compute where it sits on the zodiac
   * band (ecl_lon 0..360) and how far above/below the ecliptic
   * plane (ecl_lat −90..+90).
   * Planets orbit near ecl_lat ≈ 0; zodiacal constellations are
   * within ±20° of it; polar constellations (Ursa Major, etc.)
   * can reach ±70°.
   */
  function equatorialToEcliptic(raHours, decDeg) {
    var ra  = raHours * HR;            // rad
    var dec = decDeg  * DEG;
    var sinDec = Math.sin(dec), cosDec = Math.cos(dec);
    var sinRA  = Math.sin(ra),  cosRA  = Math.cos(ra);
    var sinEps = Math.sin(OBLIQUITY), cosEps = Math.cos(OBLIQUITY);

    var sinLat = sinDec * cosEps - cosDec * sinEps * sinRA;
    var lat = Math.asin(sinLat);
    var lon = Math.atan2(sinRA * cosEps + Math.tan(dec) * sinEps, cosRA);
    if (lon < 0) lon += TAU;
    return {
      lon: lon / DEG,                  // degrees, 0..360
      lat: lat / DEG,                  // degrees, −90..+90
    };
  }

  // ── Sun & Moon ecliptic longitudes ───────────────────────────
  // Low-precision Meeus (ch. 25 abridged / main lunar term only):
  // Sun ±0.01°, Moon ±1° — más que de sobra para un punto en un canvas.
  // Con esto "Cielo de hoy" puede mostrar Sol y Luna sin efemérides del
  // servidor (2026-08-05, pedido del usuario: "ahorita lo tengo encima").
  function sunLongitude(jd) {
    var n = jd - 2451545.0;
    var L = 280.460 + 0.9856474 * n;
    var g = ((357.528 + 0.9856003 * n) % 360) * DEG;
    var lon = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
    return ((lon % 360) + 360) % 360;
  }

  function moonLongitude(jd) {
    var n = jd - 2451545.0;
    var L = 218.316 + 13.176396 * n;
    var M = ((134.963 + 13.064993 * n) % 360) * DEG;
    var lon = L + 6.289 * Math.sin(M);
    return ((lon % 360) + 360) % 360;
  }

  // ── Zodiac ring (Mapa Maestro, Fase 1) ───────────────────────
  // Same visual language as the aspect wheel in infographic_generator
  // (_build_aspect_wheel_html) and natal-chart.js: 12 equal 30° bands,
  // 0° Aries at 9 o'clock, signs running counterclockwise on screen,
  // glyphs forced to text presentation with U+FE0E (no emoji rendering).
  // The ring is SYMBOLIC longitude space — it frames the alt/az sky disc
  // with the brand wheel; it does not claim the sky under each band.
  var SIGN_GLYPHS = ['♈︎','♉︎','♊︎','♋︎',
                     '♌︎','♍︎','♎︎','♏︎',
                     '♐︎','♑︎','♒︎','♓︎'];
  var SIGN_NAMES = [
    ['aries','aries'], ['tauro','taurus'], ['geminis','gemini'],
    ['cancer','cancer'], ['leo','leo'], ['virgo','virgo'],
    ['libra','libra'], ['escorpio','scorpio'], ['sagitario','sagittarius'],
    ['capricornio','capricorn'], ['acuario','aquarius'], ['piscis','pisces'],
  ];

  function resolveSignIndex(v) {
    if (typeof v === 'number' && isFinite(v)) return ((Math.round(v) % 12) + 12) % 12;
    if (!v) return -1;
    var s = String(v).toLowerCase();
    // Deaccent (Géminis → geminis) without String.normalize dependency issues
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    for (var i = 0; i < 12; i++) {
      if (s === SIGN_NAMES[i][0] || s === SIGN_NAMES[i][1]) return i;
    }
    return -1;
  }

  // Ecliptic longitude (deg) → canvas point at radius r.
  // Matches the wheel convention: x = cx − r·cos, y = cy + r·sin.
  function ringPoint(cx, cy, lonDeg, r) {
    var rad = lonDeg * DEG;
    return { x: cx - r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // Canvas arc angle for an ecliptic longitude (see ringPoint): θ = π − lon.
  function ringAngle(lonDeg) { return Math.PI - lonDeg * DEG; }

  function drawZodiacRing(ctx, cx, cy, size, sizeFactor, ring) {
    var Rin  = size * 0.385;
    var Rout = size * 0.450;
    var Rg   = (Rin + Rout) / 2;         // glyph radius
    var focusIdx = resolveSignIndex(ring.focusSign);

    // Band edges — outer stronger, inner faint (mirrors the wheel's
    // R ring at 0.30 alpha + dashed inner ring)
    ctx.strokeStyle = 'rgba(212,168,73,0.30)';
    ctx.lineWidth = 1.6 * sizeFactor;
    ctx.beginPath(); ctx.arc(cx, cy, Rout, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(212,168,73,0.18)';
    ctx.lineWidth = 1.0 * sizeFactor;
    ctx.beginPath(); ctx.arc(cx, cy, Rin, 0, TAU); ctx.stroke();

    // Focused sign: filled annular wedge + brighter edges
    if (focusIdx >= 0) {
      var l1 = focusIdx * 30, l2 = l1 + 30;
      ctx.beginPath();
      ctx.arc(cx, cy, Rout, ringAngle(l1), ringAngle(l2), true);
      ctx.arc(cx, cy, Rin,  ringAngle(l2), ringAngle(l1), false);
      ctx.closePath();
      ctx.fillStyle = 'rgba(212,168,73,0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(212,168,73,0.55)';
      ctx.lineWidth = 1.4 * sizeFactor;
      ctx.stroke();
    }

    // Ticks every 30° spanning the band
    ctx.strokeStyle = 'rgba(212,168,73,0.35)';
    ctx.lineWidth = 1.4 * sizeFactor;
    for (var k = 0; k < 12; k++) {
      var a = ringPoint(cx, cy, k * 30, Rin);
      var b = ringPoint(cx, cy, k * 30, Rout);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Glyphs at each band's midpoint
    ctx.font = Math.round(size * 0.036) + 'px "Noto Sans Symbols 2", "Segoe UI Symbol", "Apple Symbols", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var g = 0; g < 12; g++) {
      var gp = ringPoint(cx, cy, g * 30 + 15, Rg);
      var gCol = (g === focusIdx) ? '#d4a849' : 'rgba(224,220,232,0.38)';
      ctx.fillStyle = gCol;
      var AGr = window.LuzEstelar && window.LuzEstelar.AstroGlyphs;
      if (!(AGr && AGr.draw(ctx, AGr.sign(g), gp.x, gp.y, size * 0.040, gCol))) {
        ctx.fillText(SIGN_GLYPHS[g], gp.x, gp.y);
      }
    }
  }

  // ── Ecliptic band (Mapa Maestro, Fase 1b) ────────────────────
  // Unlike the symbolic outer ring, this draws the zodiac where it
  // ACTUALLY crosses the sky at the given moment: the ecliptic great
  // circle projected onto the horizon view, split into its 12 sign
  // segments (ticks at each 30° boundary, glyph at the visible
  // midpoint of each segment). Answers "¿dónde estaba Virgo en el
  // cielo cuando nací?" — the honest version of the ring.
  function drawEclipticBand(ctx, cx, cy, R, size, sizeFactor, lst, lat, band) {
    var focusIdx = resolveSignIndex(band.focusSign);
    var STEP = 2;                       // sampling step in ecliptic lon (deg)
    var pts = [];                       // index = lon/STEP
    for (var lon = 0; lon <= 360; lon += STEP) {
      var eq = eclipticLonToEquatorial(lon % 360);
      var h = equatorialToHorizontal(eq.ra, eq.dec, lst, lat);
      var p = stereographicFromZenith(h.alt, h.az);
      pts.push({
        lon: lon,
        up: h.alt > 0 && p.r <= 1.0,
        x: cx + p.x * R,
        y: cy + p.y * R,
      });
    }

    function strokeSegment(fromLon, toLon, style, width, glow) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.save();
      if (glow) { ctx.shadowColor = 'rgba(212,168,73,0.8)'; ctx.shadowBlur = 6 * sizeFactor; }
      ctx.beginPath();
      var started = false;
      for (var i = fromLon / STEP; i <= toLon / STEP; i++) {
        var q = pts[i];
        if (!q.up) { started = false; continue; }
        if (!started) { ctx.moveTo(q.x, q.y); started = true; }
        else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Base line (all signs), then the focused sign re-stroked on top
    strokeSegment(0, 360, 'rgba(212,168,73,0.35)', 1.2 * sizeFactor, false);
    if (focusIdx >= 0) {
      strokeSegment(focusIdx * 30, focusIdx * 30 + 30, '#d4a849', 2.6 * sizeFactor, true);
    }

    // Boundary ticks every 30°, perpendicular to the local direction
    ctx.strokeStyle = 'rgba(212,168,73,0.55)';
    ctx.lineWidth = 1.4 * sizeFactor;
    for (var k = 0; k < 12; k++) {
      var bi = (k * 30) / STEP;
      var q0 = pts[bi];
      if (!q0 || !q0.up) continue;
      var qn = pts[bi + 1] && pts[bi + 1].up ? pts[bi + 1] : pts[bi - 1];
      if (!qn) continue;
      var dx = qn.x - q0.x, dy = qn.y - q0.y;
      var n = Math.sqrt(dx * dx + dy * dy) || 1;
      var tx = -dy / n, ty = dx / n;         // unit perpendicular
      var t = size * 0.012;
      ctx.beginPath();
      ctx.moveTo(q0.x - tx * t, q0.y - ty * t);
      ctx.lineTo(q0.x + tx * t, q0.y + ty * t);
      ctx.stroke();
    }

    // Glyph at the visible midpoint of each sign's segment, offset
    // radially outward (away from the disc center) so it clears the line
    ctx.font = Math.round(size * 0.03) + 'px "Noto Sans Symbols 2", "Segoe UI Symbol", "Apple Symbols", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var g = 0; g < 12; g++) {
      var vis = [];
      for (var j = (g * 30) / STEP; j <= (g * 30 + 30) / STEP; j++) {
        if (pts[j] && pts[j].up) vis.push(pts[j]);
      }
      if (vis.length < 3) continue;          // sign (almost) below horizon
      var mid = vis[(vis.length / 2) | 0];
      var rx = mid.x - cx, ry = mid.y - cy;
      var rn = Math.sqrt(rx * rx + ry * ry) || 1;
      var off = size * 0.028;
      var gx = mid.x + (rx / rn) * off;
      var gy = mid.y + (ry / rn) * off;
      var bCol = (g === focusIdx) ? '#d4a849' : 'rgba(224,220,232,0.55)';
      ctx.fillStyle = bCol;
      var AGb = window.LuzEstelar && window.LuzEstelar.AstroGlyphs;
      if (!(AGb && AGb.draw(ctx, AGb.sign(g), gx, gy, size * 0.034, bCol))) {
        ctx.fillText(SIGN_GLYPHS[g], gx, gy);
      }
    }
  }

  // ── Ascendant + house layer (Mapa Maestro, Fase 1c) ─────────
  // ASC = ecliptic longitude rising on the EASTERN horizon right now.
  // Found numerically on the same transforms the band uses (coarse 1°
  // sweep for the − → + altitude crossing on the east side, then 10
  // bisection steps → well under 0.01°, far below visual resolution).
  function computeAscendant(lst, lat) {
    function altAz(lon) {
      var eq = eclipticLonToEquatorial(((lon % 360) + 360) % 360);
      return equatorialToHorizontal(eq.ra, eq.dec, lst, lat);
    }
    // Note the direction: at the EASTERN crossing, altitude goes + → −
    // as lon increases (longitudes past the ASC haven't risen yet), so we
    // look for ANY sign change whose azimuth is on the east half.
    var prev = altAz(0);
    for (var lon = 1; lon <= 360; lon++) {
      var cur = altAz(lon);
      var azMid = cur.az / DEG;
      if ((prev.alt < 0) !== (cur.alt < 0) && azMid > 0 && azMid < 180) {
        var lo = lon - 1, hi = lon;
        var loNeg = prev.alt < 0;
        for (var i = 0; i < 10; i++) {
          var mid = (lo + hi) / 2;
          if ((altAz(mid).alt < 0) === loNeg) lo = mid; else hi = mid;
        }
        return ((lo + hi) / 2) % 360;
      }
      prev = cur;
    }
    return null;   // polar edge case: ecliptic never crosses the E horizon
  }

  // Equal-house cusps from the ASC, drawn ON the ecliptic curve so the
  // viewer sees where each house actually sat in their sky. Silver
  // (not gold) so the layer reads apart from the sign glyphs.
  function drawHouses(ctx, cx, cy, R, size, sizeFactor, lst, lat, housesOpt, drawGuide) {
    var asc = computeAscendant(lst, lat);
    if (asc === null) return;

    function project(lon) {
      var eq = eclipticLonToEquatorial(((lon % 360) + 360) % 360);
      var h = equatorialToHorizontal(eq.ra, eq.dec, lst, lat);
      if (h.alt <= 0) return null;
      var p = stereographicFromZenith(h.alt, h.az);
      if (p.r > 1.0) return null;
      return { x: cx + p.x * R, y: cy + p.y * R };
    }

    var SILVER = 'rgba(224,220,232,0.75)';

    // The cusps are marks ON the ecliptic. If the ecliptic layer isn't
    // drawing the curve, the houses layer draws its own faint guide —
    // otherwise the ticks float with nothing connecting them.
    if (drawGuide) {
      ctx.strokeStyle = 'rgba(224,220,232,0.22)';
      ctx.lineWidth = 1.1 * sizeFactor;
      ctx.beginPath();
      var started = false;
      for (var gl = 0; gl <= 360; gl += 2) {
        var gp = project(gl);
        if (!gp) { started = false; continue; }
        if (!started) { ctx.moveTo(gp.x, gp.y); started = true; }
        else ctx.lineTo(gp.x, gp.y);
      }
      ctx.stroke();
    }
    // Cusp markers: house k (1-12) starts at asc + 30·(k−1).
    // (Equal-house system; the zodiac runs BACKWARD from the ASC in
    // house order, i.e. cusp of house 2 = asc − 30... no: equal houses
    // ascend in ecliptic longitude: cusp_k = asc + 30(k−1).)
    for (var k = 0; k < 12; k++) {
      var lonC = asc + 30 * k;
      var q0 = project(lonC);
      if (!q0) continue;
      var q1 = project(lonC + 1.5) || project(lonC - 1.5);
      if (!q1) continue;
      var dx = q1.x - q0.x, dy = q1.y - q0.y;
      var n = Math.sqrt(dx * dx + dy * dy) || 1;
      var tx = -dy / n, ty = dx / n;
      var t = size * 0.018;                  // longer than sign ticks
      ctx.strokeStyle = SILVER;
      ctx.lineWidth = 1.6 * sizeFactor;
      ctx.beginPath();
      ctx.moveTo(q0.x - tx * t, q0.y - ty * t);
      ctx.lineTo(q0.x + tx * t, q0.y + ty * t);
      ctx.stroke();
      if (k === 0) {
        // Label the Ascendant itself
        var ax = q0.x + tx * (t + size * 0.02);
        var ay = q0.y + ty * (t + size * 0.02);
        ctx.fillStyle = SILVER;
        ctx.font = 'bold ' + Math.round(size * 0.024) + 'px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ASC', ax, ay);
      }
    }
    // House numbers at each house's midpoint, offset INWARD (toward the
    // disc center — sign glyphs live on the outward side, no collisions)
    ctx.fillStyle = 'rgba(224,220,232,0.6)';
    ctx.font = Math.round(size * 0.024) + 'px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var m = 0; m < 12; m++) {
      var q = project(asc + 30 * m + 15);
      if (!q) continue;
      var rx = cx - q.x, ry = cy - q.y;      // toward center
      var rn = Math.sqrt(rx * rx + ry * ry) || 1;
      var off = size * 0.026;
      ctx.fillText(String(m + 1), q.x + (rx / rn) * off, q.y + (ry / rn) * off);
    }
  }

  // ── Magnitude → pixel radius ─────────────────────────────────
  // Product parity (2026-08-05, pedido del usuario: "las estrellas se ven
  // falsas… lo quería como el mapa que ofrecemos a la venta"): same
  // continuous magnitude → radius/alpha mapping as
  // scripts/starmap_generator.py render_starmap():
  //   star_r = (6.0 − mag) · R / 600      alpha = clamp((6.0 − mag)·60, 80, 255)
  // Canvas draws float radii, so no int() floor. On small phone canvases
  // the print formula goes sub-pixel; a gentle boost keeps the map legible
  // at 320px while converging to exact product sizing as R grows.
  function starRadius(mag, horizonR) {
    var boost = Math.max(1, 1.9 - horizonR / 400);
    return Math.max(0.5, (6.0 - mag) * horizonR / 600 * boost);
  }

  function starAlpha(mag) {
    return Math.min(255, Math.max(80, (6.0 - mag) * 60)) / 255;
  }

  // ── Main render ───────────────────────────────────────────────
  function render(canvas, opts) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var parentW = canvas.parentElement && canvas.parentElement.offsetWidth;
    var size = opts.size || (parentW > 0 ? Math.min(parentW, 420) : 320);

    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
    ctx.scale(dpr, dpr);

    var cx = size / 2, cy = size / 2;
    // R shrunk so the N/S/E/O cardinal letters drawn at R + ~5.5%
    // always stay inside the canvas at any size. With the zodiac ring
    // enabled the horizon shrinks further to leave room for the band
    // (ring occupies 0.385–0.450 of size) and the cardinals move inside.
    var ring = opts.zodiacRing || null;
    var R = size * (ring ? 0.35 : 0.42); // horizon radius on canvas
    var sizeFactor = size / 320;         // relative to baseline

    // ── Parse UTC moment ──
    var u = opts.utc || new Date();
    var Y, M, D, H, MN, S;
    if (u instanceof Date) {
      Y = u.getUTCFullYear();
      M = u.getUTCMonth() + 1;
      D = u.getUTCDate();
      H = u.getUTCHours();
      MN = u.getUTCMinutes();
      S = u.getUTCSeconds();
    } else {
      Y = u.y; M = u.m; D = u.d;
      H = u.h || 0; MN = u.min || 0; S = u.sec || 0;
    }
    var jd  = julianDate(Y, M, D, H, MN, S);
    var lst = localSiderealTime(jd, opts.lng);
    var lat = opts.lat;

    // ── Background (deep space gradient) ──
    var bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    bg.addColorStop(0.00, 'rgba(14,14,44,1)');
    bg.addColorStop(0.70, 'rgba(8,8,28,1)');
    bg.addColorStop(1.00, 'rgba(3,3,14,1)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();

    // Subtle Milky Way band hint — a soft gradient across from
    // roughly galactic-center direction to the opposite side.
    // For now: a static diagonal glow. Proper band in Phase 6.3.
    var mwGrad = ctx.createLinearGradient(cx - R, cy - R * 0.6, cx + R, cy + R * 0.6);
    mwGrad.addColorStop(0.0,  'rgba(255,255,255,0)');
    mwGrad.addColorStop(0.45, 'rgba(160,180,220,0.05)');
    mwGrad.addColorStop(0.55, 'rgba(160,180,220,0.05)');
    mwGrad.addColorStop(1.0,  'rgba(255,255,255,0)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.fillStyle = mwGrad;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    // ── Horizon circle ──
    ctx.strokeStyle = 'rgba(212,168,73,0.42)';
    ctx.lineWidth = 1.2 * sizeFactor;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();

    // ── Zodiac ring (drawn before cardinals so letters paint on top) ──
    if (ring) drawZodiacRing(ctx, cx, cy, size, sizeFactor, ring);

    // ── Cardinal letters (N/S/E/W) ──
    if (opts.showCardinal !== false) {
      ctx.fillStyle = ring ? 'rgba(212,168,73,0.55)' : 'rgba(212,168,73,0.78)';
      ctx.font = 'bold ' + Math.round(size * (ring ? 0.028 : 0.035)) + 'px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Offset = half-font so the letter sits *outside* the horizon
      // circle with a comfortable gap yet never exceeds the canvas.
      // With the ring on, the letters move just INSIDE the horizon edge
      // (the outside gap now belongs to the band).
      var off = ring ? R - size * 0.045 : R + size * 0.04;
      // Letters default to Spanish (W = "O" de Oeste) so existing callers
      // keep their output; pass opts.cardinals to localize, e.g. the EN
      // pages send { W: 'W' }.
      var card = opts.cardinals || {};
      ctx.fillText(card.N || 'N', cx, cy - off);
      ctx.fillText(card.S || 'S', cx, cy + off);
      ctx.fillText(card.E || 'E', cx + off, cy);
      ctx.fillText(card.W || 'O', cx - off, cy);
    }

    // ── Project every star, cache by id ──
    var projected = {};              // id → { x, y, mag, name, con, bayer }
    var stars = opts.stars || [];
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sid, sname, ra, dec, mag, con, bayer;
      if (Array.isArray(s)) {
        // Compact array form: [id, name, ra, dec, mag, con, bayer]
        sid = s[0]; sname = s[1]; ra = s[2]; dec = s[3]; mag = s[4]; con = s[5]; bayer = s[6];
      } else {
        sid = s.id; sname = s.name; ra = s.ra; dec = s.dec; mag = s.mag; con = s.con; bayer = s.bayer;
      }
      var h = equatorialToHorizontal(ra, dec, lst, lat);
      if (h.alt < -0.01) continue;    // below horizon (with tiny slop)
      var p = stereographicFromZenith(h.alt, h.az);
      if (p.r > 1.02) continue;       // numerical safety
      projected[sid] = {
        x: cx + p.x * R,
        y: cy + p.y * R,
        mag: mag,
        name: sname,
        con: con,
        bayer: bayer,
        alt: h.alt / DEG,             // altitude in degrees (for info card)
        az:  h.az  / DEG,             // azimuth in degrees
      };
    }

    // ── Constellation stick figures ──
    // Product parity: starmap_generator draws these at gold alpha 40/255.
    ctx.strokeStyle = 'rgba(212,168,73,0.17)';
    ctx.lineWidth = 0.9 * sizeFactor;
    ctx.lineCap = 'round';
    var constellations = opts.constellations || [];
    for (var ci = 0; ci < constellations.length; ci++) {
      var c = constellations[ci];
      var lines = c.lines || [];
      for (var li = 0; li < lines.length; li++) {
        var a = projected[lines[li][0]];
        var b = projected[lines[li][1]];
        if (!a || !b) continue;      // one endpoint below horizon
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // ── Ecliptic band (real zodiac positions; under the stars so the
    // star field stays crisp on top) ──
    if (opts.eclipticBand) {
      drawEclipticBand(ctx, cx, cy, R, size, sizeFactor, lst, lat, opts.eclipticBand);
    }

    // ── Houses (equal-house from the ASC, separate layer) ──
    if (opts.houses) {
      drawHouses(ctx, cx, cy, R, size, sizeFactor, lst, lat, opts.houses,
                 !opts.eclipticBand);
    }

    // ── Constellation name labels (product style: VIRGO, OSA MAYOR…) ──
    if (opts.constellationLabels) {
      // Product parity: names at gold alpha ~100/255, quiet like the print
      ctx.fillStyle = 'rgba(212,168,73,0.45)';
      ctx.font = Math.round(size * 0.024) + 'px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var cli = 0; cli < constellations.length; cli++) {
        var cl = constellations[cli];
        var clPts = [];
        for (var clj = 0; clj < (cl.lines || []).length; clj++) {
          var ca = projected[cl.lines[clj][0]];
          var cb = projected[cl.lines[clj][1]];
          if (ca) clPts.push(ca);
          if (cb) clPts.push(cb);
        }
        if (clPts.length < 4) continue;      // mostly below horizon → skip
        var clx = 0, cly = 0;
        for (var clk = 0; clk < clPts.length; clk++) { clx += clPts[clk].x; cly += clPts[clk].y; }
        ctx.fillText((cl.name_es || cl.id).toUpperCase(),
                     clx / clPts.length, cly / clPts.length);
      }
    }

    // ── Stars ──
    var ids = Object.keys(projected);
    // Crisp dots like the printed product — no glow blobs (they made the
    // sky read as "puntos que pusimos nosotros" instead of a real sky).
    for (var k = 0; k < ids.length; k++) {
      var pr = projected[ids[k]];
      var rad = starRadius(pr.mag, R);
      ctx.fillStyle = 'rgba(255,255,255,' + starAlpha(pr.mag).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, rad, 0, TAU);
      ctx.fill();
    }

    // ── Named-star labels (top 8 brightest visible) ──
    // Collision-avoidance: if a candidate label's bounding box would
    // overlap one we've already placed, try simple alternative anchors
    // (right → left → above → below). If none clear, skip the label
    // entirely — a missed name is less jarring than two overlapping
    // names on top of each other. Before this pass the Gemelos/Cástor/
    // Pólux cluster near the zenith would stack its three names in a
    // single illegible blob.
    if (opts.showLabels !== false) {
      var visible = ids.map(function (id) { return projected[id]; })
                       .sort(function (a, b) { return a.mag - b.mag; })
                       .slice(0, 8);
      ctx.font = Math.round(size * 0.028) + 'px Inter, sans-serif';
      ctx.textBaseline = 'middle';
      // Padding bumped 0.010 → 0.018 so nearby labels keep visible
      // breathing room (the old tightness let "Hadar" sit atop the
      // "Rigil Kentaurus" label when the two stars were close on screen).
      var pad  = size * 0.018;           // padding around the text box
      var lineH = size * 0.028;
      var gap  = size * 0.020;           // offset from the star dot
      var placed = [];                   // [{x,y,w,h}] already-drawn boxes
      var dots = [];                     // star dot positions we've already labelled
      var dotR = size * 0.012;           // effective radius for "dot collides with box" check
      function boxOverlaps(b) {
        for (var pi = 0; pi < placed.length; pi++) {
          var p = placed[pi];
          if (b.x < p.x + p.w && b.x + b.w > p.x &&
              b.y < p.y + p.h && b.y + b.h > p.y) return true;
        }
        // Also reject a candidate box that would sit on top of a
        // previously-labelled star's dot — prevents labels covering
        // the star they're NOT naming (e.g. Hadar's label blanketing
        // the Rigil Kentaurus glyph).
        for (var di = 0; di < dots.length; di++) {
          var dx0 = dots[di];
          if (dx0.x + dotR > b.x && dx0.x - dotR < b.x + b.w &&
              dx0.y + dotR > b.y && dx0.y - dotR < b.y + b.h) return true;
        }
        return false;
      }
      // The candidate anchors above only avoided *other* labels, never the
      // edge of the canvas, so a star near the rim took the first anchor
      // and had its name cut off ("Arcturus" → "Arcturu"). Requiring the
      // padded box to fit inside the size×size logical space makes such a
      // star fall through to the opposite-side anchor on its own.
      function boxInBounds(b) {
        return b.x >= 0 && b.y >= 0 &&
               b.x + b.w <= size && b.y + b.h <= size;
      }
      // The anchor only fixes where the TEXT is drawn; the padding around
      // it is what the collision test actually reserves. Deriving the box
      // here lets the same anchor be retried with a tighter margin.
      function boxFor(c, p, tw) {
        var bx = c.align === 'right'  ? c.x - tw - p
               : c.align === 'center' ? c.x - tw / 2 - p
               :                        c.x - p;
        return { x: bx, y: c.y - lineH / 2 - p, w: tw + p * 2, h: lineH + p * 2 };
      }
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      for (var vi = 0; vi < visible.length; vi++) {
        var v = visible[vi];
        var textW = ctx.measureText(v.name).width;
        // Candidate anchors, each with its own textAlign. We try them
        // in priority order (right → left → above → below → above-right → above-left).
        var candidates = [
          { align: 'left',   x: v.x + gap,       y: v.y },
          { align: 'right',  x: v.x - gap,       y: v.y },
          { align: 'center', x: v.x,             y: v.y - gap * 1.3 },
          { align: 'center', x: v.x,             y: v.y + gap * 1.3 },
          { align: 'left',   x: v.x + gap * 0.7, y: v.y - gap * 1.0 },
          { align: 'right',  x: v.x - gap * 0.7, y: v.y - gap * 1.0 }
        ];
        // Two passes over the same anchors. The first uses the normal
        // padding. If every anchor is taken, a second pass retries with a
        // tighter margin rather than dropping the name: the padding is
        // only breathing room, so the glyphs themselves still never touch.
        // 0.75 comes from measuring 0.30/0.45/0.60/0.75/0.90 over 1440
        // renders (5 latitudes x 4 sizes x 72 times). Tighter factors
        // recover more names but start displacing labels that were already
        // placed; 0.75 recovers 194 with zero displacement and leaves the
        // closest two labels 8.27px apart vs 9.44px today. Text-on-text
        // overlap stays at zero for every factor tested.
        var chosen = null;
        var passes = [pad, pad * 0.75];
        for (var pi2 = 0; pi2 < passes.length && !chosen; pi2++) {
          for (var ci2 = 0; ci2 < candidates.length; ci2++) {
            var box = boxFor(candidates[ci2], passes[pi2], textW);
            if (!boxOverlaps(box) && boxInBounds(box)) {
              chosen = { c: candidates[ci2], box: box };
              break;
            }
          }
        }
        if (!chosen) continue;                 // skip rather than collide
        placed.push(chosen.box);
        dots.push({ x: v.x, y: v.y });
        ctx.textAlign = chosen.c.align;
        ctx.fillText(v.name, chosen.c.x, chosen.c.y);
      }
    }

    // ── Planet overlay (optional) ──
    var planets = opts.planets || [];
    for (var pi = 0; pi < planets.length; pi++) {
      var pl = planets[pi];
      var pra, pdec;
      if (pl.ra !== undefined && pl.dec !== undefined) {
        pra = pl.ra; pdec = pl.dec;
      } else if (pl.longitude !== undefined) {
        // Ecliptic longitude from natal_chart → RA/Dec
        var eq = eclipticLonToEquatorial(pl.longitude);
        pra = eq.ra; pdec = eq.dec;
      } else continue;

      var ph = equatorialToHorizontal(pra, pdec, lst, lat);
      if (ph.alt < -0.01) continue;
      var pp = stereographicFromZenith(ph.alt, ph.az);
      if (pp.r > 1.02) continue;
      var px = cx + pp.x * R;
      var py = cy + pp.y * R;

      // Gold halo so planets read above the star field
      var phalo = ctx.createRadialGradient(px, py, 0, px, py, size * 0.026);
      phalo.addColorStop(0.00, pl.color || 'rgba(212,168,73,0.9)');
      phalo.addColorStop(1.00, 'rgba(212,168,73,0)');
      ctx.fillStyle = phalo;
      ctx.beginPath();
      ctx.arc(px, py, size * 0.026, 0, TAU);
      ctx.fill();

      ctx.fillStyle = pl.color || '#d4a849';
      ctx.beginPath();
      ctx.arc(px, py, 3 * sizeFactor, 0, TAU);
      ctx.fill();

      var AGp = window.LuzEstelar && window.LuzEstelar.AstroGlyphs;
      var pKey = AGp && pl.name && AGp.planet(pl.name);
      if (pKey && AGp.draw(ctx, pKey, px, py, size * 0.034, '#06061a')) {
        /* glifo exacto dibujado */
      } else if (pl.symbol) {
        ctx.fillStyle = '#06061a';
        ctx.font = 'bold ' + Math.round(size * 0.028) + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pl.symbol, px, py);
      } else if (pl.name) {
        ctx.fillStyle = pl.color || '#d4a849';
        ctx.font = 'bold ' + Math.round(size * 0.026) + 'px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(pl.name, px + size * 0.015, py);
      }
    }

    // ── Marca de agua (producto no-Plus) ──
    // Vive AQUÍ y no en la página porque el contexto sigue escalado por
    // devicePixelRatio al terminar el render: quien la dibujara afuera
    // usando canvas.width (píxeles de dispositivo) la mandaba fuera del
    // lienzo en pantallas retina — es decir, los usuarios gratis recibían
    // el mapa SIN marca. Aquí las unidades son las mismas que el resto
    // del dibujo (`size`), así que siempre queda centrada.
    if (opts.watermark) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 8);
      ctx.font = '600 ' + Math.round(size / 8.5) +
                 'px "Cormorant Garamond", Georgia, serif';
      ctx.fillStyle = 'rgba(212,168,73,0.14)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.watermark === true ? 'LUZ ESTELAR' : opts.watermark, 0, 0);
      ctx.restore();
    }

    // ── Hit regions for tap-to-identify ──
    // Saved on the canvas so click handlers outside this file can
    // nearest-match against them. Two types:
    //   type: 'star'         — single point, r scales with magnitude
    //   type: 'constellation' — centroid of its visible stars + radius
    //                           covering them (so taps anywhere within
    //                           the drawn stick figure register)
    var hitRegions = [];
    var starIds = Object.keys(projected);
    for (var si = 0; si < starIds.length; si++) {
      var sp = projected[starIds[si]];
      // Bigger hit target than the visible dot — finger-friendly.
      var hitR = Math.max(starRadius(sp.mag, R) * 2.2, size * 0.018);
      hitRegions.push({
        type: 'star',
        id:   starIds[si],
        name: sp.name,
        con:  sp.con,
        bayer: sp.bayer,
        mag:  sp.mag,
        alt:  sp.alt,
        az:   sp.az,
        x: sp.x, y: sp.y, r: hitR,
      });
    }
    for (var cj = 0; cj < constellations.length; cj++) {
      var cc = constellations[cj];
      // Collect projected stars that belong to this constellation's lines.
      var visPts = [];
      for (var lj = 0; lj < (cc.lines || []).length; lj++) {
        var aa = projected[cc.lines[lj][0]];
        var bb = projected[cc.lines[lj][1]];
        if (aa) visPts.push(aa);
        if (bb) visPts.push(bb);
      }
      if (visPts.length < 2) continue;   // need at least a pair to have drawn any line
      // Centroid + max-distance radius → bounding circle containing
      // every drawn star of the constellation.
      var mx = 0, my = 0;
      for (var mi = 0; mi < visPts.length; mi++) { mx += visPts[mi].x; my += visPts[mi].y; }
      mx /= visPts.length; my /= visPts.length;
      var maxD = 0;
      for (var di2 = 0; di2 < visPts.length; di2++) {
        var ddx = visPts[di2].x - mx, ddy = visPts[di2].y - my;
        var dd = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dd > maxD) maxD = dd;
      }
      hitRegions.push({
        type: 'constellation',
        id:   cc.id,
        name_es: cc.name_es,
        name_en: cc.name_en,
        starCount: visPts.length / 2 | 0,  // rough "# visible stars in figure"
        x: mx, y: my, r: maxD + size * 0.02,
      });
    }
    canvas._hitRegions = hitRegions;
  }

  /**
   * Hit-test: returns the best-matching region under (x,y), prioritising
   * stars (small precise targets) over constellations (large background
   * regions). A tap within a star's radius always wins; otherwise the
   * closest-containing constellation wins.
   */
  function hitTest(canvas, x, y) {
    var regions = canvas && canvas._hitRegions;
    if (!regions || !regions.length) return null;
    var bestStar = null, bestStarD = Infinity;
    var bestCon  = null, bestConD  = Infinity;
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i];
      var dx = x - r.x, dy = y - r.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > r.r) continue;
      if (r.type === 'star') {
        if (d < bestStarD) { bestStar = r; bestStarD = d; }
      } else if (r.type === 'constellation') {
        if (d < bestConD)  { bestCon  = r; bestConD  = d; }
      }
    }
    return bestStar || bestCon || null;
  }

  // Expose everything useful
  ns.SkyMap = {
    render: render,
    hitTest: hitTest,
    julianDate: julianDate,
    sunLongitude: sunLongitude,
    moonLongitude: moonLongitude,
    localSiderealTime: localSiderealTime,
    equatorialToHorizontal: equatorialToHorizontal,
    equatorialToEcliptic: equatorialToEcliptic,
    stereographicFromZenith: stereographicFromZenith,
    eclipticLonToEquatorial: eclipticLonToEquatorial,
    OBLIQUITY: OBLIQUITY,
  };
})();
