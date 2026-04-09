/**
 * natal-chart.js — Interactive Natal Chart Wheel Renderer
 * ========================================================
 * Renders a zodiac wheel on a <canvas> element with planets, houses, and aspects.
 * Pure vanilla JS, no dependencies.
 */

(function(global) {
  'use strict';

  var SIGN_GLYPHS = ['\u2648','\u2649','\u264A','\u264B','\u264C','\u264D','\u264E','\u264F','\u2650','\u2651','\u2652','\u2653'];
  var SIGN_NAMES  = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  var SIGN_COLORS = ['#FF4500','#2E8B57','#FFD700','#4169E1','#FF8C00','#8B4513','#DA70D6','#8B0000','#9400D3','#2F4F4F','#00CED1','#1E90FF'];
  var ELEMENT_COLORS = {Fire:'#FF4500', Earth:'#2E8B57', Air:'#FFD700', Water:'#4169E1'};
  var ELEMENTS = ['Fire','Earth','Air','Water','Fire','Earth','Air','Water','Fire','Earth','Air','Water'];

  var PLANET_GLYPHS = {
    Sun:'\u2609', Moon:'\u263D', Mercury:'\u263F', Venus:'\u2640', Mars:'\u2642',
    Jupiter:'\u2643', Saturn:'\u2644', Uranus:'\u2645', Neptune:'\u2646', Pluto:'\u2647',
    NorthNode:'\u260A', Chiron:'\u26B7'
  };
  var PLANET_COLORS = {
    Sun:'#FFD700', Moon:'#C0C0C0', Mercury:'#00CED1', Venus:'#DA70D6', Mars:'#FF4500',
    Jupiter:'#9400D3', Saturn:'#2F4F4F', Uranus:'#00CED1', Neptune:'#1E90FF', Pluto:'#8B0000',
    NorthNode:'#888', Chiron:'#A0522D'
  };

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
   * Render a natal chart wheel.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} chartData — { planets: [{name, longitude, sign, degree}...], aspects: [{planet1, planet2, type}...], ascendant: number, houses: [number x 12] }
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
    var outerR = size * 0.46;
    var signR  = size * 0.39;
    var innerR = size * 0.33;
    var planetR = size * 0.26;
    var aspectR = size * 0.22;

    // Ascendant offset: Asc should be at 9 o'clock (180 deg)
    var ascOffset = chartData.ascendant ? (180 - chartData.ascendant) : 0;

    ctx.clearRect(0, 0, size, size);

    // ── Background ──
    var bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
    bgGrad.addColorStop(0, 'rgba(12,12,42,0.95)');
    bgGrad.addColorStop(1, 'rgba(6,6,26,0.98)');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 8, 0, TAU);
    ctx.fill();

    // ── Zodiac ring ──
    for (var i = 0; i < 12; i++) {
      var startAngle = ((i * 30 + ascOffset) * DEG) - Math.PI / 2;
      var endAngle = (((i + 1) * 30 + ascOffset) * DEG) - Math.PI / 2;

      // Sign segment fill
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, signR, endAngle, startAngle, true);
      ctx.closePath();
      var elemColor = ELEMENT_COLORS[ELEMENTS[i]];
      ctx.fillStyle = elemColor + '22';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Sign glyph
      var midAngle = ((i * 30 + 15 + ascOffset) * DEG) - Math.PI / 2;
      var glyphR = (outerR + signR) / 2;
      var gx = cx + Math.cos(midAngle) * glyphR;
      var gy = cy + Math.sin(midAngle) * glyphR;
      ctx.fillStyle = elemColor;
      ctx.font = Math.round(size * 0.035) + 'px "Noto Sans Symbols 2", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(SIGN_GLYPHS[i], gx, gy);
    }

    // ── Outer and inner circles ──
    ctx.strokeStyle = 'rgba(212,168,73,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(212,168,73,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, signR, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, TAU); ctx.stroke();

    // ── House cusps ──
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
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = Math.round(size * 0.022) + 'px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(h + 1), cx + Math.cos(hnAngle) * hnR, cy + Math.sin(hnAngle) * hnR);
      }
    }

    // ── ASC / MC markers ──
    if (chartData.ascendant !== undefined) {
      var ascAngle = ((chartData.ascendant + ascOffset) * DEG) - Math.PI / 2;
      ctx.strokeStyle = '#d4a849';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ascAngle) * (innerR - 5), cy + Math.sin(ascAngle) * (innerR - 5));
      ctx.lineTo(cx + Math.cos(ascAngle) * (outerR + 5), cy + Math.sin(ascAngle) * (outerR + 5));
      ctx.stroke();
      // Label
      ctx.fillStyle = '#d4a849';
      ctx.font = 'bold ' + Math.round(size * 0.025) + 'px Inter, sans-serif';
      ctx.fillText('ASC', cx + Math.cos(ascAngle) * (outerR + 14), cy + Math.sin(ascAngle) * (outerR + 14));
    }

    if (chartData.midheaven !== undefined) {
      var mcAngle = ((chartData.midheaven + ascOffset) * DEG) - Math.PI / 2;
      ctx.strokeStyle = 'rgba(212,168,73,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(mcAngle) * (innerR - 5), cy + Math.sin(mcAngle) * (innerR - 5));
      ctx.lineTo(cx + Math.cos(mcAngle) * (outerR + 5), cy + Math.sin(mcAngle) * (outerR + 5));
      ctx.stroke();
      ctx.fillStyle = 'rgba(212,168,73,0.7)';
      ctx.font = 'bold ' + Math.round(size * 0.022) + 'px Inter, sans-serif';
      ctx.fillText('MC', cx + Math.cos(mcAngle) * (outerR + 14), cy + Math.sin(mcAngle) * (outerR + 14));
    }

    // ── Aspect lines ──
    if (chartData.aspects) {
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
    if (chartData.planets) {
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
        var color = PLANET_COLORS[p.name] || '#fff';

        // Planet glyph
        ctx.fillStyle = color;
        ctx.font = Math.round(size * 0.04) + 'px "Noto Sans Symbols 2", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, px, py);

        // Degree label
        var degStr = Math.floor(p.degree) + '\u00B0';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = Math.round(size * 0.018) + 'px Inter, sans-serif';
        ctx.fillText(degStr, px, py + size * 0.03);

        // Tick line from planet to zodiac ring
        var tickAngle = ((p.longitude + ascOffset) * DEG) - Math.PI / 2;
        ctx.strokeStyle = color + '44';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(tickAngle) * (planetR + size * 0.04), cy + Math.sin(tickAngle) * (planetR + size * 0.04));
        ctx.lineTo(cx + Math.cos(tickAngle) * signR, cy + Math.sin(tickAngle) * signR);
        ctx.stroke();
      });
    }

    // ── Center decoration ──
    var centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.06);
    centerGrad.addColorStop(0, 'rgba(212,168,73,0.15)');
    centerGrad.addColorStop(1, 'rgba(212,168,73,0)');
    ctx.fillStyle = centerGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.06, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#d4a849';
    ctx.font = Math.round(size * 0.03) + 'px "Cormorant Garamond", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2729', cx, cy);
  }

  // ─── Export ──
  global.LuzEstelar = global.LuzEstelar || {};
  global.LuzEstelar.NatalChart = {
    render: render,
    PLANET_GLYPHS: PLANET_GLYPHS,
    SIGN_GLYPHS: SIGN_GLYPHS,
    SIGN_NAMES: SIGN_NAMES
  };

})(typeof window !== 'undefined' ? window : this);
