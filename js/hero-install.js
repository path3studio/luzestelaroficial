/*!
 * Luz Estelar — Hero "Abrir la App" smart CTA
 * ────────────────────────────────────────────
 * Replaces a dumb <a href="/mi-dia.html"> with context-aware behavior:
 *
 *   Running as installed PWA (display-mode: standalone)
 *     → Button becomes "Abrir Hoy" and navigates normally.
 *       (Rare: start_url is /mi-dia.html so PWAs land there directly,
 *        but we handle the case where someone navigates to / manually.)
 *
 *   Chromium-family browser with beforeinstallprompt available
 *     → Label swaps to "Instalar App". Clicking triggers the native
 *       install prompt. If user dismisses, fall back to navigation.
 *
 *   iOS Safari (no beforeinstallprompt API)
 *     → Label swaps to "Instalar en iPhone". Clicking opens a tiny
 *       sheet with step-by-step: Share → Añadir a pantalla de inicio.
 *
 *   Anything else (already-installed check, desktop Firefox, etc.)
 *     → Default "Abrir la App" — just navigates to /mi-dia.html.
 *
 * Markup contract (already present in index.html + en/index.html):
 *   <a id="heroAppCta" href="/mi-dia.html" class="btn btn-primary">
 *     <span class="le-ic" data-icon="sparkles"></span>
 *     <span class="cta-label">Abrir la App</span>
 *   </a>
 *
 * If the label span is missing, we create one to avoid wrecking the
 * icon markup.
 */
