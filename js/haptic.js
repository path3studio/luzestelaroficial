/*!
 * Luz Estelar — Haptic feedback
 * ──────────────────────────────
 * Thin wrapper over the Vibration API with app-native presets.
 * Zero-cost on platforms that don't support it (gracefully no-ops).
 *
 *   LuzEstelar.haptic();           // default: light tap (8ms)
 *   LuzEstelar.haptic('tap');      // same
 *   LuzEstelar.haptic('success');  // double-tap (8,40,16)
 *   LuzEstelar.haptic('select');   // selection change (4ms)
 *   LuzEstelar.haptic('heavy');    // confirmation (20ms)
 *   LuzEstelar.haptic('error');    // warning (20,60,20)
 *
 * Also auto-binds to any element with [data-haptic] or (.tap-feedback
 * on standalone PWA). So developers can just add the class and get
 * proper native-feel tap vibration without writing JS.
 *
 * Respects:
 *   - prefers-reduced-motion → skips vibration entirely
 *   - PWA standalone check → haptics only when the installed app is
 *     active (desktop Chrome / mobile web would vibrate too, which
 *     users dislike in a browser tab)
 */
(function () {
  'use strict';

  var ns = (window.LuzEstelar = window.LuzEstelar || {});
  if (ns.haptic) return;

  var PATTERNS = {
    tap:     [8],
    select:  [4],
    heavy:   [20],
    success: [8, 40, 16],
    warning: [12, 30, 12],
    error:   [20, 60, 20],
  };

  var supports = (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');
  var reduced = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var standalone = (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true
  );

  function haptic(pattern) {
    if (!supports || reduced || !standalone) return false;
    if (typeof pattern === 'string') pattern = PATTERNS[pattern] || PATTERNS.tap;
    if (typeof pattern === 'number') pattern = [pattern];
    try {
      navigator.vibrate(pattern);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Auto-bind on pointerdown for anything explicitly marked.
  // We use pointerdown (not click) so the vibration fires
  // simultaneously with the press — matches native UX.
  function onPointerDown(e) {
    var el = e.target.closest('[data-haptic], .tap-feedback');
    if (!el) return;
    var kind = el.getAttribute('data-haptic') || 'tap';
    haptic(kind);
  }

  document.addEventListener('pointerdown', onPointerDown, { passive: true });

  ns.haptic = haptic;
})();
