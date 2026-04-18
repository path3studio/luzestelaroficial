/**
 * Luz Estelar — Upgrade Sheet (PWA inline Plus flow)
 *
 * A bottom-sheet modal that starts the Stripe checkout directly from the PWA
 * shell, WITHOUT diverting to /planes.html (which exposes consultas /
 * mapa-estelar that are currently suspended).
 *
 *   LuzEstelar.UpgradeSheet.open({lang:'es'});
 *
 * The sheet self-injects on first open, so pages only need:
 *   <script src="/js/upgrade-sheet.js" defer></script>
 *
 * Copy: bilingual (es / en). Pricing: $2.50/mes annual · $3.99/mes monthly
 * (7-day free trial on both). Kept in sync with /planes.html — update here
 * when prices change.
 */
(function(){
  'use strict';
  var ns = (window.LuzEstelar = window.LuzEstelar || {});
  if (ns.UpgradeSheet) return;

  var COPY = {
    es: {
      title: 'Plus — 7 días gratis',
      sub:   'Desbloquea tu universo completo',
      benefits: [
        'Reporte Cross-Cultural: síntesis de 8 sistemas',
        'Lecturas diarias de los 7 sistemas (no sólo 3)',
        'Compatibilidad profunda entre perfiles',
        'Hasta 5 perfiles · sin publicidad'
      ],
      annual:  'Anual',
      monthly: 'Mensual',
      annualPrice:  '$2,50',
      monthlyPrice: '$3,99',
      perMonth: '/ mes',
      annualNote:  'Facturado $29,99/año · ahorras 37%',
      monthlyNote: 'Se renueva cada mes',
      trial: 'Primeros 7 días gratis. Cancela cuando quieras.',
      cta: 'Empezar 7 días gratis',
      loading: 'Abriendo Stripe…',
      close: 'Cerrar',
      fail: 'No se pudo iniciar la suscripción. Intenta de nuevo.'
    },
    en: {
      title: 'Plus — 7 days free',
      sub:   'Unlock your complete universe',
      benefits: [
        'Cross-Cultural report: synthesis of 8 systems',
        'Daily readings for all 7 systems (not just 3)',
        'Deep compatibility between profiles',
        'Up to 5 profiles · no ads'
      ],
      annual:  'Annual',
      monthly: 'Monthly',
      annualPrice:  '$2.50',
      monthlyPrice: '$3.99',
      perMonth: '/ mo',
      annualNote:  'Billed $29.99/yr · save 37%',
      monthlyNote: 'Renews every month',
      trial: 'First 7 days free. Cancel anytime.',
      cta: 'Start 7-day free trial',
      loading: 'Opening Stripe…',
      close: 'Close',
      fail: 'Could not start the subscription. Please try again.'
    }
  };

  var injected = false;
  var state = { cadence: 'annual', lang: 'es' };

  function getToken(){ try { return localStorage.getItem('le_token'); } catch(e){ return null; } }

  function authFetch(url, opts){
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = opts.headers || {};
    opts.headers['Content-Type'] = 'application/json';
    var t = getToken();
    if (t) opts.headers['Authorization'] = 'Bearer ' + t;
    return fetch(url, opts);
  }

  function inject(){
    if (injected) return;
    injected = true;

    var style = document.createElement('style');
    style.textContent = [
      '.le-up-bg{position:fixed;inset:0;background:rgba(0,0,0,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:10000;opacity:0;pointer-events:none;transition:opacity .2s}',
      '.le-up-bg.active{opacity:1;pointer-events:auto}',
      '.le-up-sheet{position:fixed;left:0;right:0;bottom:0;z-index:10001;max-width:480px;margin:0 auto;background:#0c0c2a;border-top-left-radius:20px;border-top-right-radius:20px;border:1px solid rgba(255,255,255,.06);border-bottom:none;padding:8px 20px calc(22px + env(safe-area-inset-bottom,0));transform:translateY(100%);transition:transform .26s cubic-bezier(.25,.1,.25,1);max-height:92vh;overflow-y:auto}',
      '.le-up-sheet.active{transform:translateY(0)}',
      '.le-up-handle{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.14);margin:6px auto 14px}',
      '.le-up-title{font-family:"Cormorant Garamond",serif;font-size:1.35rem;font-weight:700;color:#d4a849;text-align:center;line-height:1.2}',
      '.le-up-sub{font-size:.78rem;color:rgba(255,255,255,.55);text-align:center;margin:4px 0 16px}',
      '.le-up-list{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:8px}',
      '.le-up-list li{font-size:.86rem;line-height:1.45;color:rgba(255,255,255,.82);padding-left:22px;position:relative}',
      '.le-up-list li::before{content:"\\2728";position:absolute;left:0;top:1px;color:#d4a849;font-size:.8rem}',
      '.le-up-toggle{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}',
      '.le-up-opt{position:relative;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 10px 11px;cursor:pointer;text-align:center;transition:border-color .2s,background .2s;-webkit-tap-highlight-color:transparent}',
      '.le-up-opt:active{background:rgba(255,255,255,.05)}',
      '.le-up-opt.on{border-color:#d4a849;background:rgba(212,168,73,.08)}',
      '.le-up-opt .lbl{display:block;font-size:.7rem;font-weight:600;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}',
      '.le-up-opt.on .lbl{color:#d4a849}',
      '.le-up-opt .price{display:block;font-family:"Cormorant Garamond",serif;font-size:1.35rem;font-weight:700;color:#fff;line-height:1.15}',
      '.le-up-opt .unit{font-size:.72rem;color:rgba(255,255,255,.5);font-weight:400;font-family:"Inter",sans-serif;margin-left:2px}',
      '.le-up-opt .note{display:block;font-size:.64rem;color:rgba(255,255,255,.5);margin-top:3px}',
      '.le-up-opt .save{position:absolute;top:-8px;right:8px;font-size:.6rem;font-weight:700;color:#06061a;background:linear-gradient(135deg,#d4a849,#f0d078);padding:2px 8px;border-radius:8px;letter-spacing:.04em}',
      '.le-up-trial{font-size:.72rem;color:rgba(255,255,255,.55);text-align:center;margin-bottom:14px}',
      '.le-up-cta{display:block;width:100%;padding:14px;background:linear-gradient(135deg,#d4a849,#c89030);color:#06061a;font-family:"Inter",sans-serif;font-size:.95rem;font-weight:700;border:none;border-radius:12px;cursor:pointer;transition:opacity .2s;-webkit-tap-highlight-color:transparent}',
      '.le-up-cta:active{opacity:.85}',
      '.le-up-cta:disabled{opacity:.55;cursor:not-allowed}',
      '.le-up-err{display:none;font-size:.76rem;color:#e07a7a;text-align:center;margin-top:10px}',
      '.le-up-err.on{display:block}',
      '.le-up-close{position:absolute;top:10px;right:14px;background:none;border:none;color:rgba(255,255,255,.55);font-size:1.05rem;cursor:pointer;padding:6px 8px;-webkit-tap-highlight-color:transparent}'
    ].join('');
    document.head.appendChild(style);

    var bg = document.createElement('div');
    bg.className = 'le-up-bg';
    bg.id = 'le-up-bg';

    var sheet = document.createElement('div');
    sheet.className = 'le-up-sheet';
    sheet.id = 'le-up-sheet';
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-modal','true');
    sheet.innerHTML =
      '<button type="button" class="le-up-close" id="le-up-close" aria-label="Cerrar">&times;</button>'+
      '<div class="le-up-handle"></div>'+
      '<h2 class="le-up-title" id="le-up-title"></h2>'+
      '<p class="le-up-sub" id="le-up-sub"></p>'+
      '<ul class="le-up-list" id="le-up-list"></ul>'+
      '<div class="le-up-toggle" id="le-up-toggle"></div>'+
      '<p class="le-up-trial" id="le-up-trial"></p>'+
      '<button type="button" class="le-up-cta" id="le-up-cta"></button>'+
      '<p class="le-up-err" id="le-up-err"></p>';

    document.body.appendChild(bg);
    document.body.appendChild(sheet);

    bg.addEventListener('click', close);
    document.getElementById('le-up-close').addEventListener('click', close);
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && bg.classList.contains('active')) close();
    });
    document.getElementById('le-up-cta').addEventListener('click', onCta);
  }

  function render(){
    var c = COPY[state.lang] || COPY.es;
    document.getElementById('le-up-title').textContent = c.title;
    document.getElementById('le-up-sub').textContent   = c.sub;
    document.getElementById('le-up-close').setAttribute('aria-label', c.close);

    var ul = document.getElementById('le-up-list');
    ul.innerHTML = '';
    for (var i=0;i<c.benefits.length;i++){
      var li = document.createElement('li');
      li.textContent = c.benefits[i];
      ul.appendChild(li);
    }

    var tog = document.getElementById('le-up-toggle');
    tog.innerHTML = '';
    var opts = [
      {id:'annual',  lbl:c.annual,  price:c.annualPrice,  note:c.annualNote,  save:'-37%'},
      {id:'monthly', lbl:c.monthly, price:c.monthlyPrice, note:c.monthlyNote, save:null}
    ];
    opts.forEach(function(o){
      var d = document.createElement('div');
      d.className = 'le-up-opt' + (state.cadence===o.id ? ' on' : '');
      d.setAttribute('role','button');
      d.setAttribute('tabindex','0');
      d.dataset.cad = o.id;
      d.innerHTML =
        (o.save ? '<span class="save">'+o.save+'</span>' : '') +
        '<span class="lbl">'+o.lbl+'</span>'+
        '<span class="price">'+o.price+'<span class="unit">'+c.perMonth+'</span></span>'+
        '<span class="note">'+o.note+'</span>';
      d.addEventListener('click', function(){
        state.cadence = this.dataset.cad;
        render();
      });
      tog.appendChild(d);
    });

    document.getElementById('le-up-trial').textContent = c.trial;
    var cta = document.getElementById('le-up-cta');
    cta.textContent = c.cta;
    cta.disabled = false;
    var err = document.getElementById('le-up-err');
    err.classList.remove('on');
    err.textContent = '';
  }

  async function onCta(){
    var c = COPY[state.lang] || COPY.es;
    var btn = this;
    var err = document.getElementById('le-up-err');
    err.classList.remove('on');
    btn.disabled = true;
    btn.textContent = c.loading;
    try {
      var res = await authFetch('/api/billing/create-subscription', {
        method: 'POST',
        body: JSON.stringify({ lang: state.lang, cadence: state.cadence })
      });
      var data = await res.json().catch(function(){return {};});
      if (res.status === 401) {
        // Not signed in — send to login, preserving return
        var back = encodeURIComponent(location.pathname + location.search);
        location.assign('/login.html?redirect=' + back);
        return;
      }
      if (data && data.ok && data.url) {
        // Hand off to Stripe (same tab — Stripe returns here after success/cancel)
        location.assign(data.url);
        return;
      }
      throw new Error((data && data.error) || c.fail);
    } catch(e) {
      err.textContent = (e && e.message) || c.fail;
      err.classList.add('on');
      btn.disabled = false;
      btn.textContent = c.cta;
    }
  }

  function open(opts){
    opts = opts || {};
    state.lang = (opts.lang === 'en') ? 'en'
              : (opts.lang === 'es') ? 'es'
              : (document.documentElement.lang === 'en' ? 'en' : 'es');
    state.cadence = opts.cadence === 'monthly' ? 'monthly' : 'annual';
    inject();
    render();
    var bg = document.getElementById('le-up-bg');
    var sh = document.getElementById('le-up-sheet');
    // Next tick so transition fires
    requestAnimationFrame(function(){
      bg.classList.add('active');
      sh.classList.add('active');
    });
    document.body.style.overflow = 'hidden';
  }

  function close(){
    var bg = document.getElementById('le-up-bg');
    var sh = document.getElementById('le-up-sheet');
    if (bg) bg.classList.remove('active');
    if (sh) sh.classList.remove('active');
    document.body.style.overflow = '';
  }

  ns.UpgradeSheet = { open: open, close: close };
})();
