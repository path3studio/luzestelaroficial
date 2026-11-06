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
  var FOTO_SUBIR = !EN_APP;
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
  // Foto propia: se reduce en el teléfono a 160 px JPEG (~10-20 KB) antes de subirla.
  function reducir(file) {
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var L = 160, c = document.createElement('canvas'); c.width = c.height = L;
        var m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2;
        c.getContext('2d').drawImage(img, sx, sy, m, m, 0, 0, L, L); URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('Imagen no válida')); };
      img.src = url;
    });
  }

  function elegir(p, alGuardar) {
    if (!p || !p.id) return;
    var ov = document.createElement('div');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Elegir imagen');
    ov.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(4,4,18,.78);display:flex;align-items:flex-end;justify-content:center';
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
    var cerrar = function () { try { ov.remove(); } catch (e) {} };
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
      msg('Preparando la foto…');
      reducir(f).then(aplicar).catch(function (e) { msg(e.message); });
    });
    document.body.appendChild(ov);
  }

  window.LuzEstelar = window.LuzEstelar || {};
  window.LuzEstelar.Avatar = { html: html, elegir: elegir, slugDe: slugDe, FOTO_PERFIL: FOTO_PERFIL };
})();
