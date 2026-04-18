/*!
 * Luz Estelar — Sheet modal drag-to-dismiss
 * ──────────────────────────────────────────
 * Progressively enhances any existing .sheet / .mdl-sheet element
 * with native-feeling drag-down gestures:
 *
 *   - Drag from the handle (or from the top 72px header area)
 *   - Sheet follows the finger in real time
 *   - Release: if moved > 30% of sheet height OR flicked > 500px/s,
 *     dismiss (caller closes); otherwise snap back to fully open.
 *
 * Zero config needed. Any time a .sheet.is-active / .mdl-sheet.active
 * appears in the DOM, the library attaches gesture listeners.
 *
 * The caller owns the open/close state; we just tell you WHEN to close
 * by dispatching a `sheet:dismiss` CustomEvent on the sheet element.
 * Wire it up once:
 *     sheet.addEventListener('sheet:dismiss', closeMyModal);
 *
 * Backwards-compat shim for the legacy .mdl-sheet in mi-dia.html —
 * we also call a global window.__closeAddProfileSheet() if present,
 * so the existing Add-Profile flow picks this up with zero edits.
 */
(function () {
  'use strict';

  var DISMISS_RATIO   = 0.30;   // drag > 30% of sheet height → dismiss
  var DISMISS_VELOCITY = 0.5;   // px/ms — flick threshold
  var HEADER_ZONE_PX   = 72;    // drag from this top zone anywhere in sheet
  var state = null;             // active drag state

  function attach(sheet) {
    if (!sheet || sheet.dataset.dragReady === '1') return;
    sheet.dataset.dragReady = '1';
    sheet.addEventListener('pointerdown', onDown, { passive: true });
  }

  function onDown(e) {
    var sheet = e.currentTarget;
    // Only drag from handle or header area — not the scrollable body,
    // otherwise we'd swallow the user's scroll intent.
    var rect = sheet.getBoundingClientRect();
    var yInSheet = e.clientY - rect.top;
    var isHandle = e.target.closest('.sheet-handle, .mdl-handle');
    if (!isHandle && yInSheet > HEADER_ZONE_PX) return;

    // Ignore multi-touch (let browser handle pinch-zoom / 2-finger scroll)
    if (e.isPrimary === false) return;

    state = {
      sheet: sheet,
      startY: e.clientY,
      startTime: performance.now(),
      lastY: e.clientY,
      lastTime: performance.now(),
      height: rect.height,
      pointerId: e.pointerId,
    };
    sheet.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
    sheet.addEventListener('pointermove', onMove);
    sheet.addEventListener('pointerup', onUp);
    sheet.addEventListener('pointercancel', onUp);
  }

  function onMove(e) {
    if (!state || e.pointerId !== state.pointerId) return;
    var dy = e.clientY - state.startY;
    if (dy < 0) dy = 0; // only allow dragging down
    state.sheet.style.transform = 'translateY(' + dy + 'px)';
    state.lastY = e.clientY;
    state.lastTime = performance.now();
  }

  function onUp(e) {
    if (!state || e.pointerId !== state.pointerId) return;
    var sheet = state.sheet;
    var dy = Math.max(0, e.clientY - state.startY);
    var dt = Math.max(1, state.lastTime - state.startTime);
    var velocity = dy / dt;  // px per ms
    var ratio = dy / state.height;

    sheet.removeEventListener('pointermove', onMove);
    sheet.removeEventListener('pointerup', onUp);
    sheet.removeEventListener('pointercancel', onUp);
    sheet.releasePointerCapture(e.pointerId);
    sheet.style.transition = '';

    if (ratio > DISMISS_RATIO || velocity > DISMISS_VELOCITY) {
      // Dismiss — hand off to the owner of the modal state.
      sheet.style.transform = '';
      sheet.dispatchEvent(new CustomEvent('sheet:dismiss', { bubbles: true }));
      // Legacy Add-Profile helper (mi-dia.html).
      if (typeof window.__closeAddProfileSheet === 'function') {
        window.__closeAddProfileSheet();
      }
    } else {
      // Snap back — just clear the inline transform, CSS takes over.
      sheet.style.transform = '';
    }
    state = null;
  }

  // Attach to anything that already exists.
  function scanAndAttach() {
    var els = document.querySelectorAll('.sheet, .mdl-sheet');
    for (var i = 0; i < els.length; i++) attach(els[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndAttach);
  } else {
    scanAndAttach();
  }

  // MutationObserver → new sheets get gestures too (late-injected ones).
  if ('MutationObserver' in window) {
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (!n || n.nodeType !== 1) continue;
          if (n.matches && (n.matches('.sheet') || n.matches('.mdl-sheet'))) attach(n);
          var inside = n.querySelectorAll && n.querySelectorAll('.sheet, .mdl-sheet');
          if (inside) for (var k = 0; k < inside.length; k++) attach(inside[k]);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  window.LuzEstelarSheet = { attach: attach };
})();
