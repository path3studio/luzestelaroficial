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
  var FOTO_PERFIL = false;
  var SLUG = {
    aries: 'aries', taurus: 'tauro', tauro: 'tauro', gemini: 'geminis', 'géminis': 'geminis', geminis: 'geminis',
    cancer: 'cancer', 'cáncer': 'cancer', leo: 'leo', virgo: 'virgo', libra: 'libra', scorpio: 'escorpio',
    escorpio: 'escorpio', sagittarius: 'sagitario', sagitario: 'sagitario', capricorn: 'capricornio',
    capricornio: 'capricornio', aquarius: 'acuario', acuario: 'acuario', pisces: 'piscis', piscis: 'piscis'
  };
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
    if (av === 'neutro' || !slug) {
      return '<span class="le-avatar" style="' + base + 'background:linear-gradient(135deg,#d4a849,#8f74d6);color:#14102a;' +
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
    var op = function (val, etiqueta, muestra) {
      return '<button type="button" data-av="' + val + '" style="background:none;border:1px solid rgba(212,168,73,.25);border-radius:14px;padding:12px 8px;' +
        'display:flex;flex-direction:column;align-items:center;gap:8px;color:#ece8f4;font:500 .82rem Inter,sans-serif;cursor:pointer;flex:1">' +
        muestra + '<span>' + etiqueta + '</span></button>';
    };
    var crit = Object.assign({}, p, { avatar: 'criatura' }), neu = Object.assign({}, p, { avatar: 'neutro' });
    ov.innerHTML = '<div style="width:100%;max-width:440px;background:#0d0d26;border:1px solid rgba(212,168,73,.25);border-bottom:none;' +
      'border-radius:20px 20px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0));text-align:center">' +
      '<p style="font:600 1.2rem \'Cormorant Garamond\',Georgia,serif;color:#f0d078;margin:0 0 4px">Imagen de ' + (nombre || 'tu perfil') + '</p>' +
      '<p style="font-size:.8rem;color:rgba(236,232,244,.6);margin:0 0 14px">Se ve en tu perfil y, si compartes tu perfil, también tus amigos la verán.</p>' +
      '<div style="display:flex;gap:10px">' + op('criatura', 'Criatura de su signo', html(crit, 64)) + op('neutro', 'Color neutro', html(neu, 64)) +
      (FOTO_PERFIL ? op('foto', 'Subir una foto', '<span style="width:64px;height:64px;border-radius:50%;display:grid;place-items:center;border:1px dashed rgba(212,168,73,.5);font-size:1.6rem">＋</span>') : '') +
      '</div><input type="file" accept="image/*" id="le-av-file" hidden>' +
      '<p id="le-av-msg" style="font-size:.8rem;color:#f0d078;min-height:1.1em;margin:10px 0 0"></p>' +
      '<button type="button" data-av="cerrar" style="margin-top:6px;background:none;border:none;color:rgba(236,232,244,.6);font:500 .9rem Inter,sans-serif;padding:8px 16px;cursor:pointer">Cancelar</button></div>';
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
