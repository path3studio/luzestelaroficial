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

  // ── Magnitude → pixel radius ─────────────────────────────────
  function starRadius(mag, sizeFactor) {
    var r;
    if      (mag <= -0.5) r = 3.6;
    else if (mag <=  0.5) r = 2.8;
    else if (mag <=  1.5) r = 2.2;
    else if (mag <=  2.5) r = 1.6;
    else if (mag <=  3.5) r = 1.1;
    else                  r = 0.8;
    return r * sizeFactor;
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
    var R = size * 0.45;                 // horizon radius on canvas
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

    // ── Cardinal letters (N/S/E/W) ──
    if (opts.showCardinal !== false) {
      ctx.fillStyle = 'rgba(212,168,73,0.78)';
      ctx.font = 'bold ' + Math.round(size * 0.038) + 'px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var off = R + size * 0.045;
      ctx.fillText('N', cx, cy - off);
      ctx.fillText('S', cx, cy + off);
      ctx.fillText('E', cx + off, cy);
      ctx.fillText('O', cx - off, cy);   // Oeste (Spanish)
    }

    // ── Project every star, cache by id ──
    var projected = {};              // id → { x, y, mag, name, con }
    var stars = opts.stars || [];
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sid, sname, ra, dec, mag, con;
      if (Array.isArray(s)) {
        // Compact array form: [id, name, ra, dec, mag, con, bayer]
        sid = s[0]; sname = s[1]; ra = s[2]; dec = s[3]; mag = s[4]; con = s[5];
      } else {
        sid = s.id; sname = s.name; ra = s.ra; dec = s.dec; mag = s.mag; con = s.con;
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
      };
    }

    // ── Constellation stick figures ──
    ctx.strokeStyle = 'rgba(212,168,73,0.32)';
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

    // ── Stars ──
    var ids = Object.keys(projected);
    for (var k = 0; k < ids.length; k++) {
      var pr = projected[ids[k]];
      var rad = starRadius(pr.mag, sizeFactor);

      // Soft halo for the very bright ones — gives the stars "presence"
      if (pr.mag <= 1.2) {
        var glow = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, rad * 3.5);
        glow.addColorStop(0.00, 'rgba(255,245,210,0.55)');
        glow.addColorStop(0.55, 'rgba(255,245,210,0.12)');
        glow.addColorStop(1.00, 'rgba(255,245,210,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, rad * 3.5, 0, TAU);
        ctx.fill();
      }

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, rad, 0, TAU);
      ctx.fill();
    }

    // ── Named-star labels (top 8 brightest visible) ──
    if (opts.showLabels !== false) {
      var visible = ids.map(function (id) { return projected[id]; })
                       .sort(function (a, b) { return a.mag - b.mag; })
                       .slice(0, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = Math.round(size * 0.028) + 'px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (var vi = 0; vi < visible.length; vi++) {
        var v = visible[vi];
        ctx.fillText(v.name, v.x + size * 0.016, v.y);
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

      if (pl.symbol) {
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
  }

  // Expose everything useful
  ns.SkyMap = {
    render: render,
    julianDate: julianDate,
    localSiderealTime: localSiderealTime,
    equatorialToHorizontal: equatorialToHorizontal,
    stereographicFromZenith: stereographicFromZenith,
    eclipticLonToEquatorial: eclipticLonToEquatorial,
  };
})();
