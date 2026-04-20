/*!
 * Luz Estelar — Starfield populator
 * ──────────────────────────────────
 * Finds any element with [data-stars] (or the global [data-stars-global])
 * and sprinkles twinkling dots inside. Density auto-scales with viewport
 * and optional preset (`dense` | `soft`).
 *
 * Usage in HTML:
 *   <div data-stars-global aria-hidden="true"></div>
 *   <div data-stars="dense" aria-hidden="true"></div>
 *
 * Safe to include on every page — no-ops if no matching element exists.
 */
(function () {
  'use strict';

  var DENSITY_PRESETS = {
    soft:   { min: 28, factor: 0.04 },
    base:   { min: 42, factor: 0.06 },
    dense:  { min: 60, factor: 0.09 },
  };

  function densityFor(preset, area) {
    var p = DENSITY_PRESETS[preset] || DENSITY_PRESETS.base;
    return Math.max(p.min, Math.round(area * p.factor / 100));
  }

  function createDot(w, h) {
    var dot = document.createElement('span');
    dot.className = 'star-dot';
    // ~1 in 10 stars gets a "brilliant" bump so the field isn't just a
    // uniform dust — some pinpoints read as hero stars, the rest as
    // background dust. Matches the visual texture of a real sky.
    var isBright = Math.random() < 0.12;
    var size = isBright
      ? (Math.random() * 1.4 + 1.6).toFixed(2)   // 1.6 – 3.0 px
      : (Math.random() * 1.4 + 0.5).toFixed(2);  // 0.5 – 1.9 px
    var x    = (Math.random() * 100).toFixed(2);
    var y    = (Math.random() * 100).toFixed(2);
    var dur  = (2.5 + Math.random() * 3.5).toFixed(2);
    var del  = (Math.random() * 4).toFixed(2);
    // Opacity lifted 0.3–0.9 → 0.45–1.0 (bright stars near the top,
    // baseline dust still readable) so the global backdrop "cala"
    // without us having to multiply the dot count.
    var op   = isBright
      ? (Math.random() * 0.2 + 0.8).toFixed(2)
      : (Math.random() * 0.5 + 0.45).toFixed(2);
    dot.style.cssText =
      'width:'     + size + 'px;' +
      'height:'    + size + 'px;' +
      'left:'      + x    + '%;'  +
      'top:'       + y    + '%;'  +
      'opacity:'   + op   + ';'   +
      'animation-duration:' + dur + 's;' +
      'animation-delay:'    + del + 's';
    return dot;
  }

  function populate(el, preset) {
    if (el.dataset.ready === '1') return;
    var rect = el.getBoundingClientRect();
    var area = Math.max(rect.width, 1) * Math.max(rect.height, 1) / 1000;
    // Global starfield uses viewport area
    if (el.hasAttribute('data-stars-global')) {
      area = (window.innerWidth * window.innerHeight) / 1000;
    }
    var n = densityFor(preset, area);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) frag.appendChild(createDot());
    el.appendChild(frag);
    el.dataset.ready = '1';
  }

  function addShootingStar(el) {
    // Fire roughly every 12-25s so it stays a surprise, not a distraction.
    function schedule() {
      var wait = 12000 + Math.random() * 13000;
      setTimeout(fire, wait);
    }
    function fire() {
      var s = document.createElement('span');
      s.className = 'star-shoot';
      s.style.top = (Math.random() * 55).toFixed(1) + '%';
      el.appendChild(s);
      setTimeout(function () {
        if (s.parentNode) s.parentNode.removeChild(s);
      }, 8000);
      schedule();
    }
    schedule();
  }

  function init() {
    // Scoped starfields
    document.querySelectorAll('[data-stars]').forEach(function (el) {
      populate(el, el.getAttribute('data-stars') || 'base');
    });
    // Global ambient starfield (one per page, fixed behind everything)
    var global = document.querySelector('[data-stars-global]');
    if (global) {
      populate(global, 'base');
      // Only add shooting stars if user hasn't opted out of motion
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        addShootingStar(global);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for late-rendered elements (profile cards, modals, etc.)
  window.LuzEstelarStars = { populate: populate };
})();
