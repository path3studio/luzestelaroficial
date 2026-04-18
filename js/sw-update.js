/*!
 * Luz Estelar — Service worker update prompt
 * ───────────────────────────────────────────
 * Watches the active service worker and, when a new version is
 * installed and waiting, shows a sticky toast inviting the user to
 * refresh. Tap → skip waiting → reload — user gets the new version
 * instantly, no 24h SW update cycle delay.
 *
 * Depends on: toast.js (LuzEstelar.toast).
 *
 * Only runs when:
 *   - Service workers are supported
 *   - A registration exists
 *   - An `installed` worker is found (either now, or as soon as it
 *     arrives via updatefound)
 *
 * Safe on first install (no old worker → nothing to prompt).
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  var isEn = location.pathname.indexOf('/en/') === 0;
  var MSG = {
    es: { body: 'Nueva versión disponible', action: 'Actualizar' },
    en: { body: 'New version available',    action: 'Refresh'    },
  };
  var copy = isEn ? MSG.en : MSG.es;
  var toastShown = false;

  function promptForRefresh(waitingWorker) {
    if (toastShown) return;
    toastShown = true;

    // Wait until LuzEstelar.toast is available (toast.js loads via defer).
    function show() {
      if (!window.LuzEstelar || !window.LuzEstelar.toast) {
        setTimeout(show, 100);
        return;
      }
      window.LuzEstelar.toast(copy.body, {
        kind: 'info',
        duration: 0,
        action: {
          label: copy.action,
          onClick: function () {
            // Ask the waiting worker to take over immediately.
            if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            // Reload once the controller changes (new SW is active).
            var reloaded = false;
            navigator.serviceWorker.addEventListener('controllerchange', function () {
              if (reloaded) return;
              reloaded = true;
              window.location.reload();
            });
          },
        },
      });
    }
    show();
  }

  navigator.serviceWorker.getRegistration().then(function (reg) {
    if (!reg) return;

    // Already waiting on page load? Prompt immediately.
    if (reg.waiting && navigator.serviceWorker.controller) {
      promptForRefresh(reg.waiting);
    }

    // Otherwise listen for future updates.
    reg.addEventListener('updatefound', function () {
      var newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', function () {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          promptForRefresh(newWorker);
        }
      });
    });

    // Poll for updates periodically while the PWA is open so long-lived
    // sessions don't miss a release. 30-min interval is gentle on the
    // network and still keeps users on the current build.
    setInterval(function () {
      reg.update().catch(function () { /* offline, ignore */ });
    }, 30 * 60 * 1000);
  });
})();
