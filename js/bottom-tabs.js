/**
 * Luz Estelar — Bottom Tab Bar (PWA app-like navigation)
 * Include this script on any app page to inject a sticky tab bar.
 * Auto-detects the current page and highlights the active tab.
 *
 * Usage: <script src="/js/bottom-tabs.js" defer></script>
 */
(function(){
  // PWA-ONLY (Apr 18): Bottom tabs were leaking onto the mobile web
  // view, making the site FEEL like an app even for users who never
  // installed it. Users told us the web should stay institutional
  // (header + menu) and the PWA should be the app-like experience.
  // So we bail out unless we are actually running in standalone mode.
  //
  // iOS Safari pre-16 uses navigator.standalone instead of
  // display-mode:standalone, so we check both.
  var isStandalone = (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true
  );
  if (!isStandalone) return;

  // 3-tab layout (unified Apr 16): Hoy + Perfil were merged into "Inicio"
  // so the horoscope, multisistema, carta natal, perfiles y reporte
  // cross-cultural viven ahora en /mi-dia.html. Dashboard queda vivo para
  // el flujo de setup / desktop pero no como tab propio.
  //
  // Language-aware (Apr 16 PM): when the current URL is under /en/ we route
  // every tab to its English counterpart so the user stays in-language.
  var path = location.pathname;
  var isEn = path.indexOf('/en/') === 0;
  // Note (Apr 16): /en/compatibility-personal.html and /en/settings.html are
  // not yet ported, so EN users fall back to the Spanish pages for those two
  // tabs. Home ('Inicio' / 'Home') is the only one fully bilingual today.
  // Icon names resolve to SVG via LuzEstelarIcons (see /js/icons.js).
  // icons.js is loaded before bottom-tabs.js in the page order, so the
  // registry is available by the time this runs. Fallback to the old
  // emoji character if the registry isn't present (defensive — e.g.
  // a page that includes bottom-tabs.js but skipped icons.js).
  var tabs = isEn ? [
    { id:'inicio', label:'Home',     icon:'sparkles', fallback:'\u2728',       href:'/en/my-day.html',                paths:['/en/my-day.html','/en/dashboard.html'] },
    { id:'compat', label:'Compat.',  icon:'heart',    fallback:'\uD83D\uDC96', href:'/compatibilidad-personal.html',  paths:['/compatibilidad-personal.html'] },
    { id:'ajustes',label:'Settings', icon:'settings', fallback:'\u2699\uFE0F', href:'/ajustes.html',                  paths:['/ajustes.html'] }
  ] : [
    { id:'inicio', label:'Inicio',  icon:'sparkles', fallback:'\u2728',       href:'/mi-dia.html',                   paths:['/mi-dia.html','/dashboard.html'] },
    { id:'compat', label:'Compat.', icon:'heart',    fallback:'\uD83D\uDC96', href:'/compatibilidad-personal.html',  paths:['/compatibilidad-personal.html'] },
    { id:'ajustes',label:'Ajustes', icon:'settings', fallback:'\u2699\uFE0F', href:'/ajustes.html',                  paths:['/ajustes.html'] }
  ];
  var active = '';
  for(var i=0;i<tabs.length;i++){
    for(var j=0;j<tabs[i].paths.length;j++){
      if(path===tabs[i].paths[j]){ active=tabs[i].id; break; }
    }
  }

  // Build HTML. Prefer SVG from the icon registry; fall back to emoji
  // if the registry isn't loaded (keeps nav usable in isolation).
  var hasRegistry = !!(window.LuzEstelarIcons && window.LuzEstelarIcons.render);
  var html = '<nav id="le-tabs" role="navigation" aria-label="Navegacion principal">';
  for(var i=0;i<tabs.length;i++){
    var t = tabs[i];
    var cls = 'le-tab' + (t.id===active?' le-tab-active':'');
    var aria = t.id===active?' aria-current="page"':'';
    var iconHtml = hasRegistry
      ? window.LuzEstelarIcons.render(t.icon)
      : t.fallback;
    html += '<a href="'+t.href+'" class="'+cls+'"'+aria+'>';
    html += '<span class="le-tab-icon">'+iconHtml+'</span>';
    html += '<span class="le-tab-label">'+t.label+'</span>';
    html += '</a>';
  }
  html += '</nav>';

  // Build CSS
  var style = document.createElement('style');
  style.textContent = [
    '#le-tabs{',
    '  position:fixed;bottom:0;left:0;right:0;z-index:9999;',
    '  display:flex;justify-content:space-around;align-items:center;',
    '  height:58px;padding-bottom:env(safe-area-inset-bottom,0);',
    '  background:rgba(6,6,26,0.92);',
    '  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);',
    '  border-top:1px solid rgba(212,168,73,0.12);',
    '}',
    /* In standalone (installed PWA) the tab bar feels more native:
       taller, slightly denser blur, subtle inner glow when active. */
    'html.is-standalone #le-tabs{',
    '  height:62px;',
    '  background:rgba(6,6,26,0.96);',
    '  border-top-color:rgba(212,168,73,0.18);',
    '}',
    '.le-tab{',
    '  position:relative;',
    '  display:flex;flex-direction:column;align-items:center;justify-content:center;',
    '  text-decoration:none;color:rgba(255,255,255,0.4);',
    '  flex:1;height:100%;gap:2px;transition:color 0.2s, transform 0.12s;',
    '  -webkit-tap-highlight-color:transparent;',
    '}',
    '.le-tab:active{transform:scale(0.94);}',
    /* Active tab: gold color + top accent bar (tiny line above the icon)
       + subtle gold glow halo behind the icon. */
    '.le-tab-active{color:#d4a849;}',
    '.le-tab-active::before{',
    '  content:"";position:absolute;top:0;left:50%;',
    '  width:18px;height:2px;border-radius:0 0 2px 2px;',
    '  background:#d4a849;transform:translateX(-50%);',
    '  box-shadow:0 0 8px rgba(212,168,73,0.55);',
    '}',
    '.le-tab-active .le-tab-icon{',
    '  background:radial-gradient(ellipse 70% 70% at center,rgba(212,168,73,0.18),transparent 70%);',
    '}',
    '.le-tab-active .le-tab-label{font-weight:600;}',
    // 22px icon box so SVG lines sit cleanly above the label.
    '.le-tab-icon{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:10px;font-size:18px;line-height:1;transition:background 0.2s;}',
    '.le-tab-icon svg{width:22px;height:22px;stroke-width:1.6;}',
    '.le-tab-label{font-family:"Inter",sans-serif;font-size:9.5px;font-weight:500;letter-spacing:0.4px;}',
    '.le-tab:hover{color:rgba(255,255,255,0.7);}',
    '.le-tab-active:hover{color:#d4a849;}',
    '@media(min-width:640px){#le-tabs{display:none;}}',
  ].join('\n');
  document.head.appendChild(style);

  // Inject
  var div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstChild);

  // Ensure body has bottom padding for the tab bar
  document.body.style.paddingBottom = 'calc(56px + env(safe-area-inset-bottom, 0px))';
})();
