/**
 * GET /perfil/:id — Public shareable profile page
 * ================================================
 * Server-rendered HTML with OG meta tags for social media previews.
 * No authentication required — profiles are public when shared.
 * Supports ?lang=en for English version.
 */

const SYSTEM_LABELS = {
  es: {
    title: 'Perfil Cósmico',
    western: 'Occidental',
    chinese: 'Chino',
    numerology: 'Numerología',
    celtic: 'Celta',
    mayan: 'Maya',
    vedic: 'Védica',
    humanDesign: 'Diseño Humano',
    enneagram: 'Eneagrama',
    discover: 'Descubre tu propio perfil cósmico',
    poweredBy: 'Generado con',
    notFound: 'Perfil no encontrado',
    notFoundDesc: 'Este perfil no existe o ha sido eliminado.',
    goHome: 'Ir al inicio',
  },
  en: {
    title: 'Cosmic Profile',
    western: 'Western',
    chinese: 'Chinese',
    numerology: 'Numerology',
    celtic: 'Celtic',
    mayan: 'Mayan',
    vedic: 'Vedic',
    humanDesign: 'Human Design',
    enneagram: 'Enneagram',
    discover: 'Discover your own cosmic profile',
    poweredBy: 'Powered by',
    notFound: 'Profile not found',
    notFoundDesc: 'This profile does not exist or has been removed.',
    goHome: 'Go to homepage',
  }
};

const WESTERN_SYMBOLS = {
  Aries: '\u2648', Taurus: '\u2649', Gemini: '\u264A', Cancer: '\u264B',
  Leo: '\u264C', Virgo: '\u264D', Libra: '\u264E', Scorpio: '\u264F',
  Sagittarius: '\u2650', Capricorn: '\u2651', Aquarius: '\u2652', Pisces: '\u2653'
};

