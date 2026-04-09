/**
 * Cookie Consent Banner — Luz Estelar
 * GDPR-compliant informational banner for essential cookies.
 *
 * Since we only use strictly necessary cookies (le_token for auth),
 * GDPR does not require opt-in consent. However, we inform users
 * as best practice and comply with the ePrivacy Directive.
 *
 * Usage: <script src="/js/cookie-consent.js" defer></script>
 */
(function() {
  'use strict';

  // Don't show if already dismissed
  if (localStorage.getItem('le_cookie_consent')) return;

  // Detect language from <html lang> or URL path
  var lang = document.documentElement.lang || 'es';
  if (window.location.pathname.indexOf('/en/') === 0) lang = 'en';

  var text = {
    es: {
      message: 'Este sitio usa una cookie esencial para autenticacion (le_token). No usamos cookies de rastreo ni publicidad.',
      accept: 'Entendido',
      more: 'Mas info',
    },
    en: {
      message: 'This site uses one essential cookie for authentication (le_token). We do not use tracking or advertising cookies.',
      accept: 'Got it',
      more: 'Learn more',
    }
  };

  var t = text[lang] || text.es;
  var policyUrl = lang === 'en' ? '/privacy-policy.html' : '/privacy-policy.html';

  // Create banner
  var banner = document.createElement('div');
  banner.id = 'cookie-consent';
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-live', 'polite');
  banner.innerHTML =
    '<div class="cc-inner">' +
      '<p class="cc-text">' + t.message + '</p>' +
      '<div class="cc-actions">' +
        '<a href="' + policyUrl + '" class="cc-link">' + t.more + '</a>' +
        '<button class="cc-btn" id="cc-accept">' + t.accept + '</button>' +
      '</div>' +
    '</div>';

  // Inject styles
  var style = document.createElement('style');
  style.textContent =
    '#cookie-consent{' +
      'position:fixed;bottom:0;left:0;right:0;z-index:9999;' +
      'background:rgba(6,6,26,0.95);backdrop-filter:blur(12px);' +
      'border-top:1px solid rgba(212,168,73,0.2);' +
      'padding:14px 20px;font-family:Inter,-apple-system,sans-serif;' +
      'animation:ccSlideUp .4s ease-out;' +
    '}' +
    '@keyframes ccSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}' +
    '.cc-inner{' +
      'max-width:1100px;margin:0 auto;display:flex;align-items:center;' +
      'justify-content:space-between;gap:16px;flex-wrap:wrap;' +
    '}' +
    '.cc-text{color:#c0b8d0;font-size:0.82em;line-height:1.5;flex:1;min-width:240px;margin:0;}' +
    '.cc-actions{display:flex;align-items:center;gap:12px;flex-shrink:0;}' +
    '.cc-link{color:#d4a849;font-size:0.8em;text-decoration:none;opacity:0.8;}' +
    '.cc-link:hover{opacity:1;text-decoration:underline;}' +
    '.cc-btn{' +
      'background:linear-gradient(135deg,#d4a849,#c89030);color:#06061a;' +
      'border:none;padding:8px 20px;border-radius:6px;font-size:0.82em;' +
      'font-weight:600;cursor:pointer;transition:transform .15s,box-shadow .15s;' +
    '}' +
    '.cc-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(212,168,73,0.3);}' +
    '@media(max-width:600px){' +
      '.cc-inner{flex-direction:column;text-align:center;}' +
      '.cc-text{min-width:auto;}' +
    '}';

  document.head.appendChild(style);
  document.body.appendChild(banner);

  // Accept handler
  document.getElementById('cc-accept').addEventListener('click', function() {
    localStorage.setItem('le_cookie_consent', Date.now());
    banner.style.animation = 'none';
    banner.style.transition = 'transform .3s ease-in, opacity .3s ease-in';
    banner.style.transform = 'translateY(100%)';
    banner.style.opacity = '0';
    setTimeout(function() { banner.remove(); }, 350);
  });
})();