(function () {
  'use strict';

  var btn = document.getElementById('heroAppCta');
  if (!btn) return;

  var isEn = location.pathname.indexOf('/en/') === 0;

  var isStandalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  var isIOS =
    /iPad|iPhone|iPod/.test(navigator.platform) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

  var deferredPrompt = null;
  var mode = 'link'; // link | install | ios-hint | open

  // Locate (or create) the label element so we can update it without
  // clobbering the icon <span>.
  var label = btn.querySelector('.cta-label');
  if (!label) {
    // Wrap the button's trailing text in a span so we can address it
    var last = btn.lastChild;
    if (last && last.nodeType === Node.TEXT_NODE) {
      var text = last.textContent.trim();
      last.textContent = '';
      label = document.createElement('span');
      label.className = 'cta-label';
      label.textContent = text;
      btn.appendChild(label);
    }
  }

  function setLabel(text) {
    if (label) label.textContent = text;
  }

  function applyMode(newMode) {
    mode = newMode;
    switch (newMode) {
      case 'open':
        setLabel(isEn ? 'Open Today' : 'Abrir Hoy');
        break;
      case 'install':
        setLabel(isEn ? 'Install App' : 'Instalar App');
        break;
      case 'ios-hint':
        setLabel(isEn ? 'Install on iPhone' : 'Instalar en iPhone');
        break;
      case 'link':
      default:
        setLabel(isEn ? 'Open the App' : 'Abrir la App');
        break;
    }
  }

  // ── Initial mode resolution ──────────────────────────────────────
  if (isStandalone) {
    applyMode('open');
  } else if (isIOS) {
    applyMode('ios-hint');
  }
  // For Chromium we wait for beforeinstallprompt to fire; until then
  // the default "Open the App" copy works fine.

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone) applyMode('install');
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    applyMode('open');
  });

  // ── iOS hint sheet ───────────────────────────────────────────────
  function showIOSHint() {
    if (document.getElementById('le-ios-hint')) return;

    var overlay = document.createElement('div');
    overlay.id = 'le-ios-hint';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', isEn ? 'Install instructions' : 'Instrucciones de instalación');

    var title = isEn ? 'Install Luz Estelar' : 'Instala Luz Estelar';
    var stepLead = isEn
      ? 'Two taps and the app sits on your home screen:'
      : 'Dos toques y la app queda en tu pantalla de inicio:';
    var step1 = isEn
      ? '<strong>1.</strong> Tap the <strong>Share</strong> icon below (<span class="le-ioshint-glyph">&#x2B06;&#xFE0F;</span>).'
      : '<strong>1.</strong> Toca el ícono <strong>Compartir</strong> abajo (<span class="le-ioshint-glyph">&#x2B06;&#xFE0F;</span>).';
    var step2 = isEn
      ? '<strong>2.</strong> Choose <strong>Add to Home Screen</strong>.'
      : '<strong>2.</strong> Elige <strong>Añadir a pantalla de inicio</strong>.';
    var closeLabel = isEn ? 'Got it' : 'Entendido';

    overlay.innerHTML =
      '<div class="le-ioshint-backdrop" data-close></div>' +
      '<div class="le-ioshint-sheet">' +
        '<h3>' + title + '</h3>' +
        '<p class="le-ioshint-lead">' + stepLead + '</p>' +
        '<p class="le-ioshint-step">' + step1 + '</p>' +
        '<p class="le-ioshint-step">' + step2 + '</p>' +
        '<button type="button" class="le-ioshint-close" data-close>' + closeLabel + '</button>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('is-shown'); });

    function dismiss(e) {
      if (e && e.target && !e.target.hasAttribute('data-close')) return;
      overlay.classList.remove('is-shown');
      setTimeout(function () { overlay.remove(); }, 320);
      overlay.removeEventListener('click', dismiss);
    }
    overlay.addEventListener('click', dismiss);
  }

  // ── Click handler ────────────────────────────────────────────────
  btn.addEventListener('click', function (e) {
    if (mode === 'install' && deferredPrompt) {
      e.preventDefault();
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice.outcome !== 'accepted') {
          // user declined → still let them into the app
          window.location.href = btn.getAttribute('href');
        }
        deferredPrompt = null;
      });
      return;
    }
    if (mode === 'ios-hint') {
      e.preventDefault();
      showIOSHint();
      return;
    }
    // 'open' / 'link' → default navigation
  });

  // ── Styles for the iOS sheet (scoped, no globals) ────────────────
  if (!document.getElementById('le-ioshint-styles')) {
    var s = document.createElement('style');
    s.id = 'le-ioshint-styles';
    s.textContent = [
      '#le-ios-hint{position:fixed;inset:0;z-index:3000;opacity:0;transition:opacity 280ms ease-out;pointer-events:none;}',
      '#le-ios-hint.is-shown{opacity:1;pointer-events:auto;}',
      '.le-ioshint-backdrop{position:absolute;inset:0;background:rgba(6,6,26,0.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}',
      '.le-ioshint-sheet{position:absolute;left:16px;right:16px;bottom:calc(24px + env(safe-area-inset-bottom,0px));max-width:420px;margin:0 auto;padding:22px 22px 18px;background:linear-gradient(180deg,#14143a,#0c0c2a);border:1px solid rgba(212,168,73,0.28);border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,0.55);transform:translateY(24px);transition:transform 320ms cubic-bezier(0.2,0,0,1);}',
      '#le-ios-hint.is-shown .le-ioshint-sheet{transform:translateY(0);}',
      '.le-ioshint-sheet h3{font-family:"Cormorant Garamond",serif;color:#d4a849;font-size:1.35rem;margin:0 0 10px;}',
      '.le-ioshint-lead{color:#9890a8;font-size:0.9rem;margin:0 0 14px;line-height:1.45;}',
      '.le-ioshint-step{color:#e0dce8;font-size:0.92rem;margin:0 0 10px;line-height:1.5;}',
      '.le-ioshint-step strong{color:#fff;}',
      '.le-ioshint-glyph{color:#d4a849;}',
      '.le-ioshint-close{display:block;width:100%;margin-top:14px;padding:12px;border:none;border-radius:10px;background:linear-gradient(135deg,#d4a849,#c89030);color:#06061a;font-family:"Inter",sans-serif;font-weight:600;font-size:0.95rem;cursor:pointer;min-height:44px;}',
    ].join('');
    document.head.appendChild(s);
  }
})();
