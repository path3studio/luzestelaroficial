/*!
 * Luz Estelar — Icon registry
 * ────────────────────────────
 * Minimal reusable SVG icon system. Lucide-inspired line icons
 * (24×24 viewBox, stroke-linecap:round, stroke-width:1.75) tuned for
 * our gold-on-dark palette.
 *
 * Why inline strings (not a sprite or separate files):
 *   - Zero extra HTTP requests
 *   - currentColor works out of the box (inherit --gold, --text-dim, ...)
 *   - Sizing via .le-ic / font-size — no pixel math per usage
 *   - Easy to author new icons: add one entry below
 *
 * Usage in HTML:
 *   <span class="le-ic" data-icon="sparkles"></span>
 *   <span class="le-ic le-ic-lg" data-icon="heart"></span>
 *
 * Or programmatically:
 *   node.innerHTML = LuzEstelarIcons.render('settings');
 *
 * Any element with [data-icon="<name>"] gets its innerHTML replaced
 * on page load. aria-hidden is applied automatically; pair with a
 * sibling text label for a11y, or set aria-label on the parent.
 */
(function () {
  'use strict';

  /* Licensed under MIT (Lucide). Paths are transcribed as strings. */
  var ICONS = {
    // Generic brand / home
    sparkles:
      '<path d="M12 3l1.8 4.8L18 9l-4.2 1.2L12 15l-1.8-4.8L6 9l4.2-1.2L12 3z"/>' +
      '<path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',

    // Affinity / compat
    heart:
      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',

    // Settings
    settings:
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',

    // Content / comms
    mail:
      '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>' +
      '<polyline points="22,6 12,13 2,6"/>',
    globe:
      '<circle cx="12" cy="12" r="10"/>' +
      '<line x1="2" y1="12" x2="22" y2="12"/>' +
      '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',

    // People
    user:
      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="12" cy="7" r="4"/>',
    users:
      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="9" cy="7" r="4"/>' +
      '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>',

    // Astrology / cosmos
    sun:
      '<circle cx="12" cy="12" r="4"/>' +
      '<line x1="12" y1="2" x2="12" y2="5"/>' +
      '<line x1="12" y1="19" x2="12" y2="22"/>' +
      '<line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>' +
      '<line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>' +
      '<line x1="2" y1="12" x2="5" y2="12"/>' +
      '<line x1="19" y1="12" x2="22" y2="12"/>' +
      '<line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>' +
      '<line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>',
    moon:
      '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    star:
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    sunrise: // Ascendente visual metaphor
      '<path d="M17 18a5 5 0 0 0-10 0"/>' +
      '<line x1="12" y1="2" x2="12" y2="9"/>' +
      '<line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/>' +
      '<line x1="1" y1="18" x2="3" y2="18"/>' +
      '<line x1="21" y1="18" x2="23" y2="18"/>' +
      '<line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/>' +
      '<line x1="23" y1="22" x2="1" y2="22"/>' +
      '<polyline points="8 6 12 2 16 6"/>',

    // UI actions
    lock:
      '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
      '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    check:
      '<polyline points="20 6 9 17 4 12"/>',
    x:
      '<line x1="18" y1="6" x2="6" y2="18"/>' +
      '<line x1="6" y1="6" x2="18" y2="18"/>',
    'chevron-right':
      '<polyline points="9 18 15 12 9 6"/>',
    'chevron-left':
      '<polyline points="15 18 9 12 15 6"/>',
    'arrow-up':
      '<line x1="12" y1="19" x2="12" y2="5"/>' +
      '<polyline points="5 12 12 5 19 12"/>',
    plus:
      '<line x1="12" y1="5" x2="12" y2="19"/>' +
      '<line x1="5" y1="12" x2="19" y2="12"/>',

    // Product / commerce
    gift:
      '<polyline points="20 12 20 22 4 22 4 12"/>' +
      '<rect x="2" y="7" width="20" height="5"/>' +
      '<line x1="12" y1="22" x2="12" y2="7"/>' +
      '<path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z"/>' +
      '<path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>',

    // Actions (download / share / copy / external)
    download:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="7 10 12 15 17 10"/>' +
      '<line x1="12" y1="15" x2="12" y2="3"/>',
    share:
      '<circle cx="18" cy="5" r="3"/>' +
      '<circle cx="6" cy="12" r="3"/>' +
      '<circle cx="18" cy="19" r="3"/>' +
      '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>' +
      '<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    'share-2':  // alternate share (box-with-arrow, more native-looking)
      '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>' +
      '<polyline points="16 6 12 2 8 6"/>' +
      '<line x1="12" y1="2" x2="12" y2="15"/>',
    link:
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
      '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    copy:
      '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
      '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    'external-link':
      '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
      '<polyline points="15 3 21 3 21 9"/>' +
      '<line x1="10" y1="14" x2="21" y2="3"/>',

    // 2026-08-05 — Barrido "no emojis en assets": iconos para reemplazar
    // los emojis de mapa-estelar, index, links, login, dashboard y mi-dia.
    // Mismo lenguaje que el almacén website/assets/icons/ (Lucide-style).

    // Ocasiones / personas
    baby:
      '<path d="M9 12h.01"/><path d="M15 12h.01"/>' +
      '<path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/>' +
      '<path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>',
    ring:
      '<circle cx="12" cy="15" r="6"/>' +
      '<path d="M12 9 9.5 6 12 3l2.5 3z"/>',
    'graduation-cap':
      '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/>' +
      '<path d="M22 10v6"/>' +
      '<path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',

    // Formatos / dispositivos
    smartphone:
      '<rect x="7" y="2" width="10" height="20" rx="2"/>' +
      '<path d="M12 18h.01"/>',
    monitor:
      '<rect x="2" y="3" width="20" height="14" rx="2"/>' +
      '<line x1="8" y1="21" x2="16" y2="21"/>' +
      '<line x1="12" y1="17" x2="12" y2="21"/>',
    tv:
      '<rect x="2" y="7" width="20" height="15" rx="2"/>' +
      '<polyline points="17 2 12 7 7 2"/>',
    image:
      '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
      '<circle cx="9" cy="9" r="2"/>' +
      '<path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',

    // Cosmos / naturaleza (elementos)
    telescope:
      '<path d="m10.07 12.49-6.18 1.32a.93.93 0 0 1-1.11-.7l-.54-2.15a1.07 1.07 0 0 1 .69-1.27l13.51-4.44"/>' +
      '<path d="m13.56 11.75 4.33-.92"/>' +
      '<path d="m16 21-3.1-6.21"/>' +
      '<path d="M16.49 5.94a2 2 0 0 1 1.45-2.43l1.09-.27a1 1 0 0 1 1.21.73l1.52 6.06a1 1 0 0 1-.73 1.21l-1.09.27a2 2 0 0 1-2.43-1.45z"/>' +
      '<path d="m6.16 8.63 1.11 4.46"/>' +
      '<path d="m8 21 3.1-6.21"/>' +
      '<circle cx="12" cy="13" r="2"/>',
    orbit:
      '<circle cx="12" cy="12" r="3"/>' +
      '<circle cx="19" cy="5" r="2"/>' +
      '<circle cx="5" cy="19" r="2"/>' +
      '<path d="M10.4 21.9a10 10 0 0 0 9.94-15.42"/>' +
      '<path d="M13.5 2.1a10 10 0 0 0-9.84 15.42"/>',
    flame:
      '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    leaf:
      '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>' +
      '<path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    wind:
      '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>' +
      '<path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>' +
      '<path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
    droplet:
      '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    clover:
      '<path d="M12 12c-2-2.96-6.34-2.67-7.5-.5-1.03 1.94.5 4.5 3.5 4.5-3 0-4.53 2.56-3.5 4.5 1.16 2.17 5.5 2.46 7.5-.5"/>' +
      '<path d="M12 12c2-2.96 6.34-2.67 7.5-.5 1.03 1.94-.5 4.5-3.5 4.5 3 0 4.53 2.56 3.5 4.5-1.16 2.17-5.5 2.46-7.5-.5"/>' +
      '<path d="M12 12c-2.96-2-2.67-6.34-.5-7.5 1.94-1.03 4.5.5 4.5 3.5"/>' +
      '<path d="M12 12v9"/>',

    // Trabajo / energía (biorritmo web)
    briefcase:
      '<rect x="2" y="7" width="20" height="14" rx="2"/>' +
      '<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    zap:
      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',

    // Contenidos / sistemas esotéricos (dashboard)
    'crystal-ball':
      '<circle cx="12" cy="10" r="7"/>' +
      '<path d="M8.5 7.5A4 4 0 0 1 11 6"/>' +
      '<path d="M7 19.5h10l1.2 2.5H5.8z"/>',
    'book-open':
      '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>' +
      '<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    hash:
      '<line x1="4" y1="9" x2="20" y2="9"/>' +
      '<line x1="4" y1="15" x2="20" y2="15"/>' +
      '<line x1="10" y1="3" x2="8" y2="21"/>' +
      '<line x1="16" y1="3" x2="14" y2="21"/>',
    tree:
      '<path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19h-3"/>' +
      '<path d="M12 19v3"/>',
    pyramid:
      '<path d="M10 3h4v4h3v5h4v5H3v-5h4V7h3z"/>',
    clock:
      '<circle cx="12" cy="12" r="10"/>' +
      '<polyline points="12 6 12 12 16 14"/>',
    scroll:
      '<path d="M19 17V5a2 2 0 0 0-2-2H4"/>' +
      '<path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
    infinity:
      '<path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4z"/>',
    shield:
      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    gem:
      '<path d="M6 3h12l4 6-10 13L2 9z"/>' +
      '<path d="M11 3 8 9l4 13 4-13-3-6"/>' +
      '<path d="M2 9h20"/>',
    'credit-card':
      '<rect x="2" y="5" width="20" height="14" rx="2"/>' +
      '<line x1="2" y1="10" x2="22" y2="10"/>',
    trash:
      '<path d="M3 6h18"/>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>' +
      '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    home:
      '<path d="M3 9.5 12 3l9 6.5"/>' +
      '<path d="M5 8.8V21h14V8.8"/>' +
      '<path d="M9 21v-6h6v6"/>',
    'move-horizontal':
      '<polyline points="18 8 22 12 18 16"/>' +
      '<polyline points="6 8 2 12 6 16"/>' +
      '<line x1="2" y1="12" x2="22" y2="12"/>',
    lantern:
      '<path d="M12 2v2"/>' +
      '<rect x="7" y="4" width="10" height="12" rx="4"/>' +
      '<path d="M9.5 4.5v11"/><path d="M14.5 4.5v11"/>' +
      '<path d="M12 16v2"/><path d="M10 20.5h4"/>',
  };

  var SVG_ATTRS =
    ' xmlns="http://www.w3.org/2000/svg"' +
    ' viewBox="0 0 24 24"' +
    ' fill="none"' +
    ' stroke="currentColor"' +
    ' stroke-width="1.75"' +
    ' stroke-linecap="round"' +
    ' stroke-linejoin="round"' +
    ' aria-hidden="true"' +
    ' focusable="false"';

  function render(name) {
    var body = ICONS[name];
    if (!body) return '';
    return '<svg' + SVG_ATTRS + '>' + body + '</svg>';
  }

  function hydrate(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.dataset.iconReady === '1') continue;
      var name = n.getAttribute('data-icon');
      var svg = render(name);
      if (svg) {
        n.innerHTML = svg;
        n.dataset.iconReady = '1';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { hydrate(); });
  } else {
    hydrate();
  }

  window.LuzEstelarIcons = { render: render, hydrate: hydrate, ICONS: ICONS };
})();
