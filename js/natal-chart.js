/**
 * natal-chart.js — Interactive Natal Chart Wheel Renderer
 * ========================================================
 * Renders a zodiac wheel on a <canvas> element with planets, houses, and aspects.
 * Pure vanilla JS, no dependencies.
 *
 * v2 — Improvements:
 *  - Approximate Moon position calculation
 *  - Removed fake ascendant (only draws ASC when ascendantVerified flag is set)
 *  - Vivid element-based zodiac colors
 *  - Radial gradient background, tick marks, golden Sun glow
 *  - Decorative center pattern
 */

(function(global) {
  'use strict';

  // Zodiac glyphs with U+FE0E (Variation Selector-15) to force text presentation
  // instead of colored emoji rendering on mobile (iOS/Android default to emoji font otherwise).
  var SIGN_GLYPHS = ['\u2648\uFE0E','\u2649\uFE0E','\u264A\uFE0E','\u264B\uFE0E','\u264C\uFE0E','\u264D\uFE0E','\u264E\uFE0E','\u264F\uFE0E','\u2650\uFE0E','\u2651\uFE0E','\u2652\uFE0E','\u2653\uFE0E'];
  var SIGN_NAMES  = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  // Short labels used inside the zodiac band (3 chars so the tight band
  // width works at any canvas size). Default = Spanish; override via
  // opts.signLabels for other locales.
  var SIGN_ABBR_ES = ['ARI','TAU','GÉM','CÁN','LEO','VIR','LIB','ESC','SAG','CAP','ACU','PIS'];

  // Vivid element-based colors for each sign
  var ELEMENT_COLORS_VIVID = {
    Fire:  '#e53935',  // red
    Earth: '#43a047',  // green
    Air:   '#1e88e5',  // blue
    Water: '#00acc1'   // teal/cyan
  };
  var ELEMENTS = ['Fire','Earth','Air','Water','Fire','Earth','Air','Water','Fire','Earth','Air','Water'];

  // Per-sign colors derived from element
  var SIGN_COLORS = ELEMENTS.map(function(el) { return ELEMENT_COLORS_VIVID[el]; });

  // Planet glyphs with U+FE0E to force text presentation (avoids emoji rendering on mobile).
  var PLANET_GLYPHS = {
    Sun:'\u2609\uFE0E', Moon:'\u263D\uFE0E', Mercury:'\u263F\uFE0E', Venus:'\u2640\uFE0E', Mars:'\u2642\uFE0E',
    Jupiter:'\u2643\uFE0E', Saturn:'\u2644\uFE0E', Uranus:'\u2645\uFE0E', Neptune:'\u2646\uFE0E', Pluto:'\u2647\uFE0E',
    NorthNode:'\u260A\uFE0E', Chiron:'\u26B7\uFE0E'
  };
  var PLANET_COLORS = {
    Sun:'#FFD700', Moon:'#b8c4e0', Mercury:'#00CED1', Venus:'#DA70D6', Mars:'#FF4500',
    Jupiter:'#9400D3', Saturn:'#708090', Uranus:'#00CED1', Neptune:'#1E90FF', Pluto:'#8B0000',
    NorthNode:'#888', Chiron:'#A0522D'
  };
  // 2026-04-29: Spanish 3-letter abbreviations for planet labels.
  // Used in geocentric mode (daily chart) below each planet sphere so the
  // viewer can identify "Mar 12°" without a legend. Tight enough to fit
  // even when planets cluster in same sign.
  var PLANET_ABBR_ES = {
    Sun: 'Sol',  Moon: 'Lun', Mercury: 'Mer', Venus: 'Ven', Mars: 'Mar',
    Jupiter: 'Jup', Saturn: 'Sat', Uranus: 'Ura', Neptune: 'Nep', Pluto: 'Plu',
    NorthNode: 'NN', Chiron: 'Chi'
  };
  // 2026-04-29 sign-focus mode: per-sign daily charts. Maps the sign
  // name (Spanish OR English — both forms supported) to its primary
  // ruling planet. Used when `opts.signFocus = "Aries"` to:
  //   1. Brighten the sign's segment of the zodiac band
  //   2. Apply a halo glow on its ruling planet
  //   3. Dim other planets/aspects slightly so attention stays on focus
  var SIGN_RULERS = {
    Aries: 'Mars', Taurus: 'Venus', Tauro: 'Venus', Gemini: 'Mercury',
    'Géminis': 'Mercury', Geminis: 'Mercury', Cancer: 'Moon', 'Cáncer': 'Moon',
    Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Pluto',
    Escorpio: 'Pluto', Sagittarius: 'Jupiter', Sagitario: 'Jupiter',
    Capricorn: 'Saturn', Capricornio: 'Saturn', Aquarius: 'Uranus',
    Acuario: 'Uranus', Pisces: 'Neptune', Piscis: 'Neptune',
  };
  // Map Spanish sign name → English (canonical) for index lookup
  var SIGN_NAME_ES_TO_EN = {
    Aries: 'Aries', Tauro: 'Taurus', 'Géminis': 'Gemini', Geminis: 'Gemini',
    'Cáncer': 'Cancer', Cancer: 'Cancer', Leo: 'Leo', Virgo: 'Virgo',
    Libra: 'Libra', Escorpio: 'Scorpio', Sagitario: 'Sagittarius',
    Capricornio: 'Capricorn', Acuario: 'Aquarius', Piscis: 'Pisces',
  };

  // Realistic painted spheres — radial gradients with a top-left light
  // source. Ported from infographic_generator.py so both the still-image
  // infographics and the live canvas chart show the same planets.
  // Each entry is [light → shadow color stops], rendered with the light
  // source at ~30% x, 28% y of the circle.
  var PLANET_SPHERES = {
    Sun:     ['#fff8e0','#ffe040','#f0b020','#d08010','#a05008','#703000'],
    Moon:    ['#f0ece0','#d8d0c0','#b0a898','#888078','#585050','#383030'],
    Mercury: ['#c8c0b8','#a89888','#887868','#685848','#484038','#302820'],
    Venus:   ['#f8f0d8','#e8d8a8','#d0c088','#b8a068','#987848','#705830'],
    Mars:    ['#e8a878','#d07848','#c05830','#a04020','#802818','#501008'],
    Jupiter: ['#f0d8b0','#d8b888','#c8a068','#b08848','#987038','#504018'],
    Saturn:  ['#f0e0c0','#d8c898','#c0b078','#a89060','#887048','#604828'],
    Uranus:  ['#c0e8e8','#80c8d0','#58a8b8','#3888a0','#206880','#104858'],
    Neptune: ['#90b8e8','#5888d0','#3868b8','#2050a0','#103880','#082058'],
    Pluto:   ['#c8b8a8','#a89080','#887060','#685040','#483828','#302018']
  };

  // Soft outer-glow color per planet (for the halo behind the sphere).
  var PLANET_HALOS = {
    Sun:     'rgba(255,200,50,0.50)',
    Moon:    'rgba(200,210,230,0.32)',
    Mercury: 'rgba(160,140,120,0.25)',
    Venus:   'rgba(220,200,140,0.32)',
    Mars:    'rgba(200,100,50,0.38)',
    Jupiter: 'rgba(200,160,100,0.32)',
    Saturn:  'rgba(200,180,120,0.32)',
    Uranus:  'rgba(100,180,200,0.30)',
    Neptune: 'rgba(60,100,200,0.36)',
    Pluto:   'rgba(140,120,100,0.22)'
  };

  /**
   * Paint a realistic 3D-looking planet sphere at (x, y) with given radius.
   * Uses a 6-stop radial gradient (light-to-shadow) plus an outer halo.
   * Falls back to a flat fill if the name isn't in the sphere table.
   */
  function drawPlanetSphere(ctx, x, y, r, name) {
    var stops = PLANET_SPHERES[name];
    var halo  = PLANET_HALOS[name];
    if (!stops) {
      ctx.fillStyle = PLANET_COLORS[name] || '#fff';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      return;
    }

    // Outer halo
    if (halo) {
      var hg = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4);
      hg.addColorStop(0.0, halo);
      hg.addColorStop(1.0, halo.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
    }

    // Sphere gradient — light source top-left, offset inward
    var lx = x - r * 0.38, ly = y - r * 0.42;
    var g = ctx.createRadialGradient(lx, ly, r * 0.05, x, y, r);
    g.addColorStop(0.00, stops[0]);
    g.addColorStop(0.15, stops[1]);
    g.addColorStop(0.35, stops[2]);
    g.addColorStop(0.55, stops[3]);
    g.addColorStop(0.75, stops[4]);
    g.addColorStop(1.00, stops[5]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();

    // Saturn rings — drawn as a thin ellipse across the sphere
    if (name === 'Saturn') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.35);                        // slight tilt
      ctx.strokeStyle = 'rgba(240,220,170,0.75)';
      ctx.lineWidth = Math.max(0.9, r * 0.14);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.65, r * 0.42, 0, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = Math.max(0.5, r * 0.06);
      ctx.strokeStyle = 'rgba(255,240,200,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.85, r * 0.48, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  // On mobile canvases the saturated magenta Venus (#DA70D6) and deep
  // purple Jupiter (#9400D3) read as harsh lilac/violet blobs against
  // the cosmic background — same colors desaturated slightly blend
  // better at small sizes while staying recognizable. Desktop keeps
  // the vivid palette because the wheel is bigger and the colors
  // don't overwhelm at that scale.
  function getPlanetColor(name, size) {
    if (size < 500) {
      if (name === 'Venus')   return '#c4a8d8';
      if (name === 'Jupiter') return '#a88cc8';
    }
    return PLANET_COLORS[name] || '#fff';
  }

  // Aspect styles for the natal "spider web" drawn inside the planet
  // ring. Each entry carries the colour, a visual weight (hard aspects
  // of conjunction/square/opposition more prominent than soft
  // trine/sextile), and the base alpha. The hard aspects define the
  // chart's tension; the soft ones describe its ease. Visible
  // hierarchy in the ink matches the interpretive weight.
  // Aspect style keys include BOTH English (client-side transits
  // calculator) and Spanish (pipeline calculate_natal_chart() emits
  // localised strings: "Conjunción", "Oposición", "Cuadratura",
  // "Trígono", "Sextil"). Without the Spanish keys natal aspects fall
  // through ASPECT_STYLES[undefined] and never render — which was the
  // silent bug that hid the natal spider web for the entire v48 series.
  var ASPECT_STYLES = {
    conjunction: {color:'#f4c88a', dash:[],    angle:0,   weight: 1.25, alpha: 0x88},
    opposition:  {color:'#ff5a5a', dash:[7,4], angle:180, weight: 1.25, alpha: 0x88},
    square:      {color:'#ff8a4a', dash:[],    angle:90,  weight: 1.10, alpha: 0x77},
    trine:       {color:'#5dd07a', dash:[],    angle:120, weight: 0.95, alpha: 0x55},
    sextile:     {color:'#6fc4d4', dash:[3,3], angle:60,  weight: 0.75, alpha: 0x44},
    // Spanish aliases (what comes from the PyEphem pipeline)
    'Conjunción': {color:'#f4c88a', dash:[],    angle:0,   weight: 1.25, alpha: 0x88},
    'Oposición':  {color:'#ff5a5a', dash:[7,4], angle:180, weight: 1.25, alpha: 0x88},
    'Cuadratura': {color:'#ff8a4a', dash:[],    angle:90,  weight: 1.10, alpha: 0x77},
    'Trígono':    {color:'#5dd07a', dash:[],    angle:120, weight: 0.95, alpha: 0x55},
    'Sextil':     {color:'#6fc4d4', dash:[3,3], angle:60,  weight: 0.75, alpha: 0x44},
  };
  function aspectAlphaHex(n){ n=Math.max(0,Math.min(255,n|0)); var s=n.toString(16); return s.length<2?'0'+s:s; }

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;

  /**
   * Calculate approximate lunar mean longitude for a given date.
   * Uses the simplified formula: moonLong = (218.316 + 13.176396 * daysSinceJ2000) % 360
   * @param {number} year
   * @param {number} month (1-12)
   * @param {number} day
   * @returns {number} longitude in degrees (0-360)
   */
  function calcMoonLongitude(year, month, day) {
    // Julian Day Number (simplified)
    var a = Math.floor((14 - month) / 12);
    var y = year + 4800 - a;
    var m = month + 12 * a - 3;
    var jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    // J2000.0 epoch is JDN 2451545.0 (Jan 1, 2000, 12:00 TT)
    var daysSinceJ2000 = jdn - 2451545.0;
    var moonLong = (218.316 + 13.176396 * daysSinceJ2000) % 360;
    if (moonLong < 0) moonLong += 360;
    return moonLong;
  }

  /**
   * Get the zodiac sign index (0-11) from ecliptic longitude.
   * @param {number} longitude in degrees
   * @returns {number} sign index (0 = Aries, 11 = Pisces)
   */
  function signFromLongitude(longitude) {
    return Math.floor(((longitude % 360) + 360) % 360 / 30);
  }

  /**
   * Get degree within sign from ecliptic longitude.
   * @param {number} longitude in degrees
   * @returns {number} degree within sign (0-29)
   */
  function degreeInSign(longitude) {
    return ((longitude % 360) + 360) % 360 % 30;
  }

  /**
   * Render a natal chart wheel.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} chartData — { planets: [{name, longitude, sign, degree}...], aspects: [{planet1, planet2, type}...], ascendant: number, ascendantVerified: boolean, houses: [number x 12], midheaven: number }
   * @param {Object} opts — optional overrides
   */
  function render(canvas, chartData, opts) {
    opts = opts || {};
    // DPR override — the share-card renderer passes dpr:1 so the offscreen
    // chart canvas stays at exact pixel size (avoids wasting 4× memory on
    // retina-DPR mobiles just to downscale right after).
    var dpr = (typeof opts.dpr === 'number' ? opts.dpr : (window.devicePixelRatio || 1));
    var size = opts.size || (canvas.parentElement ? Math.min(canvas.parentElement.offsetWidth, 560) : 320);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var cx = size / 2;
    var cy = size / 2;
    // outerR shrunk from 0.46 → 0.42 (Apr 18) so the ASC/MC labels
    // drawn at outerR + 14 always stay inside the canvas even at
    // the far-left / far-right of the circle. Before, at size=320
    // the label ended at px ≈ 161 which clipped by 1px on the
    // edge — enough to eat the "M" of MC.
    var outerR = size * 0.42;
    var signR  = size * 0.36;
    var innerR = size * 0.30;
    var planetR = size * 0.24;
    var aspectR = size * 0.20;

    // Only use ascendant offset if we have a verified ascendant (real time-of-birth calculation).
    // Accept both shapes: a bare number (legacy) OR an object { sign, degree, longitude }
    // which is what calculate_natal_chart() in consultation_generator.py emits.
    // Similarly for midheaven below.
    var ascLongitude = (typeof chartData.ascendant === 'object' && chartData.ascendant !== null)
      ? chartData.ascendant.longitude
      : chartData.ascendant;
    var mcLongitude = (typeof chartData.midheaven === 'object' && chartData.midheaven !== null)
      ? chartData.midheaven.longitude
      : chartData.midheaven;
    var hasVerifiedAsc = typeof ascLongitude === 'number' && !isNaN(ascLongitude) && chartData.ascendantVerified === true;
    var ascOffset = hasVerifiedAsc ? (180 - ascLongitude) : 0;

    ctx.clearRect(0, 0, size, size);

    // ── Background with radial gradient ──
    // Extended to outerR + size*0.075 so the new outside-the-ring
    // sign-glyph discs sit inside the dark canvas background instead
    // of floating on the page bg.
    // 2026-04-29: opts.transparent=true skips this entirely — for daily
    // chart export que se layerea sobre cosmic bg del short.
    var TRANSPARENT_MODE = opts.transparent === true;
    var SKIP_LABELS = opts.skipLabels === true;
    var bgOuter = outerR + size * 0.075;
    if (!TRANSPARENT_MODE) {
      var bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bgOuter);
      bgGrad.addColorStop(0, 'rgba(18,18,52,0.92)');
      bgGrad.addColorStop(0.5, 'rgba(12,12,42,0.96)');
      bgGrad.addColorStop(0.85, 'rgba(8,8,32,0.98)');
      bgGrad.addColorStop(1, 'rgba(4,4,20,1)');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, bgOuter, 0, TAU);
      ctx.fill();
    }

    // ── Subtle radial glow behind zodiac ring ──
    var ringGlow = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR + 4);
    ringGlow.addColorStop(0, 'rgba(212,168,73,0.03)');
    ringGlow.addColorStop(0.5, 'rgba(212,168,73,0.06)');
    ringGlow.addColorStop(1, 'rgba(212,168,73,0.01)');
    ctx.fillStyle = ringGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 4, 0, TAU);
    ctx.fill();

    // ── Zodiac ring — segments + outside glyphs + in-band labels ──
    // Apr 18 redesign: zodiac glyphs now float OUTSIDE the decorative
    // ring (on floating element-coloured discs). The space inside the
    // band holds a 3-letter label so each slice is named, not only
    // glyph'd. Gives more breathing room inside the wheel for planets
    // and stars, and tells the user at a glance which sign is which
    // even if they don't recognise the glyph.
    var signLabels = opts.signLabels || SIGN_ABBR_ES;
    var glyphR  = outerR + size * 0.042;      // disc centre OUTSIDE the ring
    var nameR   = (outerR + signR) / 2;       // inside the band, where glyph used to sit
    var discR   = Math.round(size * 0.024);   // slightly smaller disc since it's floating free

    // 2026-04-29 sign-focus mode: when opts.signFocus is set (e.g. "Aries"
    // or "Géminis"), highlight that sign's segment + glow its ruler planet.
    var focusSignName = opts.signFocus || null;
    var focusIdx = -1;
    var focusRulerName = null;
    if (focusSignName) {
      var canonName = SIGN_NAME_ES_TO_EN[focusSignName] || focusSignName;
      focusIdx = SIGN_NAMES.indexOf(canonName);
      focusRulerName = SIGN_RULERS[focusSignName] || SIGN_RULERS[canonName] || null;
    }
    for (var i = 0; i < 12; i++) {
      var startAngle = ((i * 30 + ascOffset) * DEG) - Math.PI / 2;
      var endAngle = (((i + 1) * 30 + ascOffset) * DEG) - Math.PI / 2;
      var elemColor = ELEMENT_COLORS_VIVID[ELEMENTS[i]];

      // Subtle element wash across the band
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, signR, endAngle, startAngle, true);
      ctx.closePath();
      // 2026-04-29: focus mode brightens the focused sign's segment a lot,
      // dims others slightly so attention is drawn naturally.
      var washOpacity;
      if (focusIdx === i) {
        washOpacity = '50';   // ~31% — strong wash
      } else if (focusIdx >= 0) {
        washOpacity = '04';   // ~1.5% — much dimmer than default 0x08
      } else {
        washOpacity = '08';   // default — original behavior
      }
      ctx.fillStyle = elemColor + washOpacity;
      ctx.fill();
      // Extra outer halo on the focused segment to pop it
      if (focusIdx === i) {
        ctx.save();
        ctx.shadowColor = elemColor;
        ctx.shadowBlur = size * 0.025;
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = elemColor + 'C8';
        ctx.beginPath();
        ctx.arc(cx, cy, (outerR + signR) / 2, startAngle, endAngle);
        ctx.stroke();
        ctx.restore();
      }
      // Thin divider stroke
      ctx.strokeStyle = 'rgba(212,168,73,0.12)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(startAngle) * signR, cy + Math.sin(startAngle) * signR);
      ctx.lineTo(cx + Math.cos(startAngle) * outerR, cy + Math.sin(startAngle) * outerR);
      ctx.stroke();

      var midAngle = ((i * 30 + 15 + ascOffset) * DEG) - Math.PI / 2;

      // Sign 3-letter label in-band — gold-muted, small caps
      var nx = cx + Math.cos(midAngle) * nameR;
      var ny = cy + Math.sin(midAngle) * nameR;
      if (!SKIP_LABELS) {
        ctx.font = '600 ' + Math.round(size * 0.020) + 'px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(212,168,73,0.55)';
        ctx.fillText(signLabels[i], nx, ny);
      }

      // Glyph disc OUTSIDE the ring — element-coloured halo + gold ring + glyph
      var gx = cx + Math.cos(midAngle) * glyphR;
      var gy = cy + Math.sin(midAngle) * glyphR;
      var haloGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, discR);
      haloGrad.addColorStop(0, elemColor + '66');
      haloGrad.addColorStop(0.55, elemColor + '22');
      haloGrad.addColorStop(1, elemColor + '00');
      ctx.fillStyle = haloGrad;
      ctx.beginPath(); ctx.arc(gx, gy, discR, 0, TAU); ctx.fill();

      // Gold rim
      ctx.strokeStyle = 'rgba(212,168,73,0.42)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(gx, gy, discR - 1, 0, TAU); ctx.stroke();

      // Glyph itself
      if (!SKIP_LABELS) {
        ctx.font = '600 ' + Math.round(size * 0.036) + 'px "Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols",serif';
        ctx.shadowColor = elemColor;
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#fff8e7';
        ctx.fillText(SIGN_GLYPHS[i], gx, gy);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    }

    // ── Tick marks every 5 degrees on the outer ring ──
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (var t = 0; t < 360; t += 5) {
      var tickAngle = ((t + ascOffset) * DEG) - Math.PI / 2;
      var tickInner = outerR - 2;
      var tickOuter = outerR + 2;
      // Longer ticks at 10-degree intervals
      if (t % 10 === 0) {
        tickInner = outerR - 3;
        tickOuter = outerR + 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      }
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(tickAngle) * tickInner, cy + Math.sin(tickAngle) * tickInner);
      ctx.lineTo(cx + Math.cos(tickAngle) * tickOuter, cy + Math.sin(tickAngle) * tickOuter);
      ctx.stroke();
    }

    // ── Outer and inner circles ──
    ctx.strokeStyle = 'rgba(212,168,73,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(212,168,73,0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, signR, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(212,168,73,0.15)';
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, TAU); ctx.stroke();

    // ── House cusps (only if full house data provided) ──
    if (chartData.houses && chartData.houses.length === 12) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      for (var h = 0; h < 12; h++) {
        var hAngle = ((chartData.houses[h] + ascOffset) * DEG) - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(hAngle) * innerR, cy + Math.sin(hAngle) * innerR);
        ctx.lineTo(cx + Math.cos(hAngle) * signR, cy + Math.sin(hAngle) * signR);
        ctx.stroke();

        // House number
        var nextH = (h + 1) % 12;
        var hMid = chartData.houses[h] + ((chartData.houses[nextH] - chartData.houses[h] + 360) % 360) / 2;
        var hnAngle = ((hMid + ascOffset) * DEG) - Math.PI / 2;
        var hnR = (innerR + signR) / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.font = Math.round(size * 0.022) + 'px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(h + 1), cx + Math.cos(hnAngle) * hnR, cy + Math.sin(hnAngle) * hnR);
      }
    }

    // ── Real sky overlay (zodiacal constellations) ──
    // Optional: when the caller passes `starCatalog` + `constellationCatalog`,
    // we project each star in the catalog by its ecliptic coordinates and
    // plot it inside the zodiac band. Stars near the ecliptic (|lat| < 18°)
    // fit inside the signR↔outerR annulus; everything else is ignored
    // because this view is the *zodiac* — north-polar stars belong to the
    // horizon projection (sky-map.js), not the natal chart.
    //
    // We rely on LuzEstelar.SkyMap.equatorialToEcliptic if sky-map.js is
    // loaded on the page; otherwise we inline a tiny equivalent. This keeps
    // natal-chart.js usable even when sky-map.js isn't present.
    var _eq2ecl = (window.LuzEstelar && window.LuzEstelar.SkyMap && window.LuzEstelar.SkyMap.equatorialToEcliptic)
      ? window.LuzEstelar.SkyMap.equatorialToEcliptic
      : (function () {
          var EPS = 23.4392911 * DEG, HR15 = 15 * DEG;
          return function (ra, dec) {
            var r = ra * HR15, d = dec * DEG;
            var sd = Math.sin(d), cd = Math.cos(d), sr = Math.sin(r), cr = Math.cos(r);
            var se = Math.sin(EPS), ce = Math.cos(EPS);
            var lat = Math.asin(sd * ce - cd * se * sr);
            var lon = Math.atan2(sr * ce + Math.tan(d) * se, cr);
            if (lon < 0) lon += TAU;
            return { lon: lon / DEG, lat: lat / DEG };
          };
        })();

    if (chartData.starCatalog && chartData.starCatalog.stars) {
      // Band geometry: lat 0° sits at (signR + innerR) / 2, lat ±18° at the
      // annulus edges (innerR ↔ outerR, symmetric around band center).
      var bandCenter = (signR + outerR) / 2;
      var bandHalf = (outerR - innerR) / 2.1;   // a little less than full half
      var LAT_MAX = 18;

      function projectEcl(lon, lat) {
        var ang = ((lon + ascOffset) * DEG) - Math.PI / 2;
        var r = bandCenter + (lat / LAT_MAX) * bandHalf;
        return {
          x: cx + Math.cos(ang) * r,
          y: cy + Math.sin(ang) * r,
          ang: ang, r: r,
        };
      }

      // Cache projected positions keyed by star id
      var starPos = {};
      var rawStars = chartData.starCatalog.stars;
      for (var si = 0; si < rawStars.length; si++) {
        var rs = rawStars[si];
        // Compact array form [id,name,ra,dec,mag,con,bayer] OR object
        var sid, sra, sdec, smag;
        if (Array.isArray(rs)) { sid = rs[0]; sra = rs[2]; sdec = rs[3]; smag = rs[4]; }
        else { sid = rs.id; sra = rs.ra; sdec = rs.dec; smag = rs.mag; }
        var ecl = _eq2ecl(sra, sdec);
        if (Math.abs(ecl.lat) > LAT_MAX) continue;   // outside zodiacal band
        starPos[sid] = Object.assign(projectEcl(ecl.lon, ecl.lat), { mag: smag });
      }

      // Constellation stick figures (only pairs where BOTH stars made it in)
      var consts = (chartData.constellationCatalog && chartData.constellationCatalog.constellations) || [];
      ctx.save();
      // 2026-04-29: bumped opacity 0.28 → 0.45 + soft glow shadow so
      // constellation stick figures (Orion etc.) feel more present in
      // the daily chart. Still subtle — they're context, not subject.
      ctx.strokeStyle = 'rgba(255,245,220,0.45)';
      ctx.lineWidth = 0.9 * (size / 320);
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255,235,180,0.35)';
      ctx.shadowBlur = 2 * (size / 320);
      for (var ci = 0; ci < consts.length; ci++) {
        var lines = consts[ci].lines || [];
        for (var li = 0; li < lines.length; li++) {
          var pa = starPos[lines[li][0]];
          var pb = starPos[lines[li][1]];
          if (!pa || !pb) continue;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Stars: white dots, size scaled by magnitude, halo on the brightest
      var sids = Object.keys(starPos);
      for (var k = 0; k < sids.length; k++) {
        var sp = starPos[sids[k]];
        var r;
        if      (sp.mag <=  0.5) r = 2.4;
        else if (sp.mag <=  1.5) r = 1.9;
        else if (sp.mag <=  2.5) r = 1.4;
        else                     r = 1.0;
        r *= (size / 320);
        if (sp.mag <= 1.2) {
          var sh = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r * 3);
          sh.addColorStop(0.0, 'rgba(255,248,220,0.55)');
          sh.addColorStop(1.0, 'rgba(255,248,220,0)');
          ctx.fillStyle = sh;
          ctx.beginPath(); ctx.arc(sp.x, sp.y, r * 3, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,253,245,0.95)';
        ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, TAU); ctx.fill();
      }
    }

    // Hit-regions list — populated here for ASC/MC and later for planets
    // so a single canvas._hitRegions covers everything tappable.
    var hitRegions = [];

    // ── ASC / MC markers — only render if ascendant is verified (real time-of-birth) ──
    if (hasVerifiedAsc) {
      var ascAngle = ((ascLongitude + ascOffset) * DEG) - Math.PI / 2;
      ctx.strokeStyle = '#d4a849';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ascAngle) * (innerR - 5), cy + Math.sin(ascAngle) * (innerR - 5));
      ctx.lineTo(cx + Math.cos(ascAngle) * (outerR + 5), cy + Math.sin(ascAngle) * (outerR + 5));
      ctx.stroke();
      // Label
      ctx.fillStyle = '#d4a849';
      ctx.font = 'bold ' + Math.round(size * 0.025) + 'px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var ascLabelX = cx + Math.cos(ascAngle) * (outerR + 14);
      var ascLabelY = cy + Math.sin(ascAngle) * (outerR + 14);
      ctx.fillText('ASC', ascLabelX, ascLabelY);
      // Hit region — generous radius so tapping the label or the line works
      hitRegions.push({
        type: 'angle', name: 'ASC', longitude: ascLongitude,
        x: ascLabelX, y: ascLabelY, r: size * 0.055,
      });
    }

    if (typeof mcLongitude === 'number' && !isNaN(mcLongitude) && hasVerifiedAsc) {
      var mcAngle = ((mcLongitude + ascOffset) * DEG) - Math.PI / 2;
      ctx.strokeStyle = 'rgba(212,168,73,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(mcAngle) * (innerR - 5), cy + Math.sin(mcAngle) * (innerR - 5));
      ctx.lineTo(cx + Math.cos(mcAngle) * (outerR + 5), cy + Math.sin(mcAngle) * (outerR + 5));
      ctx.stroke();
      ctx.fillStyle = 'rgba(212,168,73,0.7)';
      ctx.font = 'bold ' + Math.round(size * 0.022) + 'px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var mcLabelX = cx + Math.cos(mcAngle) * (outerR + 14);
      var mcLabelY = cy + Math.sin(mcAngle) * (outerR + 14);
      ctx.fillText('MC', mcLabelX, mcLabelY);
      hitRegions.push({
        type: 'angle', name: 'MC', longitude: mcLongitude,
        x: mcLabelX, y: mcLabelY, r: size * 0.055,
      });
    }

    // ── Aspect lines ──
    if (chartData.aspects && chartData.aspects.length > 0) {
      var planetAngles = {};
      if (chartData.planets) {
        chartData.planets.forEach(function(p) {
          planetAngles[p.name] = ((p.longitude + ascOffset) * DEG) - Math.PI / 2;
        });
      }

      // Orb-based emphasis: tighter aspects (orb < 1°) render fully
      // opaque and ~30% thicker; looser aspects (orb > 5°) fade to
      // half-strength. If the pipeline didn't include `orb` per aspect
      // we fall back to the per-type base alpha/weight.
      chartData.aspects.forEach(function(asp) {
        // The pipeline stores the aspect name under `aspect` in
        // Spanish; the client-side transits calc emits `type` in
        // English. Accept both to cover every source.
        var aspName = asp.aspect || asp.type;
        var style = ASPECT_STYLES[aspName];
        if (!style) return;
        var a1 = planetAngles[asp.planet1];
        var a2 = planetAngles[asp.planet2];
        if (a1 === undefined || a2 === undefined) return;

        var orb = (typeof asp.orb === 'number') ? Math.abs(asp.orb) : 2;
        // Map orb to [0.5, 1.3] multiplier around the style's base
        var orbFactor = orb < 1 ? 1.3 : orb < 3 ? 1.0 : orb < 5 ? 0.8 : 0.55;
        var alphaByte = Math.min(255, Math.round(style.alpha * orbFactor));
        ctx.strokeStyle = style.color + aspectAlphaHex(alphaByte);
        ctx.lineWidth = style.weight * orbFactor;
        ctx.setLineDash(style.dash);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a1) * aspectR, cy + Math.sin(a1) * aspectR);
        ctx.lineTo(cx + Math.cos(a2) * aspectR, cy + Math.sin(a2) * aspectR);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // ── Planets ──
    if (chartData.planets && chartData.planets.length > 0) {
      // Per-planet radial offset from the base planetR.
      // Grouped by classical astrological family so the chart reads
      // as four concentric bands without losing the same-angle-means-
      // same-zodiac-position principle of the traditional wheel:
      //   luminaries → outermost (Sun/Moon stand out closest to signs)
      //   personals  → next in
      //   socials    → inner
      //   outers     → innermost
      // The tiny deltas (≤ 0.03 of size) keep planets visibly grouped
      // by family while preserving the chart's legibility.
      var PLANET_TIER = {
        Sun: 0,      Moon: 0,                                   // luminaries
        Mercury: 1,  Venus: 1,   Mars: 1,                       // personals
        Jupiter: 2,  Saturn: 2,                                 // socials
        Uranus: 3,   Neptune: 3, Pluto: 3,                      // transpersonals
        NorthNode: 1, Chiron: 2
      };
      // Spread bumped 0.060 → 0.090 (Apr 18) so the four tiers don't
      // touch when many planets cluster in the same sign. At size=292
      // this gives ~26px of radial air between outermost (Sol/Luna)
      // and innermost (Pluto/Uranus/Neptune), vs the previous ~17px
      // where spheres overlapped visually.
      var TIER_OFFSETS = [0, -0.030, -0.060, -0.090];   // × size

      // 2026-04-29: opt-in `geocentricOrbits` mode for the daily chart
      // export. Each planet gets its own concentric ring (Ptolemaic order
      // outward from Earth). Earth marker drawn at center. Used by
      // chart_renderer.py for shorts; the PWA still uses tier mode by
      // default unless the page passes opts.geocentricOrbits = true.
      var GEOCENTRIC = opts.geocentricOrbits === true;
      // Order: Moon (closest), Mercury, Venus, Sun, Mars, Jupiter, Saturn,
      // Uranus, Neptune, Pluto (farthest). Multipliers × size.
      var PLANET_ORBIT_R = {
        Moon:    0.115,
        Mercury: 0.140,
        Venus:   0.165,
        Sun:     0.190,
        Mars:    0.215,
        Jupiter: 0.240,
        Saturn:  0.265,
        Uranus:  0.290,
        Neptune: 0.310,
        Pluto:   0.330,
      };

      // Draw faint orbit rings + Earth marker BEFORE planets if in
      // geocentric mode. Drawn here (inside the planet block) so the
      // ascendant offset applied above is honored.
      if (GEOCENTRIC) {
        ctx.save();
        ctx.strokeStyle = 'rgba(180,200,255,0.18)';
        ctx.lineWidth = 0.5 * (size / 320);
        ctx.setLineDash([2 * (size/320), 4 * (size/320)]);
        Object.keys(PLANET_ORBIT_R).forEach(function(pName) {
          var r = PLANET_ORBIT_R[pName] * size;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, TAU);
          ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.restore();

        // Earth at center — small blue-green disc + "TIERRA" label
        var earthR = size * 0.018;
        var earthGrad = ctx.createRadialGradient(cx - earthR*0.3, cy - earthR*0.3, 0, cx, cy, earthR);
        earthGrad.addColorStop(0, '#7FB3D5');
        earthGrad.addColorStop(0.6, '#3B7CA8');
        earthGrad.addColorStop(1, '#1A3D5C');
        ctx.fillStyle = earthGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, earthR, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(127,179,213,0.5)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Earth glyph (⊕ — Earth symbol)
        if (!SKIP_LABELS) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = 'bold ' + Math.round(size * 0.022) + 'px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⊕', cx, cy);
          // Label below
          ctx.fillStyle = 'rgba(180,200,255,0.6)';
          ctx.font = Math.round(size * 0.014) + 'px Inter, sans-serif';
          ctx.fillText('TIERRA', cx, cy + earthR * 2.2);
        }
      }

      // Spread overlapping planets
      var sorted = chartData.planets.slice().sort(function(a,b) { return a.longitude - b.longitude; });
      var positions = [];
      sorted.forEach(function(p) {
        var angle = ((p.longitude + ascOffset) * DEG) - Math.PI / 2;
        // Nudge if too close to previous (SAME tier only — different-tier
        // planets already separate radially, so we shouldn't extra-nudge).
        var tier = PLANET_TIER[p.name] !== undefined ? PLANET_TIER[p.name] : 1;
        for (var j = 0; j < positions.length; j++) {
          if (positions[j].tier !== tier) continue;
          var diff = Math.abs(angle - positions[j].angle);
          if (diff < 0.12) angle += 0.13;
        }
        positions.push({ angle: angle, tier: tier });

        // 2026-04-29: in geocentric mode, each planet uses its own orbit
        // ring instead of the tier offset. Falls back to tier offset when
        // not in geocentric mode (preserves existing PWA behavior).
        var myR;
        if (GEOCENTRIC && PLANET_ORBIT_R[p.name] !== undefined) {
          myR = PLANET_ORBIT_R[p.name] * size;
        } else {
          myR = planetR + (TIER_OFFSETS[tier] || 0) * size;
        }
        var px = cx + Math.cos(angle) * myR;
        var py = cy + Math.sin(angle) * myR;
        var glyph = PLANET_GLYPHS[p.name] || '?';
        var color = getPlanetColor(p.name, size);

        // Realistic planet sphere (radial gradient + halo + optional rings).
        // Sol/Luna get bigger radii because they're the attention anchors.
        var sphereR = size * (p.name === 'Sun' ? 0.024
                            : p.name === 'Moon' ? 0.022
                            : 0.019);

        // 2026-04-29 sign-focus: ruler planet of the focused sign gets a
        // bright outer halo ring before the sphere is drawn — viewer's
        // eye lands here first.
        if (focusRulerName === p.name) {
          ctx.save();
          var ringElem = focusIdx >= 0 ? ELEMENT_COLORS_VIVID[ELEMENTS[focusIdx]] : '#FFD700';
          var glow = ctx.createRadialGradient(px, py, sphereR * 0.8, px, py, sphereR * 3.2);
          glow.addColorStop(0, ringElem + 'AA');
          glow.addColorStop(0.5, ringElem + '55');
          glow.addColorStop(1, ringElem + '00');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(px, py, sphereR * 3.2, 0, TAU); ctx.fill();
          // Halo ring
          ctx.strokeStyle = ringElem + 'CC';
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(px, py, sphereR * 1.9, 0, TAU); ctx.stroke();
          ctx.restore();
        }

        drawPlanetSphere(ctx, px, py, sphereR, p.name);

        // Planet glyph (drawn on top of the sphere with a subtle
        // shadow so it stays legible against the gradient).
        if (!SKIP_LABELS) {
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 3;
          ctx.fillStyle = (p.name === 'Sun' || p.name === 'Moon' ||
                           p.name === 'Venus' || p.name === 'Saturn' ||
                           p.name === 'Uranus')
            ? 'rgba(20,12,6,0.85)'
            : 'rgba(255,248,230,0.92)';
          ctx.font = 'bold ' + Math.round(size * 0.024) + 'px "Noto Sans Symbols 2", serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (p.name === 'Moon') {
            ctx.fillText('\u263D', px, py);
          } else {
            ctx.fillText(glyph, px, py);
          }
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        // Degree label — in geocentric mode, prepend planet abbreviation
        // ("Mar 12°") so each planet is identifiable without a legend.
        // Slight shadow keeps it readable when planets cluster.
        var degStr = Math.floor(p.degree) + '\u00B0';
        // 2026-06-28: name shown on natal charts too (was geocentric-only) —
        // user feedback that the shared natal card had bare degrees, no names.
        if (PLANET_ABBR_ES[p.name]) {
          degStr = PLANET_ABBR_ES[p.name] + ' ' + degStr;
        }
        if (!SKIP_LABELS) {
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 3;
          ctx.fillStyle = GEOCENTRIC ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)';
          ctx.font = (GEOCENTRIC ? '600 ' : '') + Math.round(size * (GEOCENTRIC ? 0.0155 : 0.018)) + 'px Inter, sans-serif';
          ctx.fillText(degStr, px, py + size * 0.038);
          ctx.restore();
        }

        // Tick line from planet to zodiac ring (starts at the *actual*
        // rendered planet radius, not the base, so the family-tiered
        // rings get clean short lines and the outer ones longer).
        var tickAngle = ((p.longitude + ascOffset) * DEG) - Math.PI / 2;
        ctx.strokeStyle = color + '33';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(tickAngle) * (myR + size * 0.025), cy + Math.sin(tickAngle) * (myR + size * 0.025));
        ctx.lineTo(cx + Math.cos(tickAngle) * signR, cy + Math.sin(tickAngle) * signR);
        ctx.stroke();

        // Register hit-region for tap-to-identify (consumer JS reads
        // canvas._hitRegions and does a nearest-match by Euclidean).
        hitRegions.push({
          type: 'planet',
          name: p.name,
          sign: p.sign,
          degree: p.degree,
          longitude: p.longitude,
          x: px, y: py, r: sphereR * 1.6,
        });
      });
    }

    // ── Transits overlay ─────────────────────────────────────────
    // Optional. If chartData.transits is provided we paint an outer
    // ring of today's planet positions, drawn smaller and translucent
    // so they read as "passing through" over the fixed natal chart.
    // The caller can also pass chartData.transitAspects to draw dashed
    // aspect lines between transit and natal positions.
    if (chartData.transits && chartData.transits.length > 0) {
      // Transit ring sits between the zodiac band and the inner deco.
      // Slightly further out than natal outermost tier so there's an
      // unmistakable visual separation (transits are NOT your chart —
      // they're sky-of-today visiting your chart).
      var transitR = size * 0.265;

      // Aspect lines first (behind the transit glyphs). Use distinct
      // colours per aspect type so the chart reads like a traditional
      // transit biwheel.
      var TRANSIT_ASPECT_STYLE = {
        conjunction: { color: '#FFD700', dash: [2, 3] },
        opposition:  { color: '#FF4040', dash: [6, 3] },
        square:      { color: '#FF7A30', dash: [4, 3] },
        trine:       { color: '#5DD07A', dash: [] },
        sextile:     { color: '#6FC4D4', dash: [3, 3] },
      };
      if (chartData.transitAspects && chartData.transitAspects.length > 0) {
        // Build a quick angle lookup for natal planets (already tiered).
        var natalAngleByName = {};
        if (chartData.planets) {
          chartData.planets.forEach(function (p) {
            natalAngleByName[p.name] = ((p.longitude + ascOffset) * DEG) - Math.PI / 2;
          });
        }
        for (var ai = 0; ai < chartData.transitAspects.length; ai++) {
          var tAsp = chartData.transitAspects[ai];
          var style = TRANSIT_ASPECT_STYLE[tAsp.type];
          if (!style) continue;
          var tAngle = ((tAsp.transitLon + ascOffset) * DEG) - Math.PI / 2;
          var nAngle = natalAngleByName[tAsp.natal];
          if (nAngle === undefined) continue;
          ctx.strokeStyle = style.color + (tAsp.exact ? 'AA' : '66');
          ctx.lineWidth = tAsp.exact ? 1.1 : 0.7;
          ctx.setLineDash(style.dash);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(tAngle) * transitR, cy + Math.sin(tAngle) * transitR);
          // Aim at the natal planet's tier'd radius — use base planetR
          // as a good-enough endpoint since we don't have that planet's
          // tier handy here.
          ctx.lineTo(cx + Math.cos(nAngle) * (planetR - size * 0.02),
                     cy + Math.sin(nAngle) * (planetR - size * 0.02));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Transit planet glyphs (outer ring, slightly smaller than natal,
      // with a faint silvery disc behind them so they read as a
      // separate layer).
      var transitPositions = [];
      for (var ti = 0; ti < chartData.transits.length; ti++) {
        var t = chartData.transits[ti];
        if (typeof t.longitude !== 'number') continue;
        var tAng = ((t.longitude + ascOffset) * DEG) - Math.PI / 2;
        // Small nudge if overlapping
        for (var tj = 0; tj < transitPositions.length; tj++) {
          if (Math.abs(tAng - transitPositions[tj]) < 0.09) tAng += 0.095;
        }
        transitPositions.push(tAng);
        var tx = cx + Math.cos(tAng) * transitR;
        var ty = cy + Math.sin(tAng) * transitR;
        var sphereR = size * 0.018;
        drawPlanetSphere(ctx, tx, ty, sphereR, t.name);
        // Faint silvery rim to signal "transit, not natal"
        ctx.strokeStyle = 'rgba(220,220,240,0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(tx, ty, sphereR + 2.5, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        // Glyph on top
        var tGlyph = PLANET_GLYPHS[t.name] || '?';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 3;
        ctx.fillStyle = (t.name === 'Sun' || t.name === 'Moon' ||
                         t.name === 'Venus' || t.name === 'Saturn' ||
                         t.name === 'Uranus')
          ? 'rgba(20,12,6,0.85)'
          : 'rgba(255,248,230,0.92)';
        ctx.font = 'bold ' + Math.round(size * 0.020) + 'px "Noto Sans Symbols 2", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (t.name === 'Moon') ctx.fillText('\u263D', tx, ty);
        else ctx.fillText(tGlyph, tx, ty);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Hit region for tap-identify
        hitRegions.push({
          type: 'transit',
          name: t.name,
          sign: t.sign,
          degree: t.degree,
          longitude: t.longitude,
          x: tx, y: ty, r: sphereR * 1.8,
        });
      }
    }

    // Stash on the canvas so the UI can hit-test tap events.
    // (Always set, even if no planets — ASC/MC hits still work.)
    canvas._hitRegions = hitRegions;

    // ── Center decoration — decorative pattern ──
    // Outer glow
    var centerGlowR = size * 0.08;
    var centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerGlowR);
    centerGlow.addColorStop(0, 'rgba(212,168,73,0.12)');
    centerGlow.addColorStop(0.5, 'rgba(212,168,73,0.05)');
    centerGlow.addColorStop(1, 'rgba(212,168,73,0)');
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, centerGlowR, 0, TAU);
    ctx.fill();

    // Center circle
    ctx.strokeStyle = 'rgba(212,168,73,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.035, 0, TAU);
    ctx.stroke();

    // Inner circle
    ctx.strokeStyle = 'rgba(212,168,73,0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.018, 0, TAU);
    ctx.stroke();

    // Radiating dots around center
    var dotCount = 8;
    var dotR = size * 0.05;
    var dotSize = size * 0.004;
    for (var d = 0; d < dotCount; d++) {
      var dAngle = (d / dotCount) * TAU;
      var dx = cx + Math.cos(dAngle) * dotR;
      var dy = cy + Math.sin(dAngle) * dotR;
      ctx.fillStyle = 'rgba(212,168,73,0.20)';
      ctx.beginPath();
      ctx.arc(dx, dy, dotSize, 0, TAU);
      ctx.fill();
    }

    // Smaller ring of dots
    var smallDotR = size * 0.028;
    for (var sd = 0; sd < dotCount; sd++) {
      var sdAngle = (sd / dotCount) * TAU + (TAU / (dotCount * 2)); // offset by half step
      var sdx = cx + Math.cos(sdAngle) * smallDotR;
      var sdy = cy + Math.sin(sdAngle) * smallDotR;
      ctx.fillStyle = 'rgba(212,168,73,0.12)';
      ctx.beginPath();
      ctx.arc(sdx, sdy, dotSize * 0.7, 0, TAU);
      ctx.fill();
    }

    // ── Earth at the center — the geocentric "you are here" anchor ──
    // Drawn only when we have star data (so it signals real-sky context)
    // OR when hasVerifiedAsc is true. Falls back to a small gold dot
    // otherwise to preserve the legacy look.
    if (chartData.starCatalog || hasVerifiedAsc) {
      var earthR = size * 0.022;
      // Outer glow
      var earthGlow = ctx.createRadialGradient(cx, cy, earthR * 0.4, cx, cy, earthR * 2.2);
      earthGlow.addColorStop(0.0, 'rgba(80,140,200,0.35)');
      earthGlow.addColorStop(1.0, 'rgba(80,140,200,0)');
      ctx.fillStyle = earthGlow;
      ctx.beginPath(); ctx.arc(cx, cy, earthR * 2.2, 0, TAU); ctx.fill();

      // Earth sphere — blue oceans with warm continents
      var earthG = ctx.createRadialGradient(
        cx - earthR * 0.35, cy - earthR * 0.4, earthR * 0.08,
        cx, cy, earthR
      );
      earthG.addColorStop(0.00, '#b8d8f0');
      earthG.addColorStop(0.30, '#5a9cc8');
      earthG.addColorStop(0.65, '#2a6898');
      earthG.addColorStop(1.00, '#0a2040');
      ctx.fillStyle = earthG;
      ctx.beginPath(); ctx.arc(cx, cy, earthR, 0, TAU); ctx.fill();

      // Continents: three abstract green blobs suggesting land
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, earthR, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(110,145,85,0.85)';
      // Americas silhouette
      ctx.beginPath();
      ctx.ellipse(cx - earthR * 0.30, cy - earthR * 0.10, earthR * 0.22, earthR * 0.55, -0.3, 0, TAU);
      ctx.fill();
      // Africa / Europe
      ctx.beginPath();
      ctx.ellipse(cx + earthR * 0.20, cy + earthR * 0.05, earthR * 0.30, earthR * 0.50, 0.15, 0, TAU);
      ctx.fill();
      // Asia bulge
      ctx.beginPath();
      ctx.ellipse(cx + earthR * 0.55, cy - earthR * 0.25, earthR * 0.22, earthR * 0.30, 0.4, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Specular highlight (top-left)
      var spec = ctx.createRadialGradient(
        cx - earthR * 0.45, cy - earthR * 0.5, 0,
        cx - earthR * 0.45, cy - earthR * 0.5, earthR * 0.5
      );
      spec.addColorStop(0.0, 'rgba(255,255,255,0.55)');
      spec.addColorStop(1.0, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec;
      ctx.beginPath(); ctx.arc(cx, cy, earthR, 0, TAU); ctx.fill();

      // Hairline gold outline so it reads against the dark background
      ctx.strokeStyle = 'rgba(212,168,73,0.55)';
      ctx.lineWidth = 0.8 * (size / 320);
      ctx.beginPath(); ctx.arc(cx, cy, earthR, 0, TAU); ctx.stroke();
    } else {
      // Legacy minimalist center
      ctx.fillStyle = '#d4a849';
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.005, 0, TAU);
      ctx.fill();
    }
  }

  /**
   * Hit-test a click/tap against the last-rendered chart.
   * Returns the closest region (planet) within its radius, or null.
   *   hitTest(canvas, xRelativeToCanvas, yRelativeToCanvas)
   */
  function hitTest(canvas, x, y) {
    var regions = canvas && canvas._hitRegions;
    if (!regions || !regions.length) return null;
    var best = null, bestD = Infinity;
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i];
      var dx = x - r.x, dy = y - r.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r.r && d < bestD) {
        best = r; bestD = d;
      }
    }
    return best;
  }

  // ─── Export ──
  global.LuzEstelar = global.LuzEstelar || {};
  global.LuzEstelar.NatalChart = {
    render: render,
    hitTest: hitTest,
    calcMoonLongitude: calcMoonLongitude,
    signFromLongitude: signFromLongitude,
    degreeInSign: degreeInSign,
    PLANET_GLYPHS: PLANET_GLYPHS,
    SIGN_GLYPHS: SIGN_GLYPHS,
    SIGN_NAMES: SIGN_NAMES
  };

})(typeof window !== 'undefined' ? window : this);