const CHINESE_SYMBOLS = {
  Rat: '\uD83D\uDC00', Ox: '\uD83D\uDC02', Tiger: '\uD83D\uDC05', Rabbit: '\uD83D\uDC07',
  Dragon: '\uD83D\uDC09', Snake: '\uD83D\uDC0D', Horse: '\uD83D\uDC0E', Goat: '\uD83D\uDC10',
  Monkey: '\uD83D\uDC12', Rooster: '\uD83D\uDC13', Dog: '\uD83D\uDC15', Pig: '\uD83D\uDC16'
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildOGDescription(profile, lang) {
  const isEn = lang === 'en';
  const parts = [];
  if (profile.western_sign) parts.push(`${isEn ? 'Western' : 'Occidental'}: ${profile.western_sign}`);
  if (profile.chinese_animal) parts.push(`${isEn ? 'Chinese' : 'Chino'}: ${profile.chinese_animal}`);
  if (profile.mayan_seal) parts.push(`Maya: ${profile.mayan_seal} (Kin ${profile.mayan_kin})`);
  if (profile.vedic_rashi) parts.push(`${isEn ? 'Vedic' : 'Védica'}: ${profile.vedic_rashi}`);
  if (profile.numerology_number) parts.push(`${isEn ? 'Numerology' : 'Numerología'}: ${profile.numerology_number}`);
  if (profile.celtic_tree) parts.push(`${isEn ? 'Celtic' : 'Celta'}: ${profile.celtic_tree}`);
  if (profile.human_design_gate) parts.push(`${isEn ? 'Human Design' : 'Diseño Humano'}: Gate ${profile.human_design_gate}`);
  if (profile.enneagram_type) parts.push(`${isEn ? 'Enneagram' : 'Eneagrama'}: ${isEn ? 'Type' : 'Tipo'} ${profile.enneagram_type}`);
  return parts.join(' \u2022 ');
}

function buildSystemCard(symbol, label, value, detail, color) {
  return `
    <div class="sys-card" style="border-left:3px solid ${color}">
      <span class="sys-sym">${symbol}</span>
      <div class="sys-info">
        <span class="sys-lbl">${escapeHtml(label)}</span>
        <span class="sys-val">${escapeHtml(value)}</span>
        ${detail ? `<span class="sys-det">${escapeHtml(detail)}</span>` : ''}
      </div>
    </div>`;
}

function renderProfile(profile, lang) {
  const isEn = lang === 'en';
  const L = SYSTEM_LABELS[lang] || SYSTEM_LABELS.es;
  const name = escapeHtml(profile.nombre || (isEn ? 'Cosmic Profile' : 'Perfil Cósmico'));
  const ogDesc = buildOGDescription(profile, lang);
  const siteUrl = 'https://luzestelaroficial.com';
  const pageUrl = `${siteUrl}/perfil/${profile.id}${isEn ? '?lang=en' : ''}`;

  // Build system cards
  let systemsHtml = '';

  if (profile.western_sign) {
    systemsHtml += buildSystemCard(
      WESTERN_SYMBOLS[profile.western_sign] || '\u2728',
      L.western, profile.western_sign, '', '#d4a849'
    );
  }
  if (profile.chinese_animal) {
    systemsHtml += buildSystemCard(
      CHINESE_SYMBOLS[profile.chinese_animal] || '\uD83C\uDF0F',
      L.chinese, profile.chinese_animal, '', '#e53935'
    );
  }
  if (profile.mayan_seal) {
    systemsHtml += buildSystemCard(
      '\uD83D\uDD2E', L.mayan, profile.mayan_seal,
      `Kin ${profile.mayan_kin || '?'} \u2022 ${isEn ? 'Tone' : 'Tono'} ${profile.mayan_tone || '?'}`,
      '#FF6F00'
    );
  }
  if (profile.vedic_rashi) {
    systemsHtml += buildSystemCard(
      '\uD83D\uDD49\uFE0F', L.vedic, profile.vedic_rashi,
      profile.vedic_nakshatra || '', '#1565C0'
    );
  }
  if (profile.numerology_number) {
    systemsHtml += buildSystemCard(
      String(profile.numerology_number), L.numerology,
      `${isEn ? 'Life Path' : 'Camino de Vida'} ${profile.numerology_number}`, '', '#7c5cbf'
    );
  }
  if (profile.celtic_tree) {
    systemsHtml += buildSystemCard(
      '\uD83C\uDF3F', L.celtic, profile.celtic_tree, '', '#2E8B57'
    );
  }
  if (profile.human_design_gate) {
    systemsHtml += buildSystemCard(
      '\u2B21', L.humanDesign, `Gate ${profile.human_design_gate}`, '', '#7c5cbf'
    );
  }
  if (profile.enneagram_type) {
    systemsHtml += buildSystemCard(
      '\u2776', L.enneagram,
      `${isEn ? 'Type' : 'Tipo'} ${profile.enneagram_type}`,
      profile.enneagram_wing ? `${isEn ? 'Wing' : 'Ala'} ${profile.enneagram_wing}` : '',
      '#d4a849'
    );
  }

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${name} — ${L.title} | Luz Estelar</title>
  <meta name="description" content="${escapeHtml(ogDesc)}">

  <!-- Open Graph -->
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${name} — ${L.title}">
  <meta property="og:description" content="${escapeHtml(ogDesc)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="Luz Estelar Oficial">
  <meta property="og:image" content="${siteUrl}/app_icon.png">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${name} — ${L.title}">
  <meta name="twitter:description" content="${escapeHtml(ogDesc)}">
  <meta name="twitter:image" content="${siteUrl}/app_icon.png">

  <link rel="icon" type="image/png" href="/app_icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root{--gold:#d4a849;--bg:#06061a;--bg2:#0c0c2a;--text:#e0dce8;--dim:#9890a8;--glass:rgba(255,255,255,0.04);--border:rgba(255,255,255,0.08);}
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;}
    .wrapper{max-width:700px;width:100%;padding:40px 20px 60px;}
    .header{text-align:center;margin-bottom:36px;}
    .badge{display:inline-block;font-size:0.72em;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;}
    .name{font-family:'Cormorant Garamond',serif;font-size:2.8em;font-weight:700;color:#fff;line-height:1.1;}
    .birth{color:var(--dim);font-size:0.95em;margin-top:8px;}
    .divider{width:120px;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);margin:24px auto;}
    .systems{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:36px;}
    .sys-card{display:flex;align-items:center;gap:14px;padding:18px 16px;background:var(--glass);border:1px solid var(--border);border-radius:14px;transition:border-color 0.3s;}
    .sys-card:hover{border-color:rgba(212,168,73,0.2);}
    .sys-sym{font-size:2em;min-width:48px;text-align:center;}
    .sys-info{display:flex;flex-direction:column;}
    .sys-lbl{font-size:0.72em;color:var(--dim);text-transform:uppercase;letter-spacing:1px;}
    .sys-val{font-family:'Cormorant Garamond',serif;font-size:1.4em;font-weight:700;color:#fff;}
    .sys-det{font-size:0.78em;color:var(--dim);margin-top:2px;}
    .cta{text-align:center;padding:32px;background:var(--glass);border:1px solid var(--border);border-radius:18px;}
    .cta p{color:var(--dim);margin-bottom:16px;font-size:0.95em;}
    .cta a{display:inline-block;padding:12px 32px;background:linear-gradient(135deg,var(--gold),#c89030);color:#1a1625;font-weight:700;font-size:0.95em;border-radius:10px;text-decoration:none;transition:transform 0.2s,box-shadow 0.2s;}
    .cta a:hover{transform:translateY(-2px);box-shadow:0 4px 20px rgba(212,168,73,0.3);}
    .footer{text-align:center;margin-top:40px;color:var(--dim);font-size:0.8em;}
    .footer a{color:var(--gold);text-decoration:none;}
    @media(max-width:600px){.name{font-size:2em;}.systems{grid-template-columns:1fr;}}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">\u2726 ${L.title} \u2726</div>
      <div class="name">${name}</div>
      <div class="birth">${escapeHtml(profile.fecha_nacimiento || '')}</div>
      <div class="divider"></div>
    </div>

    <div class="systems">
      ${systemsHtml}
    </div>

    <div class="cta">
      <p>${L.discover}</p>
      <a href="${siteUrl}${isEn ? '/en/' : '/'}">${isEn ? 'Create My Profile' : 'Crear Mi Perfil'}</a>
    </div>

    <div class="footer">
      ${L.poweredBy} <a href="${siteUrl}">Luz Estelar Oficial</a>
    </div>
  </div>
</body>
</html>`;
}

function render404(lang) {
  const L = SYSTEM_LABELS[lang] || SYSTEM_LABELS.es;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${L.notFound} — Luz Estelar</title>
  <link rel="icon" type="image/png" href="/app_icon.png">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Inter',sans-serif;background:#06061a;color:#e0dce8;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;}
    h1{font-size:2em;color:#d4a849;margin-bottom:12px;}
    p{color:#9890a8;margin-bottom:24px;}
    a{color:#d4a849;text-decoration:none;border:1px solid rgba(212,168,73,0.3);padding:10px 24px;border-radius:10px;transition:all 0.2s;}
    a:hover{background:rgba(212,168,73,0.1);}
  </style>
</head>
<body>
  <div>
    <h1>${L.notFound}</h1>
    <p>${L.notFoundDesc}</p>
    <a href="/">${L.goHome}</a>
  </div>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { id } = context.params;
  const url = new URL(context.request.url);
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es';

  if (!id || !context.env.DB) {
    return new Response(render404(lang), {
      status: 404,
      headers: { 'Content-Type': 'text/html;charset=utf-8' }
    });
  }

  try {
    const result = await context.env.DB.prepare(
      'SELECT * FROM birth_profiles WHERE id = ?'
    ).bind(id).first();

    if (!result) {
      return new Response(render404(lang), {
        status: 404,
        headers: { 'Content-Type': 'text/html;charset=utf-8' }
      });
    }

    return new Response(renderProfile(result, lang), {
      status: 200,
      headers: {
        'Content-Type': 'text/html;charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      }
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    return new Response(render404(lang), {
      status: 500,
      headers: { 'Content-Type': 'text/html;charset=utf-8' }
    });
  }
}
