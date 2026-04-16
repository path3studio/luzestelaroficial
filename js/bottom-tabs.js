/**
 * Luz Estelar — Bottom Tab Bar (PWA app-like navigation)
 * Include this script on any app page to inject a sticky tab bar.
 * Auto-detects the current page and highlights the active tab.
 *
 * Usage: <script src="/js/bottom-tabs.js" defer></script>
 */
(function(){
  var tabs = [
    { id:'hoy',    label:'Hoy',    icon:'☀️', href:'/mi-dia.html',  paths:['/mi-dia.html','/en/my-day.html'] },
    { id:'perfil', label:'Perfil', icon:'👤', href:'/dashboard.html', paths:['/dashboard.html','/en/dashboard.html'] },
    { id:'compat', label:'Compat.',icon:'💫', href:'/compatibilidad-personal.html', paths:['/compatibilidad-personal.html'] },
    { id:'ajustes',label:'Ajustes',icon:'⚙️', href:'/ajustes.html', paths:['/ajustes.html'] }
  ];

  var path = location.pathname;
  var active = '';
  for(var i=0;i<tabs.length;i++){
    for(var j=0;j<tabs[i].paths.length;j++){
      if(path===tabs[i].paths[j]){ active=tabs[i].id; break; }
    }
  }

  // Build HTML
  var html = '<nav id="le-tabs" role="navigation" aria-label="Navegacion principal">';
  for(var i=0;i<tabs.length;i++){
    var t = tabs[i];
    var cls = 'le-tab' + (t.id===active?' le-tab-active':'');
    var aria = t.id===active?' aria-current="page"':'';
    html += '<a href="'+t.href+'" class="'+cls+'"'+aria+'>';
    html += '<span class="le-tab-icon">'+t.icon+'</span>';
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
    '  height:64px;padding-bottom:env(safe-area-inset-bottom,0);',
    '  background:rgba(6,6,26,0.92);',
    '  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);',
    '  border-top:1px solid rgba(212,168,73,0.12);',
    '}',
    '.le-tab{',
    '  display:flex;flex-direction:column;align-items:center;justify-content:center;',
    '  text-decoration:none;color:rgba(255,255,255,0.4);',
    '  flex:1;height:100%;gap:2px;transition:color 0.2s;',
    '  -webkit-tap-highlight-color:transparent;',
    '}',
    '.le-tab-icon{font-size:22px;line-height:1;}',
    '.le-tab-label{font-family:"Inter",sans-serif;font-size:10px;font-weight:500;letter-spacing:0.5px;}',
    '.le-tab-active{color:#d4a849;}',
    '.le-tab-active .le-tab-label{font-weight:600;}',
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
  document.body.style.paddingBottom = 'calc(64px + env(safe-area-inset-bottom, 0px))';
})();
