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

  // Auto-bind on pointerdown. Vibration fires simultaneously with
  // the press (not click) so it matches native press UX.
  //
  // Coverage: every interactive element gets haptic feedback in PWA
  // standalone, not only the ones explicitly tagged .tap-feedback.
  // That was the old behaviour and it made haptic feel unreliable
  // — "sometimes it vibrates, sometimes not, same button".
  //
  // Opt-out via [data-no-haptic] on an ancestor when a specific
  // control genuinely should not buzz (swipe handles, hovers, etc.)
  //
  // Kind resolution order:
  //   1. Nearest [data-haptic] → explicit preset
  //   2. <button type=submit> or form submit → 'success'
  //   3. Anything with [aria-selected] flipping → 'select'
  //   4. default → 'tap'
  var AUTO_TARGETS =
    'button, [role="button"], a[href], input[type="submit"], ' +
    'input[type="button"], .tap-feedback, [data-haptic]';

  // Throttle: the same element firing within 40ms is almost always
  // a touch→pointer→mouse cascade on mobile Safari. Second vibrate
  // would just re-trigger the motor and waste battery without being
  // perceived as extra feedback.
  var lastTime = 0;
  var THROTTLE_MS = 40;

  function onPointerDown(e) {
    var now = performance.now();
    if (now - lastTime < THROTTLE_MS) return;

    // Nearest ancestor that either wants haptic or opts out.
    var el = e.target.closest(AUTO_TARGETS);
    if (!el) return;
    if (el.closest('[data-no-haptic]')) return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;

    // Resolve preset
    var explicit = el.closest('[data-haptic]');
    var kind = 'tap';
    if (explicit) {
      kind = explicit.getAttribute('data-haptic') || 'tap';
    } else if (el.type === 'submit') {
      kind = 'success';
    } else if (el.hasAttribute('aria-selected') || el.hasAttribute('aria-current')) {
      kind = 'select';
    }

    if (haptic(kind)) lastTime = now;
  }

  document.addEventListener('pointerdown', onPointerDown, { passive: true });

  ns.haptic = haptic;
})();
