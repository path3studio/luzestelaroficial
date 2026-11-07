/*!
 * Luz Estelar — imagen de perfil (2026-11-06, aprobado por el dueño)
 * Cada perfil usa la criatura de su signo (assets/criaturas/<signo>.webp) o un color neutro con su inicial.
 * La foto propia está lista pero APAGADA (FOTO_PERFIL=false) hasta declararla en la Seguridad de los datos
 * de Google Play (lo hace la sesión de Play con el dueño).
 *
 *   LuzEstelar.Avatar.html(perfil, px)            → <span> redondo con la imagen
 *   LuzEstelar.Avatar.elegir(perfil, alGuardar)   → hoja para escoger; guarda en /api/profile/avatar
 */
(function () {
  'use strict';
  // 2026-11-06: foto propia ENCENDIDA en la web; dentro de la app Android (html.is-twa) sigue apagada hasta que
  // la sesión de Play la declare en «Seguridad de los datos» (subir = recopilar desde la app). Mostrar fotos subidas
  // desde la web sí se permite en la app.
  var EN_APP = document.documentElement.classList.contains('is-twa');
  // 6/nov 16:xx: declaración «Fotos» ENVIADA a revisión de Google con el OK del dueño (sesión Play) → también en la app.
  var FOTO_SUBIR = true;
  var FOTO_PERFIL = true;      // mostrar fotos ya guardadas
  var SLUG = {
    aries: 'aries', taurus: 'tauro', tauro: 'tauro', gemini: 'geminis', 'géminis': 'geminis', geminis: 'geminis',
    cancer: 'cancer', 'cáncer': 'cancer', leo: 'leo', virgo: 'virgo', libra: 'libra', scorpio: 'escorpio',
    escorpio: 'escorpio', sagittarius: 'sagitario', sagitario: 'sagitario', capricorn: 'capricornio',
    capricornio: 'capricornio', aquarius: 'acuario', acuario: 'acuario', pisces: 'piscis', piscis: 'piscis'
  };
  var CRIATURAS = ['aries','tauro','geminis','cancer','leo','virgo','libra','escorpio','sagitario','capricornio','acuario','piscis'];
  var NOMBRE_SIG = { aries:'Aries', tauro:'Tauro', geminis:'Géminis', cancer:'Cáncer', leo:'Leo', virgo:'Virgo', libra:'Libra',
    escorpio:'Escorpio', sagitario:'Sagitario', capricornio:'Capricornio', acuario:'Acuario', piscis:'Piscis' };
  var COLORES = { oro:'linear-gradient(135deg,#e2bd62,#b8862e)', lila:'linear-gradient(135deg,#a98ae8,#6a4fbf)',
    azul:'linear-gradient(135deg,#6fb3ef,#2f6fb8)', verde:'linear-gradient(135deg,#7fd6a6,#2f8f68)',
    rosa:'linear-gradient(135deg,#f0a6c8,#c45a8f)', coral:'linear-gradient(135deg,#f7a07a,#d1553a)',
    plata:'linear-gradient(135deg,#dfe3ea,#8a93a6)', noche:'linear-gradient(135deg,#3b3a78,#15142e)' };
  function slugDe(p) {
    var s = String((p && (p.western_sign || p.westernSign || p.sol || p.sign)) || '').toLowerCase().trim();
    return SLUG[s] || null;
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function inicial(p) { return esc(String((p && (p.nombre || p.name || p.label)) || '·').trim().charAt(0).toUpperCase() || '·'); }

  function html(p, px) {
    px = px || 40;
    var base = 'display:inline-grid;place-items:center;flex:none;width:' + px + 'px;height:' + px + 'px;border-radius:50%;overflow:hidden;' +
      'border:1px solid rgba(212,168,73,.35);background:linear-gradient(135deg,#2a2550,#1a1838);';
    var av = p && p.avatar;
    if (av && /^data:image\//.test(av) && FOTO_PERFIL) {
      return '<span class="le-avatar" style="' + base + '"><img src="' + esc(av) + '" alt="" style="width:100%;height:100%;object-fit:cover"></span>';
    }
    var slug = slugDe(p);
    if (av && av.indexOf('criatura:') === 0 && CRIATURAS.indexOf(av.slice(9)) >= 0) slug = av.slice(9);
    var color = (av && av.indexOf('color:') === 0 && COLORES[av.slice(6)]) ? COLORES[av.slice(6)] : null;
    if (av === 'neutro' || color || !slug) {
      var tinta = (av === 'color:noche' || av === 'color:lila' || av === 'color:azul') ? '#f4f0fb' : '#14102a';
      return '<span class="le-avatar" style="' + base + 'background:' + (color || 'linear-gradient(135deg,#d4a849,#8f74d6)') + ';color:' + tinta + ';' +
        'font:700 ' + Math.round(px * 0.45) + 'px \'Cormorant Garamond\',Georgia,serif">' + inicial(p) + '</span>';
    }
    return '<span class="le-avatar" style="' + base + '"><img src="/assets/criaturas/' + slug + '.webp" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></span>';
  }

  function token() { try { return localStorage.getItem('le_token'); } catch (e) { return null; } }
  function guardar(pid, avatar) {
    var h = { 'Content-Type': 'application/json' }; var t = token(); if (t) h['Authorization'] = 'Bearer ' + t;
    return fetch('/api/profile/avatar', { method: 'POST', credentials: 'same-origin', headers: h, body: JSON.stringify({ profile_id: pid, avatar: avatar }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.ok) throw new Error(d.error || 'No se pudo guardar'); return d; }); });
  }
  // Foto propia (2026-11-06): se lee como data: (la CSP no permite blob: en img-src → antes «Imagen no válida»),
  // la persona la ACOMODA (arrastrar + zoom) dentro del círculo, y se guarda a 160 px JPEG (~10-20 KB).
  function leer(file) {
    return new Promise(function (ok, no) {
      if (!file || !/^image\//.test(file.type || 'image/')) return no(new Error('Ese archivo no es una imagen'));
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () { ok(img); };
        img.onerror = function () { no(new Error('No pude abrir esa imagen. Prueba con una foto JPG o PNG.')); };
        img.src = fr.result;
      };
      fr.onerror = function () { no(new Error('No pude leer la imagen')); };
      fr.readAsDataURL(file);
    });
  }
  function acomodar(img, contenedor, alListo, alCancelar) {
    var V = 240, z = 1, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var s0 = V / Math.min(w, h), ox, oy;
    var esc2 = function () { return s0 * z; };
    var centrar = function () { ox = (V - w * esc2()) / 2; oy = (V - h * esc2()) / 2; };
    var limitar = function () {
      var W = w * esc2(), H = h * esc2();
      ox = Math.min(0, Math.max(V - W, ox)); oy = Math.min(0, Math.max(V - H, oy));
    };
    centrar();
    contenedor.innerHTML = '<p style="font:600 1.15rem \'Cormorant Garamond\',Georgia,serif;color:#f0d078;margin:0 0 4px">Acomoda tu foto</p>' +
      '<p style="font-size:.8rem;color:rgba(236,232,244,.6);margin:0 0 12px">Arrastra para moverla y usa la barra para acercar.</p>' +
      '<canvas id="le-crop" width="' + V + '" height="' + V + '" style="width:' + V + 'px;height:' + V + 'px;border-radius:50%;' +
      'border:2px solid #d4a849;touch-action:none;cursor:grab;background:#1a1838"></canvas>' +
      '<input id="le-zoom" type="range" min="1" max="3" step="0.01" value="1" aria-label="Acercar" style="display:block;width:220px;margin:14px auto 4px;accent-color:#d4a849">' +
      '<div style="display:flex;gap:10px;justify-content:center;margin-top:10px">' +
      '<button type="button" id="le-crop-no" style="background:none;border:1px solid rgba(212,168,73,.35);color:#ece8f4;border-radius:12px;padding:10px 16px;font:500 .9rem Inter,sans-serif;cursor:pointer">Otra imagen</button>' +
      '<button type="button" id="le-crop-si" style="background:linear-gradient(135deg,#e2bd62,#c8963a);color:#14102a;border:none;border-radius:12px;padding:10px 18px;font:700 .9rem Inter,sans-serif;cursor:pointer">Usar esta foto</button></div>';
    var cv = contenedor.querySelector('#le-crop'), ctx = cv.getContext('2d');
    var pintar = function () { ctx.clearRect(0, 0, V, V); ctx.drawImage(img, ox, oy, w * esc2(), h * esc2()); };
    pintar();
    var arrastre = null;
    cv.addEventListener('pointerdown', function (e) { arrastre = { x: e.clientX, y: e.clientY, ox: ox, oy: oy }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', function (e) {
      if (!arrastre) return;
      ox = arrastre.ox + (e.clientX - arrastre.x); oy = arrastre.oy + (e.clientY - arrastre.y); limitar(); pintar();
    });
    var soltar = function () { arrastre = null; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
    contenedor.querySelector('#le-zoom').addEventListener('input', function () {
      var cx = (V / 2 - ox) / esc2(), cy = (V / 2 - oy) / esc2();   // punto de la imagen en el centro
      z = parseFloat(this.value) || 1;
      ox = V / 2 - cx * esc2(); oy = V / 2 - cy * esc2(); limitar(); pintar();
    });
    contenedor.querySelector('#le-crop-no').addEventListener('click', alCancelar);
    contenedor.querySelector('#le-crop-si').addEventListener('click', function () {
      var L = 160, k = L / V, out = document.createElement('canvas'); out.width = out.height = L;
      var c2 = out.getContext('2d'); c2.fillStyle = '#1a1838'; c2.fillRect(0, 0, L, L);
      c2.drawImage(img, ox * k, oy * k, w * esc2() * k, h * esc2() * k);
      alListo(out.toDataURL('image/jpeg', 0.85));
    });
  }

  function elegir(p, alGuardar) {
    if (!p || !p.id) return;
    var ov = document.createElement('div');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Elegir imagen');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(4,4,18,.78);display:flex;align-items:flex-end;justify-content:center';
    var nombre = esc((p.nombre || p.name || p.label || '').split(' ')[0]);
    var mio = slugDe(p);
    var celda = function (val, muestra, titulo, marcado) {
      return '<button type="button" data-av="' + val + '" title="' + esc(titulo) + '" aria-label="' + esc(titulo) + '" style="background:none;border:2px solid ' +
        (marcado ? '#d4a849' : 'transparent') + ';border-radius:50%;padding:2px;cursor:pointer;line-height:0">' + muestra + '</button>';
    };
    var actual = p.avatar || 'criatura';
    var crits = CRIATURAS.slice().sort(function (x, y) { return (x === mio ? -1 : 0) - (y === mio ? -1 : 0); }).map(function (c) {
      var val = (c === mio) ? 'criatura' : 'criatura:' + c;
      return celda(val, html({ avatar: 'criatura:' + c, western_sign: c }, 52), NOMBRE_SIG[c] + (c === mio ? ' (tu signo)' : ''), actual === val || actual === 'criatura:' + c && c !== mio);
    }).join('');
    var cols = Object.keys(COLORES).map(function (k) {
      return celda('color:' + k, html(Object.assign({}, p, { avatar: 'color:' + k }), 44), 'Color ' + k, actual === 'color:' + k);
    }).join('');
    var tit = function (t) { return '<p style="font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;color:rgba(212,168,73,.85);margin:14px 0 8px">' + t + '</p>'; };
    ov.innerHTML = '<div style="width:100%;max-width:460px;max-height:86vh;overflow-y:auto;background:#0d0d26;border:1px solid rgba(212,168,73,.25);border-bottom:none;' +
      'border-radius:20px 20px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0));text-align:center">' +
      '<p style="font:600 1.2rem \'Cormorant Garamond\',Georgia,serif;color:#f0d078;margin:0 0 4px">Imagen de ' + (nombre || 'tu perfil') + '</p>' +
      '<p style="font-size:.8rem;color:rgba(236,232,244,.6);margin:0">Se ve en tu perfil y, si compartes tu perfil, también tus amigos la verán.</p>' +
      (FOTO_SUBIR ? tit('Tu foto') + '<button type="button" data-av="foto" style="background:none;border:1px dashed rgba(212,168,73,.55);border-radius:14px;color:#f0d078;' +
        'font:600 .9rem Inter,sans-serif;padding:12px 18px;cursor:pointer">＋ Subir una foto</button>' : '') +
      tit('Criaturas') + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;justify-items:center">' + crits + '</div>' +
      tit('Colores') + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;justify-items:center">' + cols + '</div>' +
      '<input type="file" accept="image/*" id="le-av-file" hidden>' +
      '<p id="le-av-msg" style="font-size:.8rem;color:#f0d078;min-height:1.1em;margin:12px 0 0"></p>' +
      '<button type="button" data-av="cerrar" style="margin-top:4px;background:none;border:none;color:rgba(236,232,244,.6);font:500 .9rem Inter,sans-serif;padding:8px 16px;cursor:pointer">Cancelar</button></div>';
    // 2026-11-06 QA: el botón «atrás» de Android cierra la hoja (antes salía de la página)
    var cerrada = false;
    var alAtras = function () { cerrar(true); };
    var cerrar = function (desdeAtras) {
      if (cerrada) return; cerrada = true;
      try { ov.remove(); } catch (e) {}
      window.removeEventListener('popstate', alAtras);
      if (desdeAtras !== true) { try { if (history.state && history.state.capaAv) history.back(); } catch (e) {} }
    };
    var msg = function (t) { var m = ov.querySelector('#le-av-msg'); if (m) m.textContent = t; };
    var aplicar = function (val) {
      msg('Guardando…');
      guardar(p.id, val).then(function () { p.avatar = val; cerrar(); if (alGuardar) alGuardar(val); })
        .catch(function (e) { msg(e.message || 'No se pudo guardar'); });
    };
    ov.addEventListener('click', function (e) {
      if (e.target === ov) return cerrar();
      var b = e.target.closest && e.target.closest('[data-av]'); if (!b) return;
      var v = b.getAttribute('data-av');
      if (v === 'cerrar') return cerrar();
      if (v === 'foto') return ov.querySelector('#le-av-file').click();
      aplicar(v);
    });
    ov.querySelector('#le-av-file').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var input = this; msg('Abriendo la foto…');
      leer(f).then(function (img) {
        var hoja = ov.firstElementChild, antes = hoja.innerHTML;
        acomodar(img, hoja, function (dataUrl) { hoja.innerHTML = antes + ''; aplicar(dataUrl); },
          function () { input.value = ''; cerrar(true); elegir(p, alGuardar); });
      }).catch(function (e) { msg(e.message); });
    });
    document.body.appendChild(ov);
    try { history.pushState({ capaAv: 1 }, '', location.href); } catch (e) {}
    window.addEventListener('popstate', alAtras);
  }

  window.LuzEstelar = window.LuzEstelar || {};
  window.LuzEstelar.Avatar = { html: html, elegir: elegir, slugDe: slugDe, FOTO_PERFIL: FOTO_PERFIL };
})();
