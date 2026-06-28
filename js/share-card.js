/*!
 * Luz Estelar — Share Card Generator
 * ───────────────────────────────────
 * Paints a 1080×1920 story-format PNG of the user's natal chart with
 * branding, Sol/Luna/Asc badges, name + birth date. Then pipes it
 * through the Web Share API (native share sheet on mobile) with a
 * graceful fallback to direct download on desktop / browsers without
 * file-sharing support.
 *
 * Usage:
 *   LuzEstelar.ShareCard.build({
 *     profile: currentProfile,
 *     chartData: currentChartData,
 *     lang: 'es' | 'en',
 *   }).then(blob => LuzEstelar.ShareCard.share(blob, { lang, caption }));
 *
 * Zero dependencies — reuses LuzEstelar.NatalChart to paint the wheel
 * onto an offscreen canvas, then composites onto the share canvas.
 */
(function () {
  'use strict';

  var ns = (window.LuzEstelar = window.LuzEstelar || {});
  if (ns.ShareCard) return;

  // Share-card dimensions. Halved from the original 1080×1920 after
  // reports of canvas.toBlob silently failing on low-RAM Android
  // devices when working with ~2MP canvases plus a 900px secondary
  // canvas. 720×1280 still looks crisp as an Instagram Story / TikTok
  // background and uses a quarter of the pixel memory.
  var W = 720, H = 1280;

  // Localized copy — short, calm, gold-on-dark register.
  var COPY = {
    es: {
      title:  'CARTA NATAL',
      sun:    'SOL',    moon: 'LUNA',   asc: 'ASC',
      brand:  'Luz Estelar',
      url:    'luzestelaroficial.com',
      dateFmt: function (y, m, d) {
        var MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        return d + ' de ' + MONTHS[m - 1] + ' de ' + y;
      },
      caption: function (name) {
        return 'Mi carta natal — ' + name + ' ✨ Generada en Luz Estelar · luzestelaroficial.com';
      },
      loading: 'Generando tu carta…',
      ready:   'Carta lista — compartiendo',
      downloaded: 'Descargada',
      fail:    'No se pudo generar la carta',
    },
    en: {
      title:  'NATAL CHART',
      sun:    'SUN',    moon: 'MOON',   asc: 'ASC',
      brand:  'Luz Estelar',
      url:    'luzestelaroficial.com',
      dateFmt: function (y, m, d) {
        var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        return MONTHS[m - 1] + ' ' + d + ', ' + y;
      },
      caption: function (name) {
        return 'My natal chart — ' + name + ' ✨ Generated on Luz Estelar · luzestelaroficial.com';
      },
      loading: 'Generating your chart…',
      ready:   'Chart ready — sharing',
      downloaded: 'Downloaded',
      fail:    'Could not generate chart',
    }
  };

  // Zodiac sign translations — share card reads the chart's English sign
  // names and localises them for the Sol/Luna/Asc badge display.
  var SIGN_DISPLAY = {
    es: {
      Aries:'Aries', Taurus:'Tauro', Gemini:'Géminis', Cancer:'Cáncer',
      Leo:'Leo', Virgo:'Virgo', Libra:'Libra', Scorpio:'Escorpio',
      Sagittarius:'Sagitario', Capricorn:'Capricornio',
      Aquarius:'Acuario', Pisces:'Piscis'
    },
    en: {
      Aries:'Aries', Taurus:'Taurus', Gemini:'Gemini', Cancer:'Cancer',
      Leo:'Leo', Virgo:'Virgo', Libra:'Libra', Scorpio:'Scorpio',
      Sagittarius:'Sagittarius', Capricorn:'Capricorn',
      Aquarius:'Aquarius', Pisces:'Pisces'
    }
  };

  // Zodiac glyphs — each suffixed with U+FE0E (VS15 variation selector)
  // so Android / iOS render them in TEXT style (gold/line) instead of
  // colour-emoji style. Without VS15 you'd get e.g. Virgo as a purple
  // rounded-rect with a white ♍ inside, which breaks the monochrome
  // gold visual of the rest of the badge row.
  // Keys include both English (how natal_chart stores signs internally)
  // and Spanish (how the slma badges render them after localisation),
  // so the lookup works regardless of which form the caller passes.
  var VS = '\uFE0E';
  var SIGN_GLYPH = {
    // English
    Aries:'\u2648'+VS, Taurus:'\u2649'+VS, Gemini:'\u264A'+VS, Cancer:'\u264B'+VS,
    Leo:'\u264C'+VS,   Virgo:'\u264D'+VS,  Libra:'\u264E'+VS,  Scorpio:'\u264F'+VS,
    Sagittarius:'\u2650'+VS, Capricorn:'\u2651'+VS, Aquarius:'\u2652'+VS, Pisces:'\u2653'+VS,
    // Spanish (the localised display forms used in the PWA)
    'Tauro':'\u2649'+VS, 'Géminis':'\u264A'+VS, 'Cáncer':'\u264B'+VS,
    'Escorpio':'\u264F'+VS, 'Sagitario':'\u2650'+VS, 'Capricornio':'\u2651'+VS,
    'Acuario':'\u2652'+VS, 'Piscis':'\u2653'+VS
    // Aries / Leo / Virgo / Libra spell identically in ES and EN.
  };

  /**
   * Build the share card. Returns a Promise<Blob> of the PNG.
   * Never throws synchronously — every error path rejects the Promise
   * so the caller gets a clean .catch with a real error message, which
   * can then be surfaced in the share button text.
   */
  function build(opts) {
    // Progress callback — lets the caller (e.g. the share button
    // handler) update its label as we move through stages. If ANY
    // step hangs, the button text reveals which step the user last
    // saw, which pinpoints the culprit ("Fondo…", "Carta…",
    // "Codificando…", etc.).
    var progress = (opts && typeof opts.progress === 'function') ? opts.progress : function () {};

    return new Promise(function (resolve, reject) {
      opts = opts || {};
      var lang = opts.lang === 'en' ? 'en' : 'es';
      var t = COPY[lang];
      var profile = opts.profile || {};
      var chartData = opts.chartData;
      if (!chartData || !chartData.planets) {
        return reject(new Error('missing chartData.planets'));
      }

      var canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas 2d context unavailable'));

      // Each phase is a named function that runs between yields. If
      // one hangs, the button label freezes on its name, telling us
      // exactly which step misbehaves. Yields use setTimeout(0) so the
      // browser actually paints the updated label between steps.
      var chartSize = 600;
      var chartX = (W - chartSize) / 2;
      var chartY = 310;

      function paintBackground() {
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0.00, '#0a0a2a');
        bg.addColorStop(0.35, '#0c0c3a');
        bg.addColorStop(0.70, '#09092e');
        bg.addColorStop(1.00, '#05051a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        var topGlow = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, W * 0.9);
        topGlow.addColorStop(0, 'rgba(212,168,73,0.18)');
        topGlow.addColorStop(1, 'rgba(212,168,73,0)');
        ctx.fillStyle = topGlow;
        ctx.fillRect(0, 0, W, H * 0.4);
        var rng = seededRng(profile.id || profile.nombre || 'luz-estelar');
        for (var i = 0; i < 120; i++) {
          var sx = rng() * W, sy = rng() * H;
          var sr = rng() * 1.3 + 0.3;
          var sa = rng() * 0.5 + 0.35;
          ctx.fillStyle = 'rgba(255,248,220,' + sa.toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function paintText() {
        ctx.fillStyle = 'rgba(212,168,73,0.85)';
        ctx.font = '500 34px Georgia, "Times New Roman", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        drawSpacedText(ctx, t.title, W / 2, 72, 5);
        var firstName = (profile.nombre || '—').split(' ')[0];
        ctx.fillStyle = '#f5dfa6';
        ctx.font = '700 86px Georgia, "Times New Roman", serif';
        ctx.fillText(firstName, W / 2, 112);
        var dateText = '';
        if (profile.fecha_nacimiento) {
          var parts = profile.fecha_nacimiento.split('-').map(Number);
          if (parts[0] && parts[1] && parts[2]) dateText = t.dateFmt(parts[0], parts[1], parts[2]);
        }
        var placeText = profile.lugar_nacimiento || '';
        ctx.fillStyle = 'rgba(224,220,232,0.72)';
        ctx.font = '400 25px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText(dateText, W / 2, 220);
        if (placeText) {
          ctx.fillStyle = 'rgba(224,220,232,0.55)';
          ctx.font = '400 20px "Helvetica Neue", Arial, sans-serif';
          ctx.fillText(placeText, W / 2, 257);
        }
      }

      function paintChart() {
        // Reuse the on-screen natal canvas — it's already drawn, so we
        // just drawImage it. Drastically faster than re-rendering.
        var onScreen = opts.sourceCanvas || document.getElementById('natal');
        if (onScreen && onScreen.width > 0 && onScreen.height > 0) {
          ctx.drawImage(onScreen, chartX, chartY, chartSize, chartSize);
          return;
        }
        // Fallback: render offscreen (unlikely path since share button
        // only shows when the natal view is active and painted).
        if (!ns.NatalChart || !ns.NatalChart.render) {
          throw new Error('NatalChart unavailable and no on-screen source');
        }
        var fallbackCanv = document.createElement('canvas');
        ns.NatalChart.render(fallbackCanv, chartData, {
          size: chartSize, dpr: 1,
          signLabels: (lang === 'en')
            ? ['ARI','TAU','GEM','CAN','LEO','VIR','LIB','SCO','SAG','CAP','AQU','PIS']
            : undefined,
        });
        ctx.drawImage(fallbackCanv, chartX, chartY, chartSize, chartSize);
      }

      function paintDetails() {
        var badgeY = chartY + chartSize + 40;
        var sun  = findPlanet(chartData, 'Sun');
        var moon = findPlanet(chartData, 'Moon');
        var asc  = chartData.ascendant && chartData.ascendant.sign
                   ? chartData.ascendant
                   : findPlanet(chartData, 'Ascendant');
        // Fallback glyphs also VS15-suffixed so they render consistently
        // in text style if we ever fall back to them on a chart missing
        // sun/moon/asc data.
        drawBadge(ctx, W * 0.22, badgeY, t.sun,  sun  ? sun.sign  : null, '\u2609\uFE0E', lang);
        drawBadge(ctx, W * 0.50, badgeY, t.moon, moon ? moon.sign : null, '\u263D\uFE0E', lang);
        drawBadge(ctx, W * 0.78, badgeY, t.asc,  asc  ? asc.sign  : null, '\u2191\uFE0E', lang);
        ctx.fillStyle = 'rgba(212,168,73,0.82)';
        ctx.font = '600 30px Georgia, "Times New Roman", serif';
        ctx.fillText('\u2726  ' + t.brand + '  \u2726', W / 2, H - 110);
        ctx.fillStyle = 'rgba(224,220,232,0.55)';
        ctx.font = '400 19px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText(t.url, W / 2, H - 65);
      }

      // Ordered pipeline. Each entry: [progress label, sync function].
      // Yields after each step so the label actually paints; if a step
      // hangs, the button text freezes on its label.
      var steps = [
        ['Fondo',      paintBackground],
        ['Texto',      paintText],
        ['Carta',      paintChart],
        ['Detalles',   paintDetails],
      ];

      var idx = 0;
      function runNext() {
        if (idx >= steps.length) {
          progress('Codificando');
          // Another yield before the heavy encode so the label paints.
          setTimeout(function () { encodeCanvas(canvas, resolve, reject); }, 16);
          return;
        }
        var step = steps[idx++];
        progress(step[0]);
        setTimeout(function () {
          try {
            step[1]();
            runNext();
          } catch (e) {
            reject(new Error(step[0] + ': ' + (e.message || e)));
          }
        }, 16);
      }
      runNext();
    });
  }

  /**
   * canvas → Blob with hard timeout + toDataURL fallback.
   * canvas.toBlob has been seen to silently fail on low-RAM Android
   * Samsung Internet + older iOS Safari. If no callback fires in 8s,
   * we try toDataURL (which is synchronous and usually works even
   * when toBlob doesn't) and wrap the result into a Blob by hand.
   */
  function encodeCanvas(canvas, resolve, reject) {
    var settled = false;
    function fallbackViaDataURL(reason) {
      try {
        var url = canvas.toDataURL('image/png');
        resolve(dataURLToBlob(url));
      } catch (e) {
        reject(new Error(reason + ' + toDataURL failed: ' + (e.message || e)));
      }
    }

    if (typeof canvas.toBlob !== 'function') {
      return fallbackViaDataURL('toBlob unavailable');
    }

    var fallbackTimer = setTimeout(function () {
      if (settled) return;
      settled = true;
      fallbackViaDataURL('toBlob never called back (8s)');
    }, 8000);

    try {
      canvas.toBlob(function (blob) {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        if (blob) resolve(blob);
        else fallbackViaDataURL('toBlob returned null');
      }, 'image/png', 0.92);
    } catch (e) {
      if (!settled) {
        settled = true;
        clearTimeout(fallbackTimer);
        fallbackViaDataURL('toBlob threw: ' + (e.message || e));
      }
    }
  }

  function dataURLToBlob(dataURL) {
    var parts = dataURL.split(',');
    var header = parts[0] || '';
    var mimeMatch = header.match(/:(.*?);/);
    var mime = (mimeMatch && mimeMatch[1]) || 'image/png';
    var binary = atob(parts[1] || '');
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  /**
   * Share the blob via Web Share API with PNG file attachment.
   * Falls back to triggering a download. Returns Promise<boolean>
   * (true = shared via native sheet; false = fell back to download).
   */
  function share(blob, opts) {
    opts = opts || {};
    var lang = opts.lang === 'en' ? 'en' : 'es';
    var t = COPY[lang];
    var fileName = lang === 'en' ? 'luz-estelar-natal-chart.png' : 'luz-estelar-carta-natal.png';
    var file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({
        files: [file],
        title: t.title,
        text:  opts.caption || t.caption(opts.name || ''),
      }).then(function () { return true; })
        .catch(function (e) {
          // User cancellation throws AbortError — not a real failure.
          if (e && e.name === 'AbortError') return false;
          console.warn('[share-card] share failed, falling back to download', e);
          return downloadBlob(blob, fileName).then(function () { return false; });
        });
    }
    // No Web Share → download
    return downloadBlob(blob, fileName).then(function () { return false; });
  }

  /**
   * One-shot helper: build + share. Wires toast messages if LuzEstelar.toast
   * is available, otherwise runs silently. Adds a hard 20s timeout so if
   * canvas.toBlob silently fails on some devices (has been seen on older
   * Samsung Internet and iOS Safari) the button recovers with a real
   * error message instead of hanging on "Generando…" forever.
   */
  /**
   * Simple build — just blob-ifies the already-painted on-screen natal
   * canvas. No composition, no offscreen render, no layout pipeline.
   * Every fancy build() attempt hung on the user's device; this
   * bypasses all of it and is the reliable baseline. We can reintroduce
   * the branded card in a later pass once this works end-to-end.
   */
  function buildSimple(opts) {
    opts = opts || {};
    var progress = typeof opts.progress === 'function' ? opts.progress : function () {};
    return new Promise(function (resolve, reject) {
      progress('Preparando');
      // One tick for the progress label to paint.
      setTimeout(function () {
        var canvas = opts.sourceCanvas || document.getElementById('natal');
        if (!canvas) return reject(new Error('natal canvas not found'));
        if (!canvas.width || !canvas.height) {
          return reject(new Error('canvas has zero dimensions'));
        }
        progress('Codificando');
        // Another tick so "Codificando…" shows before the encode blocks.
        setTimeout(function () { encodeCanvas(canvas, resolve, reject); }, 16);
      }, 16);
    });
  }

  function buildAndShare(opts) {
    opts = opts || {};
    var lang = opts.lang === 'en' ? 'en' : 'es';
    var t = COPY[lang];
    // LuzEstelar.toast is the FUNCTION itself (usage: toast(msg, opts)),
    // not an object with a .show() method. Previously we were calling
    // `toast.show(...)` which threw TypeError synchronously and broke
    // the whole buildAndShare chain — the button stayed forever on
    // "Generando…" because the promise never settled. This bug is the
    // reason every previous share-card iteration looked broken.
    var toastFn = (window.LuzEstelar && typeof window.LuzEstelar.toast === 'function')
      ? window.LuzEstelar.toast
      : null;

    var pending = null;
    try {
      if (toastFn) pending = toastFn(t.loading, { kind: 'info', duration: 15000 });
    } catch (e) { /* toast is decorative — never let it break the share */ }

    // Hard 15s timeout — defence in depth on top of encodeCanvas' own
    // 8s toBlob→toDataURL fallback timer.
    var timeoutPromise = new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('timeout 15s')); }, 15000);
    });

    // Default to the branded full-card layout now that the root-cause
    // (toast.show TypeError) has been fixed. Callers can fall back to
    // the minimal chart-only PNG by passing { layout: 'simple' }.
    var builder = (opts.layout === 'simple') ? buildSimple : build;

    return Promise.race([builder(opts), timeoutPromise]).then(function (blob) {
      try { if (pending && pending.dismiss) pending.dismiss(); } catch (e) {}
      return share(blob, { lang: lang, name: (opts.profile && opts.profile.nombre) || '' })
        .then(function (sharedNatively) {
          try {
            if (toastFn) toastFn(sharedNatively ? t.ready : t.downloaded,
                                 { kind: 'success', duration: 3000 });
          } catch (e) {}
          return sharedNatively;
        });
    }).catch(function (e) {
      try { if (pending && pending.dismiss) pending.dismiss(); } catch (ex) {}
      console.warn('[share-card]', e);
      throw e;
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────

  function findPlanet(chartData, name) {
    if (!chartData || !chartData.planets) return null;
    for (var i = 0; i < chartData.planets.length; i++) {
      if (chartData.planets[i].name === name) return chartData.planets[i];
    }
    return null;
  }

  // Badge = small label + element-coloured disc + glyph + sign name.
  // Sizes scaled for the 720×1280 share canvas (was originally sized
  // for 1080×1920). Fonts are system-only (no Cormorant/Noto load)
  // so canvas rendering never blocks on a webfont fetch.
  function drawBadge(ctx, x, y, label, signName, fallbackGlyph, lang) {
    var glyph = signName && SIGN_GLYPH[signName] ? SIGN_GLYPH[signName] : fallbackGlyph;
    var display = signName
      ? (SIGN_DISPLAY[lang][signName] || signName)
      : '—';

    // Label (SOL / LUNA / ASC) above disc
    ctx.fillStyle = 'rgba(212,168,73,0.75)';
    ctx.font = '500 20px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y);

    // Glyph disc — 2026-06-28: dropped from y+40 → y+58 so the SOL/LUNA/ASC
    // label above it no longer grazes the sign glyph (user feedback).
    var discR = 46;
    var discY = y + 58;
    var g = ctx.createRadialGradient(x, discY, 0, x, discY, discR);
    g.addColorStop(0, 'rgba(212,168,73,0.24)');
    g.addColorStop(1, 'rgba(212,168,73,0.02)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, discY, discR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(212,168,73,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, discY, discR - 2, 0, Math.PI * 2); ctx.stroke();

    // Glyph — falls back to Segoe UI Symbol / system emoji-text.
    ctx.fillStyle = '#f5dfa6';
    ctx.font = '500 48px "Segoe UI Symbol", "Apple Symbols", serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, x, discY);

    // Sign name below disc
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 26px Georgia, "Times New Roman", serif';
    ctx.textBaseline = 'top';
    ctx.fillText(display, x, discY + discR + 12);
  }

  function drawSpacedText(ctx, text, x, y, spacing) {
    // Poor-man's letter-spacing for canvas. Works for short strings.
    var chars = text.split('');
    var totalWidth = 0;
    var widths = chars.map(function (c) {
      var w = ctx.measureText(c).width;
      totalWidth += w + spacing;
      return w;
    });
    totalWidth -= spacing;
    var cursor = x - totalWidth / 2;
    var prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    for (var i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cursor, y);
      cursor += widths[i] + spacing;
    }
    ctx.textAlign = prevAlign;
  }

  function downloadBlob(blob, fileName) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      }, 100);
    });
  }

  // Tiny seeded random — returns a function() → [0, 1) seeded by string.
  // Used so the backdrop starfield is stable for the same user
  // (same name → same pattern) but differs between users. LOCAL, does
  // not touch Math.random.
  function seededRng(seedStr) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 100000) / 100000;
    };
  }

  // Expose
  ns.ShareCard = {
    build: build,
    share: share,
    buildAndShare: buildAndShare,
  };
})();
