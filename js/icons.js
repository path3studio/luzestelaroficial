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
