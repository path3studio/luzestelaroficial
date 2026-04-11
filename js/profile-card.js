/**
 * profile-card.js — Generate shareable profile card as PNG
 * ========================================================
 * Creates a 1080x1920 (Story format) canvas with cosmic aesthetic
 * showing all 7 date-based systems + optional enneagram.
 *
 * Usage:
 *   LuzEstelar.ProfileCard.generate(profile, lang)
 *     → returns a Promise<Blob> (PNG)
 *   LuzEstelar.ProfileCard.download(profile, lang)
 *     → triggers download
 *   LuzEstelar.ProfileCard.share(profile, lang)
 *     → uses Web Share API if available
 */

(function(global) {
  'use strict';

  var W = 1080, H = 1920;

  function drawStars(ctx) {
    for (var i = 0; i < 200; i++) {
      var x = Math.random() * W;
      var y = Math.random() * H;
      var r = Math.random() * 1.8 + 0.3;
      var a = Math.random() * 0.5 + 0.1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
      ctx.fill();
    }
  }

  function drawGradientBG(ctx) {
    var grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#06061a');
    grd.addColorStop(0.4, '#0c0c2a');
    grd.addColorStop(0.7, '#120828');
    grd.addColorStop(1, '#06061a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  function drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function generate(profile, lang) {
    lang = lang || 'es';
    var isEn = lang === 'en';
    var cc = profile._cc; // pre-calculated cross-cultural profile

    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    // Background
    drawGradientBG(ctx);
    drawStars(ctx);

    // Decorative top circle
    var grd2 = ctx.createRadialGradient(W/2, 200, 10, W/2, 200, 400);
    grd2.addColorStop(0, 'rgba(212,168,73,0.15)');
    grd2.addColorStop(1, 'rgba(212,168,73,0)');
    ctx.fillStyle = grd2;
    ctx.fillRect(0, 0, W, 600);

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d4a849';
    ctx.font = '600 28px Inter, sans-serif';
    ctx.fillText(isEn ? '✦ COSMIC PROFILE ✦' : '✦ PERFIL CÓSMICO ✦', W/2, 100);

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 64px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(profile.nombre || (isEn ? 'My Profile' : 'Mi Perfil'), W/2, 185);

    // Birth date
    ctx.fillStyle = '#9890a8';
    ctx.font = '400 28px Inter, sans-serif';
    ctx.fillText(profile.fecha_nacimiento || '', W/2, 230);

    // Divider line
    var lineGrd = ctx.createLinearGradient(200, 0, W - 200, 0);
    lineGrd.addColorStop(0, 'rgba(212,168,73,0)');
    lineGrd.addColorStop(0.5, 'rgba(212,168,73,0.6)');
    lineGrd.addColorStop(1, 'rgba(212,168,73,0)');
    ctx.strokeStyle = lineGrd;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(200, 260);
    ctx.lineTo(W - 200, 260);
    ctx.stroke();

    // Systems grid — 2 columns, 4 rows
    var systems = [];
    if (cc) {
      systems = [
        { symbol: cc.western.symbol, label: isEn ? 'Western' : 'Occidental', value: isEn ? cc.western.name_en : cc.western.name_es, detail: isEn ? cc.western.element_en : cc.western.element_es, color: cc.western.color },
        { symbol: cc.chinese.animal.symbol, label: isEn ? 'Chinese' : 'Chino', value: isEn ? cc.chinese.animal.name_en : cc.chinese.animal.name_es, detail: cc.chinese.element[isEn?'en':'es'], color: cc.chinese.animal.color },
        { symbol: '\u{1F52E}', label: isEn ? 'Mayan' : 'Maya', value: isEn ? cc.mayan.seal.name_en : cc.mayan.seal.name_es, detail: 'Kin ' + cc.mayan.kin + ' \u2022 ' + (isEn ? 'Tone' : 'Tono') + ' ' + cc.mayan.tone.num, color: cc.mayan.seal.color },
        { symbol: '\u{1F549}\uFE0F', label: isEn ? 'Vedic' : 'Védica', value: cc.vedic.rashi.name_sa, detail: cc.vedic.nakshatra.name_sa, color: cc.vedic.rashi.color },
        { symbol: String(cc.numerology.lifePathNumber), label: isEn ? 'Numerology' : 'Numerología', value: isEn ? cc.numerology.data.keyword_en : cc.numerology.data.keyword_es, detail: isEn ? cc.numerology.data.planet_en : cc.numerology.data.planet_es, color: cc.numerology.data.color },
        { symbol: '\u{1F33F}', label: isEn ? 'Celtic' : 'Celta', value: isEn ? cc.celtic.name_en : cc.celtic.name_es, detail: 'Ogham: ' + cc.celtic.ogham, color: cc.celtic.color },
        { symbol: '\u2B21', label: isEn ? 'Human Design' : 'Diseño Humano', value: 'Gate ' + cc.humanDesign.gate, detail: isEn ? cc.humanDesign.gateData.name_en : cc.humanDesign.gateData.name_es, color: '#7c5cbf' },
      ];

      // Add enneagram if available
      if (profile.enneagramType) {
        var et = LuzEstelar.CrossCultural.ENNEAGRAM_TYPES[profile.enneagramType];
        systems.push({
          symbol: '\u2776',
          label: isEn ? 'Enneagram' : 'Eneagrama',
          value: isEn ? 'Type ' + profile.enneagramType : 'Tipo ' + profile.enneagramType,
          detail: isEn ? et.name_en : et.name_es,
          color: et.color
        });
      }
    }

    var cardW = 460, cardH = 170;
    var startY = 300;
    var gapX = 32, gapY = 20;
    var cols = 2;
    var startX = (W - (cols * cardW + (cols - 1) * gapX)) / 2;

    systems.forEach(function(sys, idx) {
      var col = idx % cols;
      var row = Math.floor(idx / cols);
      var x = startX + col * (cardW + gapX);
      var y = startY + row * (cardH + gapY);

      // Card background
      drawRoundRect(ctx, x, y, cardW, cardH, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Left color bar
      drawRoundRect(ctx, x, y, 6, cardH, 3);
      ctx.fillStyle = sys.color;
      ctx.fill();

      // Symbol
      ctx.textAlign = 'left';
      ctx.font = '400 42px "Noto Sans Symbols 2", serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sys.symbol, x + 22, y + 58);

      // Label
      ctx.font = '500 20px Inter, sans-serif';
      ctx.fillStyle = '#9890a8';
      ctx.fillText(sys.label, x + 22, y + 90);

      // Value
      ctx.font = '700 32px "Cormorant Garamond", Georgia, serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sys.value, x + 22, y + 130);

      // Detail
      ctx.font = '400 20px Inter, sans-serif';
      ctx.fillStyle = '#9890a8';
      ctx.fillText(sys.detail, x + 22, y + 158);
    });

    // Gene Key section (below grid)
    var gkY = startY + Math.ceil(systems.length / cols) * (cardH + gapY) + 20;
    if (cc) {
      var gk = cc.humanDesign.gateData;
      ctx.textAlign = 'center';
      ctx.font = '600 24px Inter, sans-serif';
      ctx.fillStyle = '#d4a849';
      ctx.fillText(isEn ? 'Gene Key ' + cc.humanDesign.gate : 'Clave Genetica ' + cc.humanDesign.gate, W/2, gkY);

      // Shadow → Gift → Siddhi
      var arrowY = gkY + 45;
      var specW = 260;
      var specGap = 40;
      var specStartX = (W - (3 * specW + 2 * specGap)) / 2;

      // Shadow
      ctx.fillStyle = 'rgba(229,57,53,0.15)';
      drawRoundRect(ctx, specStartX, arrowY, specW, 70, 12);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = '500 18px Inter, sans-serif';
      ctx.fillStyle = '#E53935';
      ctx.fillText(isEn ? 'Shadow' : 'Sombra', specStartX + specW/2, arrowY + 28);
      ctx.font = '700 22px "Cormorant Garamond", serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(isEn ? gk.genekey_shadow_en : gk.genekey_shadow_es, specStartX + specW/2, arrowY + 56);

      // Arrow
      ctx.fillStyle = '#9890a8';
      ctx.font = '400 28px Inter, sans-serif';
      ctx.fillText('\u2192', specStartX + specW + specGap/2, arrowY + 42);

      // Gift
      ctx.fillStyle = 'rgba(212,168,73,0.15)';
      drawRoundRect(ctx, specStartX + specW + specGap, arrowY, specW, 70, 12);
      ctx.fill();
      ctx.font = '500 18px Inter, sans-serif';
      ctx.fillStyle = '#d4a849';
      ctx.fillText(isEn ? 'Gift' : 'Don', specStartX + specW + specGap + specW/2, arrowY + 28);
      ctx.font = '700 22px "Cormorant Garamond", serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(isEn ? gk.genekey_gift_en : gk.genekey_gift_es, specStartX + specW + specGap + specW/2, arrowY + 56);

      // Arrow
      ctx.fillStyle = '#9890a8';
      ctx.font = '400 28px Inter, sans-serif';
      ctx.fillText('\u2192', specStartX + 2*specW + 1.5*specGap, arrowY + 42);

      // Siddhi
      ctx.fillStyle = 'rgba(124,92,191,0.15)';
      drawRoundRect(ctx, specStartX + 2*(specW + specGap), arrowY, specW, 70, 12);
      ctx.fill();
      ctx.font = '500 18px Inter, sans-serif';
      ctx.fillStyle = '#7c5cbf';
      ctx.fillText('Siddhi', specStartX + 2*(specW + specGap) + specW/2, arrowY + 28);
      ctx.font = '700 22px "Cormorant Garamond", serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(isEn ? gk.genekey_siddhi_en : gk.genekey_siddhi_es, specStartX + 2*(specW + specGap) + specW/2, arrowY + 56);
    }

    // Footer
    ctx.textAlign = 'center';

    // Divider
    var footY = H - 120;
    ctx.strokeStyle = lineGrd;
    ctx.beginPath();
    ctx.moveTo(200, footY);
    ctx.lineTo(W - 200, footY);
    ctx.stroke();

    ctx.font = '600 26px "Cormorant Garamond", Georgia, serif';
    ctx.fillStyle = '#d4a849';
    ctx.fillText('Luz Estelar Oficial', W/2, footY + 40);

    ctx.font = '400 20px Inter, sans-serif';
    ctx.fillStyle = '#9890a8';
    ctx.fillText('luzestelaroficial.com', W/2, footY + 70);

    ctx.font = '400 18px Inter, sans-serif';
    ctx.fillStyle = '#706888';
    ctx.fillText(isEn ? 'Discover your cosmic profile' : 'Descubre tu perfil cósmico', W/2, footY + 100);

    return canvas;
  }

  function toBlob(canvas) {
    return new Promise(function(resolve) {
      canvas.toBlob(function(blob) {
        resolve(blob);
      }, 'image/png');
    });
  }

  function download(profile, lang) {
    var canvas = generate(profile, lang);
    var link = document.createElement('a');
    link.download = 'perfil-cósmico-' + (profile.nombre || 'luzestelar').toLowerCase().replace(/\s+/g, '-') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function share(profile, lang) {
    var canvas = generate(profile, lang);
    var blob = await toBlob(canvas);
    var file = new File([blob], 'perfil-cósmico.png', { type: 'image/png' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: lang === 'en' ? 'My Cosmic Profile — Luz Estelar' : 'Mi Perfil Cósmico — Luz Estelar',
          text: lang === 'en' ? 'Discover your cosmic profile at luzestelaroficial.com' : 'Descubre tu perfil cósmico en luzestelaroficial.com',
          url: 'https://luzestelaroficial.com',
          files: [file]
        });
      } catch(e) {
        // User cancelled or error — fallback to download
        download(profile, lang);
      }
    } else {
      download(profile, lang);
    }
  }

  global.LuzEstelar = global.LuzEstelar || {};
  global.LuzEstelar.ProfileCard = {
    generate: generate,
    download: download,
    share: share
  };

})(typeof window !== 'undefined' ? window : this);
