/**
 * Luz Estelar — Install Prompt
 * Shows a branded banner inviting mobile users to install the PWA.
 * Android/Chrome: intercepts beforeinstallprompt for native install.
 * iOS Safari: shows guided instructions (Add to Home Screen).
 * Remembers dismissals for 14 days via localStorage.
 */
(function () {
  'use strict';

  var DISMISS_KEY = 'le_install_dismissed';
  var DISMISS_DAYS = 14;
  var DELAY_MS = 4000; // show after 4s so content loads first

  // Already installed as PWA?
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.navigator.standalone === true) return;

  // Recently dismissed?
  var dismissed = localStorage.getItem(DISMISS_KEY);
  if (dismissed && Date.now() - parseInt(dismissed, 10) < DISMISS_DAYS * 86400000) return;

  var deferredPrompt = null;
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var isAndroid = /Android/.test(navigator.userAgent);

  // Only show on mobile
  if (!isIOS && !isAndroid) return;

  // Capture Android install event
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showBanner();
  });

  // iOS: show after delay (no beforeinstallprompt support)
  if (isIOS) {
    var isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
    if (isSafari) {
      setTimeout(showBanner, DELAY_MS);
    }
  }

  function showBanner() {
    if (document.getElementById('le-install-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'le-install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Instalar aplicacion');

    var isIOSBanner = isIOS && !deferredPrompt;

    banner.innerHTML =
      '<div class="le-ib-inner">' +
        '<img src="/app_icon_192.png" alt="Luz Estelar" class="le-ib-icon" width="48" height="48">' +
        '<div class="le-ib-text">' +
          '<strong>Luz Estelar</strong>' +
          '<span>' + (isIOSBanner
            ? 'Toca <b>Compartir</b> y luego <b>Agregar a Inicio</b>'
            : 'Instala la app para acceso rapido') +
          '</span>' +
        '</div>' +
        (isIOSBanner
          ? ''
          : '<button class="le-ib-btn" id="le-ib-install">Instalar</button>') +
        '<button class="le-ib-close" id="le-ib-close" aria-label="Cerrar">&times;</button>' +
      '</div>';

    // Styles
    var style = document.createElement('style');
    style.textContent =
      '#le-install-banner{' +
        'position:fixed;bottom:0;left:0;right:0;z-index:9999;' +
        'padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0));' +
        'background:rgba(12,12,42,0.96);' +
        'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);' +
        'border-top:1px solid rgba(212,168,73,0.25);' +
        'transform:translateY(100%);animation:le-ib-slide .4s ease-out forwards;' +
      '}' +
      '@keyframes le-ib-slide{to{transform:translateY(0)}}' +
      '.le-ib-inner{' +
        'display:flex;align-items:center;gap:12px;max-width:480px;margin:0 auto;' +
      '}' +
      '.le-ib-icon{' +
        'width:48px;height:48px;border-radius:12px;flex-shrink:0;' +
      '}' +
      '.le-ib-text{' +
        'flex:1;display:flex;flex-direction:column;gap:2px;' +
      '}' +
      '.le-ib-text strong{' +
        'font-family:"Cormorant Garamond",serif;font-size:1rem;color:#d4a849;' +
      '}' +
      '.le-ib-text span{' +
        'font-size:.78rem;color:#9890a8;line-height:1.4;' +
      '}' +
      '.le-ib-text b{color:#e0dce8;}' +
      '.le-ib-btn{' +
        'padding:8px 18px;' +
        'background:linear-gradient(135deg,#d4a849,#c89030);' +
        'color:#06061a;font-weight:600;font-size:.82rem;' +
        'border:none;border-radius:8px;cursor:pointer;flex-shrink:0;' +
        'transition:opacity .2s;' +
      '}' +
      '.le-ib-btn:active{opacity:.8}' +
      '.le-ib-close{' +
        'background:none;border:none;color:#9890a8;font-size:1.4rem;' +
        'cursor:pointer;padding:4px 8px;flex-shrink:0;line-height:1;' +
      '}';

    document.head.appendChild(style);
    document.body.appendChild(banner);

    // Install button (Android)
    var installBtn = document.getElementById('le-ib-install');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function (choice) {
            if (choice.outcome === 'accepted') {
              removeBanner();
            }
            deferredPrompt = null;
          });
        }
      });
    }

    // Close button
    document.getElementById('le-ib-close').addEventListener('click', function () {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      removeBanner();
    });
  }

  function removeBanner() {
    var b = document.getElementById('le-install-banner');
    if (b) {
      b.style.animation = 'none';
      b.style.transform = 'translateY(100%)';
      b.style.transition = 'transform .3s ease-in';
      setTimeout(function () { b.remove(); }, 350);
    }
  }
})();
