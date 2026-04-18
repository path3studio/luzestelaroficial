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

  var ASPECT_STYLES = {
    conjunction: {color:'#FFD700', dash:[], angle:0},
    sextile:     {color:'#00CED1', dash:[4,4], angle:60},
    square:      {color:'#FF4500', dash:[], angle:90},
    trine:       {color:'#2E8B57', dash:[], angle:120},
    opposition:  {color:'#8B0000', dash:[8,4], angle:180}
  };

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
    var dpr = window.devicePixelRatio || 1;
    var size = opts.size || Math.min(canvas.parentElement.offsetWidth, 560);
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
    var bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR + 12);
    bgGrad.addColorStop(0, 'rgba(18,18,52,0.92)');
    bgGrad.addColorStop(0.5, 'rgba(12,12,42,0.96)');
    bgGrad.addColorStop(0.85, 'rgba(8,8,32,0.98)');
    bgGrad.addColorStop(1, 'rgba(4,4,20,1)');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 12, 0, TAU);
    ctx.fill();

    // ── Subtle radial glow behind zodiac ring ──
    var ringGlow = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR + 4);
    ringGlow.addColorStop(0, 'rgba(212,168,73,0.03)');
    ringGlow.addColorStop(0.5, 'rgba(212,168,73,0.06)');
    ringGlow.addColorStop(1, 'rgba(212,168,73,0.01)');
    ctx.fillStyle = ringGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 4, 0, TAU);
    ctx.fill();

    // ── Zodiac ring — segments ──
    for (var i = 0; i < 12; i++) {
      var startAngle = ((i * 30 + ascOffset) * DEG) - Math.PI / 2;
      var endAngle = (((i + 1) * 30 + ascOffset) * DEG) - Math.PI / 2;
      var elemColor = ELEMENT_COLORS_VIVID[ELEMENTS[i]];

      // Subtle segment — almost transparent (no square background look)
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, signR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = elemColor + '08'; // very subtle fill
      ctx.fill();
      // Thin divider strokes only
      ctx.strokeStyle = 'rgba(212,168,73,0.12)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(startAngle) * signR, cy + Math.sin(startAngle) * signR);
      ctx.lineTo(cx + Math.cos(startAngle) * outerR, cy + Math.sin(startAngle) * outerR);
      ctx.stroke();

      // ── Glyph position ──
      var midAngle = ((i * 30 + 15 + ascOffset) * DEG) - Math.PI / 2;
      var glyphR = (outerR + signR) / 2;
      var gx = cx + Math.cos(midAngle) * glyphR;
      var gy = cy + Math.sin(midAngle) * glyphR;
      var discR = Math.round(size * 0.028);

      // Decorative halo disc behind glyph (radial gradient, element-colored)
      var haloGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, discR);
      haloGrad.addColorStop(0, elemColor + '55');
      haloGrad.addColorStop(0.6, elemColor + '18');
      haloGrad.addColorStop(1, elemColor + '00');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(gx, gy, discR, 0, TAU);
      ctx.fill();

      // Thin gold ring around glyph
      ctx.strokeStyle = 'rgba(212,168,73,0.38)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(gx, gy, discR - 1, 0, TAU);
      ctx.stroke();

      // Sign glyph — white/gold with element color shadow
      ctx.font = '600 ' + Math.round(size * 0.042) + 'px "Noto Sans Symbols 2","Segoe UI Symbol","Apple Symbols",serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = elemColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fff8e7';
      ctx.fillText(SIGN_GLYPHS[i], gx, gy);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
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
      ctx.fillText('ASC', cx + Math.cos(ascAngle) * (outerR + 14), cy + Math.sin(ascAngle) * (outerR + 14));
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
      ctx.fillText('MC', cx + Math.cos(mcAngle) * (outerR + 14), cy + Math.sin(mcAngle) * (outerR + 14));
    }

    // ── Aspect lines ──
    if (chartData.aspects && chartData.aspects.length > 0) {
      var planetAngles = {};
      if (chartData.planets) {
        chartData.planets.forEach(function(p) {
          planetAngles[p.name] = ((p.longitude + ascOffset) * DEG) - Math.PI / 2;
        });
      }

      chartData.aspects.forEach(function(asp) {
        var style = ASPECT_STYLES[asp.type];
        if (!style) return;
        var a1 = planetAngles[asp.planet1];
        var a2 = planetAngles[asp.planet2];
        if (a1 === undefined || a2 === undefined) return;

        ctx.strokeStyle = style.color + '55';
        ctx.lineWidth = 0.8;
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
      // Spread overlapping planets
      var sorted = chartData.planets.slice().sort(function(a,b) { return a.longitude - b.longitude; });
      var positions = [];
      sorted.forEach(function(p) {
        var angle = ((p.longitude + ascOffset) * DEG) - Math.PI / 2;
        // Nudge if too close to previous
        for (var j = 0; j < positions.length; j++) {
          var diff = Math.abs(angle - positions[j]);
          if (diff < 0.12) angle += 0.13;
        }
        positions.push(angle);

        var px = cx + Math.cos(angle) * planetR;
        var py = cy + Math.sin(angle) * planetR;
        var glyph = PLANET_GLYPHS[p.name] || '?';
        var color = getPlanetColor(p.name, size);

        // Sun gets a golden pulsating glow
        if (p.name === 'Sun') {
          ctx.shadowColor = '#FFD700';
          ctx.shadowBlur = 12;
          // Draw a golden glow circle behind the Sun
          var sunGlowGrad = ctx.createRadialGradient(px, py, 0, px, py, size * 0.035);
          sunGlowGrad.addColorStop(0, 'rgba(255,215,0,0.25)');
          sunGlowGrad.addColorStop(0.6, 'rgba(255,180,0,0.08)');
          sunGlowGrad.addColorStop(1, 'rgba(255,215,0,0)');
          ctx.fillStyle = sunGlowGrad;
          ctx.beginPath();
          ctx.arc(px, py, size * 0.035, 0, TAU);
          ctx.fill();
        }

        // Moon gets a silver/blue-white glow
        if (p.name === 'Moon') {
          ctx.shadowColor = '#b8c4e0';
          ctx.shadowBlur = 8;
          var moonGlowGrad = ctx.createRadialGradient(px, py, 0, px, py, size * 0.03);
          moonGlowGrad.addColorStop(0, 'rgba(184,196,224,0.20)');
          moonGlowGrad.addColorStop(0.6, 'rgba(184,196,224,0.06)');
          moonGlowGrad.addColorStop(1, 'rgba(184,196,224,0)');
          ctx.fillStyle = moonGlowGrad;
          ctx.beginPath();
          ctx.arc(px, py, size * 0.03, 0, TAU);
          ctx.fill();
        }

        // Planet glyph
        ctx.fillStyle = color;
        ctx.font = Math.round(size * 0.042) + 'px "Noto Sans Symbols 2", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Use crescent symbol for Moon
        if (p.name === 'Moon') {
          ctx.fillText('\u263D', px, py);
        } else {
          ctx.fillText(glyph, px, py);
        }

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Degree label
        var degStr = Math.floor(p.degree) + '\u00B0';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = Math.round(size * 0.018) + 'px Inter, sans-serif';
        ctx.fillText(degStr, px, py + size * 0.03);

        // Tick line from planet to zodiac ring
        var tickAngle = ((p.longitude + ascOffset) * DEG) - Math.PI / 2;
        ctx.strokeStyle = color + '33';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(tickAngle) * (planetR + size * 0.04), cy + Math.sin(tickAngle) * (planetR + size * 0.04));
        ctx.lineTo(cx + Math.cos(tickAngle) * signR, cy + Math.sin(tickAngle) * signR);
        ctx.stroke();
      });
    }

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

    // Center point
    ctx.fillStyle = '#d4a849';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.005, 0, TAU);
    ctx.fill();
  }

  // ─── Export ──
  global.LuzEstelar = global.LuzEstelar || {};
  global.LuzEstelar.NatalChart = {
    render: render,
    calcMoonLongitude: calcMoonLongitude,
    signFromLongitude: signFromLongitude,
    degreeInSign: degreeInSign,
    PLANET_GLYPHS: PLANET_GLYPHS,
    SIGN_GLYPHS: SIGN_GLYPHS,
    SIGN_NAMES: SIGN_NAMES
  };

})(typeof window !== 'undefined' ? window : this);
