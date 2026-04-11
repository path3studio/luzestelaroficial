#!/usr/bin/env node
/**
 * generate-system-pages.js
 * ========================
 * Generates static HTML pages for 4 new astrology systems:
 *   - Maya Tzolkin: 20 seals + 13 tones = 33 pages x 2 langs = 66
 *   - Vedic/Jyotish: 12 rashis + 27 nakshatras = 39 pages x 2 langs = 78
 *   - Human Design: 64 gates x 2 langs = 128
 *   - Enneagram: 9 types x 2 langs = 18
 *   Total: ~290 pages
 *
 * Uses template from existing content pages (zodiaco-celta/vid.html pattern).
 * Content is data-driven from cross-cultural.js arrays.
 *
 * Usage: node scripts/generate-system-pages.js
 */

const fs = require('fs');
const path = require('path');

// Load cross-cultural data
const ccPath = path.join(__dirname, '..', 'js', 'cross-cultural.js');
const ccCode = fs.readFileSync(ccPath, 'utf8');
// Execute in a sandbox to extract data
const sandbox = {};
(new Function('window', ccCode))(sandbox);
const CC = sandbox.LuzEstelar.CrossCultural;

const TODAY = '2026-04-09';
const BASE_URL = 'https://luzestelaroficial.com';

// ═══════════════════════════════════════════════════════════════
// SHARED TEMPLATE
// ═══════════════════════════════════════════════════════════════

function pageHTML(opts) {
  // opts: { lang, title, description, canonicalPath, hreflangEs, hreflangEn,
  //         symbol, h1, subtitle, metaItems, cards, ctaCards, prevLink, nextLink,
  //         allLink, allLabel, parentDir }
  const isEn = opts.lang === 'en';
  const rel = opts.parentDir || '..';

  return `<!DOCTYPE html>
<html lang="${opts.lang === 'en' ? 'en' : 'es'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${opts.title} | Luz Estelar</title>
    <meta name="description" content="${opts.description}">
    <meta property="og:title" content="${opts.title} | Luz Estelar">
    <meta property="og:description" content="${opts.description}">
    <meta property="og:url" content="${BASE_URL}${opts.canonicalPath}">
    <meta property="og:locale" content="${isEn ? 'en_US' : 'es_MX'}">
    <meta property="og:locale:alternate" content="${isEn ? 'es_MX' : 'en_US'}">
    <link rel="icon" type="image/png" href="${rel}/app_icon.png">
    <link rel="canonical" href="${BASE_URL}${opts.canonicalPath}">
    <link rel="alternate" hreflang="es" href="${BASE_URL}${opts.hreflangEs}">
    <link rel="alternate" hreflang="en" href="${BASE_URL}${opts.hreflangEn}">
    <link rel="alternate" hreflang="x-default" href="${BASE_URL}${opts.hreflangEs}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&family=Noto+Sans+Symbols+2&display=swap" rel="stylesheet">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"${opts.title}","description":"${opts.description}","author":{"@type":"Organization","name":"Luz Estelar Oficial"},"datePublished":"${TODAY}","inLanguage":"${opts.lang === 'en' ? 'en' : 'es'}","mainEntityOfPage":"${BASE_URL}${opts.canonicalPath}"}</script>
    <style>
        :root{--gold:#d4a849;--gold-light:#f0d078;--gold-dim:rgba(212,168,73,0.15);--bg-deep:#06061a;--bg-mid:#0c0c2a;--text:#e0dce8;--text-dim:#9890a8;--glass:rgba(255,255,255,0.04);--glass-border:rgba(255,255,255,0.08);--accent-purple:#7c5cbf;}
        *{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{font-family:'Inter',-apple-system,sans-serif;background:var(--bg-deep);color:var(--text);min-height:100vh;overflow-x:hidden;}
.starfield{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;}
.starfield canvas{width:100%;height:100%;}
nav{position:fixed;top:0;width:100%;z-index:100;background:rgba(6,6,26,0.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--glass-border);}
nav .nav-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 24px;}
nav .logo{font-family:'Cormorant Garamond',serif;font-size:1.4em;font-weight:700;color:var(--gold);text-decoration:none;}
nav .nav-links{display:flex;gap:28px;}
nav .nav-links a{color:var(--text-dim);text-decoration:none;font-size:0.88em;font-weight:400;transition:color 0.2s;}
nav .nav-links a:hover{color:var(--gold);}
.content{position:relative;z-index:1;}
.hero-sign{padding:120px 24px 60px;text-align:center;}
.hero-sign .symbol{font-family:'Noto Sans Symbols 2',serif;font-size:5em;background:linear-gradient(180deg,var(--gold-light),var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 15px rgba(212,168,73,0.4));}
.hero-sign h1{font-family:'Cormorant Garamond',serif;font-size:3.5em;font-weight:700;color:#fff;margin:10px 0;}
.hero-sign .subtitle{font-size:1.1em;color:var(--text-dim);margin-top:8px;}
.hero-sign .meta{display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-top:16px;font-size:0.9em;color:var(--text-dim);}
.hero-sign .meta span{display:flex;align-items:center;gap:6px;}
.hero-sign .meta .dot{width:8px;height:8px;border-radius:50%;}
section{padding:60px 24px;}
.section-inner{max-width:800px;margin:0 auto;}
.card{background:var(--glass);border:1px solid var(--glass-border);border-radius:18px;padding:36px 32px;margin-bottom:30px;}
.card h2{font-family:'Cormorant Garamond',serif;font-size:1.8em;font-weight:700;color:#fff;margin-bottom:16px;}
.card p{font-size:0.95em;line-height:1.85;color:var(--text-dim);margin-bottom:14px;}
.card p:last-child{margin-bottom:0;}
.card ul{list-style:none;padding:0;}
.card ul li{padding:10px 0;border-bottom:1px solid var(--glass-border);font-size:0.92em;line-height:1.7;color:var(--text-dim);}
.card ul li:last-child{border-bottom:none;}
.card ul li strong{color:var(--gold);}
.sign-nav{display:flex;justify-content:space-between;max-width:800px;margin:40px auto;padding:0 24px;}
.sign-nav a{color:var(--gold);text-decoration:none;font-size:0.95em;transition:opacity 0.2s;}
.sign-nav a:hover{opacity:0.7;}
.cta-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:20px;}
.cta-card{background:linear-gradient(135deg,rgba(212,168,73,0.08),rgba(124,92,191,0.06));border:1px solid rgba(212,168,73,0.2);border-radius:16px;padding:24px;text-align:center;text-decoration:none;color:#fff;transition:transform 0.3s;}
.cta-card:hover{transform:translateY(-3px);}
.cta-card h3{font-family:'Cormorant Garamond',serif;font-size:1.2em;margin-bottom:8px;}
.cta-card p{font-size:0.85em;color:var(--text-dim);}
footer{text-align:center;padding:40px 24px;border-top:1px solid var(--glass-border);color:var(--text-dim);font-size:0.85em;}
footer a{color:var(--text-dim);text-decoration:none;transition:color 0.2s;}
footer a:hover{color:var(--gold);}
footer .footer-links{display:flex;gap:24px;justify-content:center;margin-bottom:16px;}
.lang-selector{display:flex;align-items:center;gap:4px;font-size:0.82em;margin-left:16px;}
.lang-selector a{color:var(--text-dim);text-decoration:none;padding:2px 6px;border-radius:4px;transition:color 0.2s,background 0.2s;}
.lang-selector a:hover{color:var(--gold);}
.lang-selector a.active{color:var(--gold);font-weight:600;background:var(--gold-dim);}
.lang-selector .lang-sep{color:var(--text-dim);opacity:0.5;}
@media(max-width:768px){.hero-sign h1{font-size:2.4em;}.hero-sign .symbol{font-size:3.5em;}.card{padding:24px 20px;}.card h2{font-size:1.4em;}.lang-selector{position:absolute;top:18px;right:60px;}}
    </style>
</head>
<body>
    <div class="starfield"><canvas id="stars"></canvas></div>
    <nav><div class="nav-inner"><a href="${rel}/" class="logo">Luz Estelar</a><div class="nav-links"><a href="${rel}/">${isEn ? 'Home' : 'Inicio'}</a><a href="${rel}/#signos">${isEn ? 'Signs' : 'Signos'}</a><a href="${rel}/#plataformas">${isEn ? 'Platforms' : 'Plataformas'}</a><a href="dashboard.html" style="color:var(--gold-light);">${isEn ? '✦ My Portal' : '✦ Mi Portal'}</a></div></div></nav>
    <div class="content">
        <div class="hero-sign">
            <div class="symbol">${opts.symbol}</div>
            <h1>${opts.h1}</h1>
            <p class="subtitle">${opts.subtitle}</p>
            <div class="meta">
                ${opts.metaItems.map(m => `<span><span class="dot" style="background:${m.color}"></span> ${m.text}</span>`).join('\n                ')}
            </div>
        </div>
        <section><div class="section-inner">
${opts.cards.map(c => `            <div class="card">
  <h2>${c.title}</h2>
${c.paragraphs.map(p => `  <p>${p}</p>`).join('\n')}
</div>`).join('\n\n')}
            <div class="card">
                <h2>${isEn ? 'Keep Exploring' : 'Sigue Explorando'}</h2>
                <div class="cta-row">
                    ${opts.ctaCards.map(c => `<a href="${c.href}" class="cta-card"><h3>${c.title}</h3><p>${c.desc}</p></a>`).join('\n                    ')}
                </div>
            </div>
        </div></section>
        <div class="sign-nav">
            ${opts.prevLink ? `<a href="${opts.prevLink.href}">&larr; ${opts.prevLink.label}</a>` : '<span></span>'}
            <a href="${opts.allLink}">${opts.allLabel}</a>
            ${opts.nextLink ? `<a href="${opts.nextLink.href}">${opts.nextLink.label} &rarr;</a>` : '<span></span>'}
        </div>
        <footer>
            <div class="footer-links"><a href="${rel}/">${isEn ? 'Home' : 'Inicio'}</a><a href="${rel}/privacy-policy.html">${isEn ? 'Privacy' : 'Privacidad'}</a><a href="https://www.youtube.com/@LuzEstelarOficial" target="_blank">YouTube</a></div>
            <p>&copy; 2026 Luz Estelar Oficial — Path3 Studio. ${isEn ? 'All rights reserved.' : 'Todos los derechos reservados.'}</p>
        </footer>
    </div>
    <script>(function(){var c=document.getElementById('stars');var ctx=c.getContext('2d');var w,h,stars=[];function resize(){w=c.width=window.innerWidth;h=c.height=window.innerHeight;}function init(){resize();stars=[];for(var i=0;i<150;i++){stars.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.5+0.3,a:Math.random()*0.5+0.15,speed:Math.random()*0.15+0.02,phase:Math.random()*Math.PI*2});}}function draw(){ctx.clearRect(0,0,w,h);var t=Date.now()*0.001;stars.forEach(function(s){var f=0.5+0.5*Math.sin(t*s.speed*6+s.phase);ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,'+s.a*f+')';ctx.fill();});requestAnimationFrame(draw);}init();draw();window.addEventListener('resize',init);})();</script>
    <script>if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}</script>
    <script src="/js/cookie-consent.js" defer></script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// MAYAN SEALS (20 pages x 2 langs = 40)
// ═══════════════════════════════════════════════════════════════

const MAYAN_SEAL_CONTENT = {
  es: {
    intro: (s, t) => `El ${s.name_es} es el sello solar numero ${s.num} del Tzolkin maya, conocido en nahuatl como ${s.nahuatl}. Pertenece al color ${s.color_es}, que en la cosmovision maya representa ${s.color_es === 'Rojo' ? 'el inicio y la accion' : s.color_es === 'Blanco' ? 'la refinacion y la purificacion' : s.color_es === 'Azul' ? 'la transformacion y la profundidad' : 'la maduracion y la manifestacion'}. Este sello conecta con una energia arquetipica que guia a quienes nacen bajo su influencia hacia un proposito especifico en el flujo cosmico.`,
    personality: (s) => `Las personas nacidas con el sello ${s.name_es} poseen una naturaleza unica que las distingue. Su energia se manifiesta a traves de una profunda conexion con ${s.color_es === 'Rojo' ? 'la fuerza vital y la iniciativa' : s.color_es === 'Blanco' ? 'la claridad mental y la sabiduria' : s.color_es === 'Azul' ? 'la intuicion y el mundo interior' : 'la creatividad y la abundancia'}. Son individuos que buscan expresar su esencia autentica y contribuir al desarrollo colectivo desde su perspectiva unica.`,
    love: (s) => `En el amor, el sello ${s.name_es} busca relaciones que reflejen autenticidad y crecimiento mutuo. Su color ${s.color_es} les otorga ${s.color_es === 'Rojo' ? 'pasion e intensidad en sus vinculos afectivos' : s.color_es === 'Blanco' ? 'pureza y sinceridad en sus relaciones' : s.color_es === 'Azul' ? 'profundidad emocional y conexion espiritual' : 'calidez y generosidad con sus seres queridos'}. Valoran la honestidad y la conexion profunda por encima de lo superficial.`,
    career: (s) => `En el ambito profesional, las personas del sello ${s.name_es} se destacan en actividades que les permitan expresar su esencia ${s.color_es === 'Rojo' ? 'liderando proyectos e iniciando nuevos caminos' : s.color_es === 'Blanco' ? 'organizando, purificando y perfeccionando procesos' : s.color_es === 'Azul' ? 'explorando lo desconocido y transformando realidades' : 'materializando ideas y creando abundancia'}. Su exito depende de alinear su trabajo con su proposito cosmico.`,
    advice: (s) => `Como portador del sello ${s.name_es}, tu mision es integrar la energia del color ${s.color_es} en tu vida cotidiana. Medita sobre el significado de tu nahuatl "${s.nahuatl}" y permite que su sabiduria ancestral guie tus decisiones. Recuerda que cada dia del Tzolkin trae una leccion diferente, y tu sello es la lente a traves de la cual interpretas esas ensenanzas.`,
  },
  en: {
    intro: (s) => `${s.name_en} is Solar Seal number ${s.num} of the Mayan Tzolkin, known in Nahuatl as ${s.nahuatl}. It belongs to the ${s.color_en} color, which in Mayan cosmology represents ${s.color_en === 'Red' ? 'initiation and action' : s.color_en === 'White' ? 'refinement and purification' : s.color_en === 'Blue' ? 'transformation and depth' : 'ripening and manifestation'}. This seal connects with an archetypal energy that guides those born under its influence toward a specific purpose in the cosmic flow.`,
    personality: (s) => `People born with the ${s.name_en} seal possess a unique nature that distinguishes them. Their energy manifests through a deep connection with ${s.color_en === 'Red' ? 'vital force and initiative' : s.color_en === 'White' ? 'mental clarity and wisdom' : s.color_en === 'Blue' ? 'intuition and the inner world' : 'creativity and abundance'}. They are individuals who seek to express their authentic essence and contribute to collective development from their unique perspective.`,
    love: (s) => `In love, the ${s.name_en} seal seeks relationships that reflect authenticity and mutual growth. Their ${s.color_en} color grants them ${s.color_en === 'Red' ? 'passion and intensity in their emotional bonds' : s.color_en === 'White' ? 'purity and sincerity in their relationships' : s.color_en === 'Blue' ? 'emotional depth and spiritual connection' : 'warmth and generosity with their loved ones'}. They value honesty and deep connection above the superficial.`,
    career: (s) => `In their professional life, ${s.name_en} seal bearers excel in activities that allow them to express their essence by ${s.color_en === 'Red' ? 'leading projects and forging new paths' : s.color_en === 'White' ? 'organizing, purifying, and perfecting processes' : s.color_en === 'Blue' ? 'exploring the unknown and transforming realities' : 'materializing ideas and creating abundance'}. Their success depends on aligning their work with their cosmic purpose.`,
    advice: (s) => `As a bearer of the ${s.name_en} seal, your mission is to integrate the energy of the ${s.color_en} color into your daily life. Meditate on the meaning of your Nahuatl name "${s.nahuatl}" and allow its ancestral wisdom to guide your decisions. Remember that each day of the Tzolkin brings a different lesson, and your seal is the lens through which you interpret those teachings.`,
  }
};

function generateMayanSeals() {
  const seals = CC.MAYAN_SEALS;
  let count = 0;

  for (const lang of ['es', 'en']) {
    const isEn = lang === 'en';
    const dir = isEn ? 'en/mayan-astrology' : 'astrologia-maya';
    const otherDir = isEn ? 'astrologia-maya' : 'en/mayan-astrology';
    const content = MAYAN_SEAL_CONTENT[lang];

    for (let i = 0; i < seals.length; i++) {
      const s = seals[i];
      const slug = isEn ? s.slug_en : s.slug_es;
      const name = isEn ? s.name_en : s.name_es;
      const otherSlug = isEn ? s.slug_es : s.slug_en;
      const prev = i > 0 ? seals[i - 1] : seals[seals.length - 1];
      const next = i < seals.length - 1 ? seals[i + 1] : seals[0];

      const html = pageHTML({
        lang,
        title: isEn ? `${s.name_en} — Mayan Tzolkin Seal ${s.num}` : `${s.name_es} — Sello Solar Maya ${s.num}`,
        description: isEn
          ? `Discover the ${s.name_en} seal (${s.nahuatl}) in Mayan Tzolkin astrology. Personality, love, career and cosmic purpose.`
          : `Descubre el sello ${s.name_es} (${s.nahuatl}) en la astrologia maya Tzolkin. Personalidad, amor, carrera y proposito cosmico.`,
        canonicalPath: `/${dir}/${slug}.html`,
        hreflangEs: `/astrologia-maya/${s.slug_es}.html`,
        hreflangEn: `/en/mayan-astrology/${s.slug_en}.html`,
        symbol: '\u{1F52E}',
        h1: isEn ? `${s.name_en} — Seal ${s.num}` : `${s.name_es} — Sello ${s.num}`,
        subtitle: `${s.nahuatl} | ${isEn ? 'Color' : 'Color'}: ${isEn ? s.color_en : s.color_es}`,
        metaItems: [
          { color: s.color, text: isEn ? s.color_en : s.color_es },
          { color: '#d4a849', text: `${s.nahuatl}` },
          { color: '#7c5cbf', text: `${isEn ? 'Seal' : 'Sello'} ${s.num}/20` }
        ],
        cards: [
          { title: isEn ? `The ${s.name_en} Seal` : `El Sello ${s.name_es}`, paragraphs: [content.intro(s)] },
          { title: isEn ? 'Personality' : 'Personalidad', paragraphs: [content.personality(s)] },
          { title: isEn ? 'Love & Relationships' : 'Amor y Relaciones', paragraphs: [content.love(s)] },
          { title: isEn ? 'Career & Purpose' : 'Carrera y Proposito', paragraphs: [content.career(s)] },
          { title: isEn ? 'Advice' : 'Consejos', paragraphs: [content.advice(s)] },
        ],
        ctaCards: [
          { href: isEn ? '/en/mayan-astrology/' : '/astrologia-maya/', title: isEn ? 'All Seals' : 'Todos los Sellos', desc: isEn ? '20 Solar Seals' : '20 Sellos Solares' },
          { href: isEn ? '/en/vedic-astrology/' : '/astrologia-vedica/', title: isEn ? 'Vedic Astrology' : 'Astrologia Vedica', desc: isEn ? 'Your sidereal sign' : 'Tu signo sideral' },
          { href: isEn ? '/en/human-design/' : '/diseno-humano/', title: isEn ? 'Human Design' : 'Diseno Humano', desc: isEn ? 'Your Sun Gate' : 'Tu Gate Solar' },
        ],
        prevLink: { href: `${isEn ? prev.slug_en : prev.slug_es}.html`, label: isEn ? prev.name_en : prev.name_es },
        nextLink: { href: `${isEn ? next.slug_en : next.slug_es}.html`, label: isEn ? next.name_en : next.name_es },
        allLink: isEn ? '/en/mayan-astrology/' : '/astrologia-maya/',
        allLabel: isEn ? 'All Seals' : 'Todos los Sellos',
      });

      const filePath = path.join(__dirname, '..', dir, `${slug}.html`);
      fs.writeFileSync(filePath, html);
      count++;
    }
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════
// MAYAN TONES (13 pages x 2 langs = 26)
// ═══════════════════════════════════════════════════════════════

function generateMayanTones() {
  const tones = CC.MAYAN_TONES;
  let count = 0;

  for (const lang of ['es', 'en']) {
    const isEn = lang === 'en';
    const dir = isEn ? 'en/mayan-astrology' : 'astrologia-maya';

    for (let i = 0; i < tones.length; i++) {
      const t = tones[i];
      const slug = `tono-${t.num}`;
      const slugEn = `tone-${t.num}`;
      const name = isEn ? t.name_en : t.name_es;
      const keyword = isEn ? t.keyword_en : t.keyword_es;
      const prev = i > 0 ? tones[i - 1] : tones[tones.length - 1];
      const next = i < tones.length - 1 ? tones[i + 1] : tones[0];

      const html = pageHTML({
        lang,
        title: isEn ? `Tone ${t.num}: ${t.name_en} — Mayan Galactic Tone` : `Tono ${t.num}: ${t.name_es} — Tono Galactico Maya`,
        description: isEn
          ? `Discover Galactic Tone ${t.num} (${t.name_en}) in Mayan Tzolkin. Keyword: ${t.keyword_en}. Meaning, energy and cosmic influence.`
          : `Descubre el Tono Galactico ${t.num} (${t.name_es}) en el Tzolkin Maya. Palabra clave: ${t.keyword_es}. Significado, energia e influencia cosmica.`,
        canonicalPath: `/${dir}/${isEn ? slugEn : slug}.html`,
        hreflangEs: `/astrologia-maya/${slug}.html`,
        hreflangEn: `/en/mayan-astrology/${slugEn}.html`,
        symbol: '\u2728',
        h1: isEn ? `Tone ${t.num}: ${t.name_en}` : `Tono ${t.num}: ${t.name_es}`,
        subtitle: isEn ? `Keyword: ${t.keyword_en}` : `Palabra clave: ${t.keyword_es}`,
        metaItems: [
          { color: '#d4a849', text: isEn ? `Tone ${t.num} of 13` : `Tono ${t.num} de 13` },
          { color: '#7c5cbf', text: keyword },
        ],
        cards: [
          {
            title: isEn ? `Galactic Tone ${t.num}: ${t.name_en}` : `Tono Galactico ${t.num}: ${t.name_es}`,
            paragraphs: [
              isEn
                ? `Galactic Tone ${t.num}, known as the ${t.name_en} Tone, carries the keyword "${t.keyword_en}". In the Mayan Tzolkin calendar, the 13 tones represent different phases of creation and evolution. Each tone modulates the energy of the Solar Seal it accompanies, adding a specific quality to your cosmic blueprint.`
                : `El Tono Galactico ${t.num}, conocido como el Tono ${t.name_es}, lleva la palabra clave "${t.keyword_es}". En el calendario Tzolkin maya, los 13 tonos representan diferentes fases de la creacion y evolucion. Cada tono modula la energia del Sello Solar que lo acompana, anadiendo una cualidad especifica a tu mapa cosmico.`,
              isEn
                ? `People with Tone ${t.num} in their Kin tend to express their life purpose through the lens of ${t.keyword_en.toLowerCase()}. This tone shapes how they interact with the world and approach their personal and spiritual growth.`
                : `Las personas con el Tono ${t.num} en su Kin tienden a expresar su proposito de vida a traves de la lente de ${t.keyword_es.toLowerCase()}. Este tono moldea como interactuan con el mundo y abordan su crecimiento personal y espiritual.`
            ]
          },
          {
            title: isEn ? 'Energy & Meaning' : 'Energia y Significado',
            paragraphs: [
              isEn
                ? `The ${t.name_en} Tone (${t.num}) vibrates with the energy of ${t.keyword_en.toLowerCase()}. In the wave of creation, this position represents ${t.num <= 4 ? 'the initial phase of establishing foundations' : t.num <= 9 ? 'the middle phase of development and expression' : 'the final phase of completion and transcendence'}. Understanding your tone helps you align with the natural rhythm of the universe.`
                : `El Tono ${t.name_es} (${t.num}) vibra con la energia de ${t.keyword_es.toLowerCase()}. En la onda de la creacion, esta posicion representa ${t.num <= 4 ? 'la fase inicial de establecimiento de cimientos' : t.num <= 9 ? 'la fase media de desarrollo y expresion' : 'la fase final de completitud y trascendencia'}. Comprender tu tono te ayuda a alinearte con el ritmo natural del universo.`
            ]
          },
          {
            title: isEn ? 'How to Work with This Tone' : 'Como Trabajar con Este Tono',
            paragraphs: [
              isEn
                ? `To harness the power of the ${t.name_en} Tone, focus on embodying ${t.keyword_en.toLowerCase()} in your daily actions. Observe how this energy manifests in your relationships, career, and spiritual practice. The more consciously you align with your tone, the more naturally your life flows in harmony with your Kin.`
                : `Para aprovechar el poder del Tono ${t.name_es}, enfocate en encarnar ${t.keyword_es.toLowerCase()} en tus acciones diarias. Observa como esta energia se manifiesta en tus relaciones, carrera y practica espiritual. Cuanto mas conscientemente te alineas con tu tono, mas naturalmente tu vida fluye en armonia con tu Kin.`
            ]
          }
        ],
        ctaCards: [
          { href: isEn ? '/en/mayan-astrology/' : '/astrologia-maya/', title: isEn ? 'All Seals & Tones' : 'Sellos y Tonos', desc: isEn ? 'Mayan Tzolkin' : 'Tzolkin Maya' },
          { href: isEn ? '/en/numerology/' : '/numerologia/', title: isEn ? 'Numerology' : 'Numerologia', desc: isEn ? 'Life Path Number' : 'Numero de Vida' },
        ],
        prevLink: { href: `${isEn ? 'tone' : 'tono'}-${prev.num}.html`, label: isEn ? `Tone ${prev.num}` : `Tono ${prev.num}` },
        nextLink: { href: `${isEn ? 'tone' : 'tono'}-${next.num}.html`, label: isEn ? `Tone ${next.num}` : `Tono ${next.num}` },
        allLink: isEn ? '/en/mayan-astrology/' : '/astrologia-maya/',
        allLabel: isEn ? 'All Tones' : 'Todos los Tonos',
      });

      const filePath = path.join(__dirname, '..', dir, `${isEn ? slugEn : slug}.html`);
      fs.writeFileSync(filePath, html);
      count++;
    }
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════
// VEDIC RASHIS (12 pages x 2 langs = 24)
// ═══════════════════════════════════════════════════════════════

function generateVedicRashis() {
  const rashis = CC.VEDIC_RASHIS;
  let count = 0;

  for (const lang of ['es', 'en']) {
    const isEn = lang === 'en';
    const dir = isEn ? 'en/vedic-astrology' : 'astrologia-vedica';

    for (let i = 0; i < rashis.length; i++) {
      const r = rashis[i];
      const slug = isEn ? r.slug_en : r.slug_es;
      const name = isEn ? r.name_en : r.name_es;
      const element = isEn ? r.element_en : r.element_es;
      const ruler = isEn ? r.ruler_en : r.ruler_es;
      const prev = i > 0 ? rashis[i - 1] : rashis[rashis.length - 1];
      const next = i < rashis.length - 1 ? rashis[i + 1] : rashis[0];
      const degStart = i * 30;
      const degEnd = (i + 1) * 30;

      const html = pageHTML({
        lang,
        title: isEn ? `${r.name_sa} (${r.name_en.split('(')[1]?.replace(')', '') || r.name_sa}) — Vedic Rashi` : `${r.name_sa} (${r.name_es.split('(')[1]?.replace(')', '') || r.name_sa}) — Rashi Vedico`,
        description: isEn
          ? `Discover ${r.name_sa} in Vedic/Jyotish astrology. Sidereal ${element} sign ruled by ${ruler}. Personality, compatibility and spiritual path.`
          : `Descubre ${r.name_sa} en la astrologia vedica/Jyotish. Signo sideral de ${element} regido por ${ruler}. Personalidad, compatibilidad y camino espiritual.`,
        canonicalPath: `/${dir}/${slug}.html`,
        hreflangEs: `/astrologia-vedica/${r.slug_es}.html`,
        hreflangEn: `/en/vedic-astrology/${r.slug_en}.html`,
        symbol: '\u{1F549}\uFE0F',
        h1: `${r.name_sa}`,
        subtitle: `${name} | ${degStart}\u00B0 - ${degEnd}\u00B0 ${isEn ? 'sidereal' : 'sideral'}`,
        metaItems: [
          { color: r.color, text: element },
          { color: '#d4a849', text: `${isEn ? 'Ruler' : 'Regente'}: ${ruler}` },
          { color: '#7c5cbf', text: `${isEn ? 'Rashi' : 'Rashi'} ${r.num}/12` }
        ],
        cards: [
          {
            title: isEn ? `${r.name_sa} in Vedic Astrology` : `${r.name_sa} en la Astrologia Vedica`,
            paragraphs: [
              isEn
                ? `${r.name_sa} is the ${ordinalEn(r.num)} sign (rashi) in Vedic astrology, spanning from ${degStart} to ${degEnd} degrees of the sidereal zodiac. Unlike Western tropical astrology, Vedic/Jyotish astrology uses the sidereal zodiac, which accounts for the precession of equinoxes through the Lahiri ayanamsa correction. This means your Vedic sign may differ from your Western sign.`
                : `${r.name_sa} es el ${ordinalEs(r.num)} signo (rashi) en la astrologia vedica, abarcando de ${degStart} a ${degEnd} grados del zodiaco sideral. A diferencia de la astrologia tropical occidental, la astrologia vedica/Jyotish usa el zodiaco sideral, que tiene en cuenta la precesion de los equinoccios mediante la correccion del ayanamsa Lahiri. Esto significa que tu signo vedico puede diferir de tu signo occidental.`,
              isEn
                ? `As a ${element} sign ruled by ${ruler}, ${r.name_sa} embodies ${element === 'Fire' ? 'dynamic energy, enthusiasm, and initiative' : element === 'Earth' ? 'stability, practicality, and groundedness' : element === 'Air' ? 'intellect, communication, and adaptability' : 'emotional depth, intuition, and sensitivity'}. The influence of ${ruler} adds ${ruler === 'Mars' ? 'courage and assertiveness' : ruler === 'Venus' ? 'beauty and harmony' : ruler === 'Mercury' ? 'intelligence and versatility' : ruler === 'Moon' ? 'nurturing and emotional sensitivity' : ruler === 'Sun' ? 'vitality and leadership' : ruler === 'Jupiter' ? 'wisdom and expansion' : 'discipline and structure'} to this rashi.`
                : `Como signo de ${element} regido por ${ruler}, ${r.name_sa} encarna ${element === 'Fuego' ? 'energia dinamica, entusiasmo e iniciativa' : element === 'Tierra' ? 'estabilidad, practicidad y arraigo' : element === 'Aire' ? 'intelecto, comunicacion y adaptabilidad' : 'profundidad emocional, intuicion y sensibilidad'}. La influencia de ${ruler} anade ${ruler === 'Marte' ? 'coraje y determinacion' : ruler === 'Venus' ? 'belleza y armonia' : ruler === 'Mercurio' ? 'inteligencia y versatilidad' : ruler === 'Luna' ? 'sensibilidad y cuidado emocional' : ruler === 'Sol' ? 'vitalidad y liderazgo' : ruler === 'Jupiter' || ruler === 'Júpiter' ? 'sabiduria y expansion' : 'disciplina y estructura'} a este rashi.`
            ]
          },
          {
            title: isEn ? 'Personality Traits' : 'Rasgos de Personalidad',
            paragraphs: [
              isEn
                ? `Individuals with their Sun in ${r.name_sa} tend to display the core qualities of ${element.toLowerCase()} energy filtered through the lens of ${ruler}'s influence. They are ${element === 'Fire' ? 'bold, passionate, and action-oriented' : element === 'Earth' ? 'methodical, reliable, and practical' : element === 'Air' ? 'communicative, intellectual, and social' : 'empathetic, intuitive, and emotionally rich'}. Their approach to life reflects the ancient Vedic understanding of cosmic harmony.`
                : `Las personas con su Sol en ${r.name_sa} tienden a mostrar las cualidades centrales de la energia de ${element.toLowerCase()} filtrada a traves de la influencia de ${ruler}. Son ${element === 'Fuego' ? 'audaces, apasionados y orientados a la accion' : element === 'Tierra' ? 'metodicos, confiables y practicos' : element === 'Aire' ? 'comunicativos, intelectuales y sociables' : 'empaticos, intuitivos y emocionalmente ricos'}. Su enfoque de la vida refleja la comprension vedica ancestral de la armonia cosmica.`
            ]
          },
          {
            title: isEn ? 'Nakshatras in This Rashi' : 'Nakshatras en Este Rashi',
            paragraphs: [
              isEn
                ? `Each rashi contains approximately 2.25 nakshatras (lunar mansions). The nakshatras within ${r.name_sa} add layers of nuance to the sign's expression. Understanding your specific nakshatra placement gives a much more detailed picture of your personality, talents, and life path than the rashi alone.`
                : `Cada rashi contiene aproximadamente 2.25 nakshatras (mansiones lunares). Los nakshatras dentro de ${r.name_sa} anaden capas de matiz a la expresion del signo. Comprender tu ubicacion especifica de nakshatra te da una imagen mucho mas detallada de tu personalidad, talentos y camino de vida que solo el rashi.`
            ]
          },
          {
            title: isEn ? 'Spiritual Path' : 'Camino Espiritual',
            paragraphs: [
              isEn
                ? `In Jyotish philosophy, ${r.name_sa} represents a specific stage in the soul's evolutionary journey. The ${element.toLowerCase()} element of this rashi calls you to develop ${element === 'Fire' ? 'conscious action and divine will' : element === 'Earth' ? 'grounded presence and service' : element === 'Air' ? 'higher knowledge and right communication' : 'devotion and emotional purification'}. Working consciously with your rashi energy accelerates spiritual growth.`
                : `En la filosofia Jyotish, ${r.name_sa} representa una etapa especifica en el viaje evolutivo del alma. El elemento ${element.toLowerCase()} de este rashi te llama a desarrollar ${element === 'Fuego' ? 'accion consciente y voluntad divina' : element === 'Tierra' ? 'presencia arraigada y servicio' : element === 'Aire' ? 'conocimiento superior y comunicacion correcta' : 'devocion y purificacion emocional'}. Trabajar conscientemente con la energia de tu rashi acelera el crecimiento espiritual.`
            ]
          }
        ],
        ctaCards: [
          { href: isEn ? '/en/vedic-astrology/' : '/astrologia-vedica/', title: isEn ? 'All Rashis' : 'Todos los Rashis', desc: isEn ? '12 Sidereal Signs' : '12 Signos Siderales' },
          { href: isEn ? '/en/mayan-astrology/' : '/astrologia-maya/', title: 'Tzolkin Maya', desc: isEn ? 'Your Mayan Kin' : 'Tu Kin Maya' },
          { href: isEn ? '/en/human-design/' : '/diseno-humano/', title: isEn ? 'Human Design' : 'Diseno Humano', desc: isEn ? 'Your Sun Gate' : 'Tu Gate Solar' },
        ],
        prevLink: { href: `${isEn ? prev.slug_en : prev.slug_es}.html`, label: prev.name_sa },
        nextLink: { href: `${isEn ? next.slug_en : next.slug_es}.html`, label: next.name_sa },
        allLink: isEn ? '/en/vedic-astrology/' : '/astrologia-vedica/',
        allLabel: isEn ? 'All Rashis' : 'Todos los Rashis',
      });

      const filePath = path.join(__dirname, '..', dir, `${slug}.html`);
      fs.writeFileSync(filePath, html);
      count++;
    }
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════
// VEDIC NAKSHATRAS (27 pages x 2 langs = 54)
// ═══════════════════════════════════════════════════════════════

function generateVedicNakshatras() {
  const naks = CC.VEDIC_NAKSHATRAS;
  let count = 0;

  for (const lang of ['es', 'en']) {
    const isEn = lang === 'en';
    const dir = isEn ? 'en/vedic-astrology' : 'astrologia-vedica';

    for (let i = 0; i < naks.length; i++) {
      const n = naks[i];
      const slug = isEn ? n.slug_en : n.slug_es;
      const ruler = isEn ? n.ruler_en : n.ruler_es;
      const deity = isEn ? n.deity_en : n.deity_es;
      const prev = i > 0 ? naks[i - 1] : naks[naks.length - 1];
      const next = i < naks.length - 1 ? naks[i + 1] : naks[0];
      const degStart = Math.round(i * (360 / 27) * 100) / 100;
      const degEnd = Math.round((i + 1) * (360 / 27) * 100) / 100;

      const html = pageHTML({
        lang,
        title: isEn ? `${n.name_sa} — Nakshatra ${n.num} in Vedic Astrology` : `${n.name_sa} — Nakshatra ${n.num} en Astrologia Vedica`,
        description: isEn
          ? `Discover Nakshatra ${n.name_sa} (lunar mansion ${n.num}/27). Ruled by ${ruler}, deity ${deity}. Personality, purpose and spiritual meaning.`
          : `Descubre el Nakshatra ${n.name_sa} (mansion lunar ${n.num}/27). Regido por ${ruler}, deidad ${deity}. Personalidad, proposito y significado espiritual.`,
        canonicalPath: `/${dir}/${slug}.html`,
        hreflangEs: `/astrologia-vedica/${n.slug_es}.html`,
        hreflangEn: `/en/vedic-astrology/${n.slug_en}.html`,
        symbol: '\u2729',
        h1: n.name_sa,
        subtitle: `${isEn ? 'Nakshatra' : 'Nakshatra'} ${n.num}/27 | ${degStart}\u00B0 - ${degEnd}\u00B0`,
        metaItems: [
          { color: '#d4a849', text: `${isEn ? 'Ruler' : 'Regente'}: ${ruler}` },
          { color: '#7c5cbf', text: `${isEn ? 'Deity' : 'Deidad'}: ${deity}` },
        ],
        cards: [
          {
            title: isEn ? `Nakshatra ${n.name_sa}` : `Nakshatra ${n.name_sa}`,
            paragraphs: [
              isEn
                ? `${n.name_sa} is the ${ordinalEn(n.num)} of the 27 Nakshatras (lunar mansions) in Vedic astrology, spanning from ${degStart} to ${degEnd} degrees of the sidereal zodiac. Ruled by ${ruler} and presided over by the deity ${deity}, this nakshatra carries a unique vibrational quality that influences those born under its star.`
                : `${n.name_sa} es el ${ordinalEs(n.num)} de los 27 Nakshatras (mansiones lunares) en la astrologia vedica, abarcando de ${degStart} a ${degEnd} grados del zodiaco sideral. Regido por ${ruler} y presidido por la deidad ${deity}, este nakshatra lleva una cualidad vibracional unica que influye en quienes nacen bajo su estrella.`,
              isEn
                ? `The Nakshatras offer a much finer level of astrological detail than the 12 rashis alone. While your rashi gives a broad picture, your nakshatra reveals the specific qualities, talents, and challenges that color your personality and destiny.`
                : `Los Nakshatras ofrecen un nivel de detalle astrologico mucho mas fino que solo los 12 rashis. Mientras tu rashi da una imagen amplia, tu nakshatra revela las cualidades especificas, talentos y desafios que colorean tu personalidad y destino.`
            ]
          },
          {
            title: isEn ? 'Personality & Qualities' : 'Personalidad y Cualidades',
            paragraphs: [
              isEn
                ? `People born under ${n.name_sa} carry the blessings and challenges of ${deity}. The planetary ruler ${ruler} shapes their mental patterns and life experiences. This combination creates individuals with distinctive qualities that set them apart and guide them toward their life purpose.`
                : `Las personas nacidas bajo ${n.name_sa} llevan las bendiciones y desafios de ${deity}. El regente planetario ${ruler} moldea sus patrones mentales y experiencias de vida. Esta combinacion crea individuos con cualidades distintivas que los distinguen y los guian hacia su proposito de vida.`
            ]
          },
          {
            title: isEn ? 'The Four Padas' : 'Los Cuatro Padas',
            paragraphs: [
              isEn
                ? `Each nakshatra is divided into 4 padas (quarters), each spanning ${Math.round((360/27/4) * 100) / 100} degrees. The pada refines the nakshatra's expression further: Pada 1 relates to dharma (purpose), Pada 2 to artha (wealth), Pada 3 to kama (desire), and Pada 4 to moksha (liberation). Your specific pada adds another layer of meaning to your cosmic blueprint.`
                : `Cada nakshatra se divide en 4 padas (cuartos), cada uno abarcando ${Math.round((360/27/4) * 100) / 100} grados. El pada refina aun mas la expresion del nakshatra: Pada 1 se relaciona con dharma (proposito), Pada 2 con artha (riqueza), Pada 3 con kama (deseo), y Pada 4 con moksha (liberacion). Tu pada especifico anade otra capa de significado a tu mapa cosmico.`
            ]
          },
          {
            title: isEn ? 'Remedies & Practices' : 'Remedios y Practicas',
            paragraphs: [
              isEn
                ? `To harmonize with the energy of ${n.name_sa}, Vedic tradition recommends honoring its presiding deity ${deity} and working consciously with the qualities of its planetary ruler ${ruler}. Meditation, mantra recitation, and connecting with the specific symbolism of this nakshatra can help align your life with its highest potential.`
                : `Para armonizar con la energia de ${n.name_sa}, la tradicion vedica recomienda honrar a su deidad presidenta ${deity} y trabajar conscientemente con las cualidades de su regente planetario ${ruler}. La meditacion, recitacion de mantras y la conexion con el simbolismo especifico de este nakshatra pueden ayudar a alinear tu vida con su maximo potencial.`
            ]
          }
        ],
        ctaCards: [
          { href: isEn ? '/en/vedic-astrology/' : '/astrologia-vedica/', title: isEn ? 'All Rashis' : 'Todos los Rashis', desc: isEn ? '12 Sidereal Signs' : '12 Signos Siderales' },
          { href: isEn ? '/en/mayan-astrology/' : '/astrologia-maya/', title: 'Tzolkin Maya', desc: isEn ? 'Your Mayan Kin' : 'Tu Kin Maya' },
        ],
        prevLink: { href: `${isEn ? prev.slug_en : prev.slug_es}.html`, label: prev.name_sa },
        nextLink: { href: `${isEn ? next.slug_en : next.slug_es}.html`, label: next.name_sa },
        allLink: isEn ? '/en/vedic-astrology/' : '/astrologia-vedica/',
        allLabel: isEn ? 'All Nakshatras' : 'Todos los Nakshatras',
      });

      const filePath = path.join(__dirname, '..', dir, `${slug}.html`);
      fs.writeFileSync(filePath, html);
      count++;
    }
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════
// HUMAN DESIGN GATES (64 pages x 2 langs = 128)
// ═══════════════════════════════════════════════════════════════

function generateHDGates() {
  const gateData = CC.HD_GATE_DATA;
  let count = 0;

  // Sort gates by number
  const gateNumbers = Object.keys(gateData).map(Number).sort((a, b) => a - b);

  for (const lang of ['es', 'en']) {
    const isEn = lang === 'en';
    const dir = isEn ? 'en/human-design' : 'diseno-humano';

    for (let idx = 0; idx < gateNumbers.length; idx++) {
      const gateNum = gateNumbers[idx];
      const g = gateData[gateNum];
      const prevGate = idx > 0 ? gateNumbers[idx - 1] : gateNumbers[gateNumbers.length - 1];
      const nextGate = idx < gateNumbers.length - 1 ? gateNumbers[idx + 1] : gateNumbers[0];
      const name = isEn ? g.name_en : g.name_es;
      const shadow = isEn ? g.genekey_shadow_en : g.genekey_shadow_es;
      const gift = isEn ? g.genekey_gift_en : g.genekey_gift_es;
      const siddhi = isEn ? g.genekey_siddhi_en : g.genekey_siddhi_es;

      const html = pageHTML({
        lang,
        title: isEn ? `Gate ${gateNum}: ${g.name_en} — Human Design & Gene Key` : `Gate ${gateNum}: ${g.name_es} — Diseno Humano y Clave Genetica`,
        description: isEn
          ? `Discover Gate ${gateNum} (${g.name_en}) in Human Design. Gene Key ${gateNum}: ${shadow} → ${gift} → ${siddhi}. Meaning, purpose and transformation.`
          : `Descubre el Gate ${gateNum} (${g.name_es}) en Diseno Humano. Clave Genetica ${gateNum}: ${shadow} → ${gift} → ${siddhi}. Significado, proposito y transformacion.`,
        canonicalPath: `/${dir}/gate-${gateNum}.html`,
        hreflangEs: `/diseno-humano/gate-${gateNum}.html`,
        hreflangEn: `/en/human-design/gate-${gateNum}.html`,
        symbol: '\u2B21',
        h1: `Gate ${gateNum}`,
        subtitle: name,
        metaItems: [
          { color: '#E53935', text: `Shadow: ${shadow}` },
          { color: '#d4a849', text: `Gift: ${gift}` },
          { color: '#7c5cbf', text: `Siddhi: ${siddhi}` },
        ],
        cards: [
          {
            title: isEn ? `Gate ${gateNum}: ${g.name_en}` : `Gate ${gateNum}: ${g.name_es}`,
            paragraphs: [
              isEn
                ? `Gate ${gateNum}, known as "${g.name_en}", is one of the 64 gates in the Human Design system, corresponding to Hexagram ${gateNum} of the I Ching. Each gate represents a specific archetypal energy that influences how you interact with the world. When activated by the Sun at the time of your birth, this gate becomes a core part of your design.`
                : `El Gate ${gateNum}, conocido como "${g.name_es}", es una de las 64 puertas en el sistema de Diseno Humano, correspondiente al Hexagrama ${gateNum} del I Ching. Cada gate representa una energia arquetipica especifica que influye en como interactuas con el mundo. Cuando es activado por el Sol en el momento de tu nacimiento, este gate se convierte en una parte central de tu diseno.`,
              isEn
                ? `This gate operates across 6 lines, each adding its own variation to the gate's expression. Your specific line (1-6) determines how you personally embody this energy — whether through investigation, natural talent, adaptability, externalization, universalization, or role modeling.`
                : `Este gate opera a traves de 6 lineas, cada una anadiendo su propia variacion a la expresion del gate. Tu linea especifica (1-6) determina como encarnas personalmente esta energia — ya sea a traves de la investigacion, el talento natural, la adaptabilidad, la externalizacion, la universalizacion o el modelado de roles.`
            ]
          },
          {
            title: isEn ? `Gene Key ${gateNum}: The Spectrum of Transformation` : `Clave Genetica ${gateNum}: El Espectro de Transformacion`,
            paragraphs: [
              isEn
                ? `The Gene Keys system, developed by Richard Rudd, maps each of the 64 gates to a spectrum of consciousness with three levels: Shadow, Gift, and Siddhi. Gate ${gateNum} holds the transformational journey from ${shadow} (shadow frequency) through ${gift} (gift frequency) to ${siddhi} (siddhi/highest frequency).`
                : `El sistema de Claves Geneticas, desarrollado por Richard Rudd, mapea cada una de las 64 puertas a un espectro de conciencia con tres niveles: Sombra, Don y Siddhi. El Gate ${gateNum} sostiene el viaje transformacional desde ${shadow} (frecuencia sombra) a traves de ${gift} (frecuencia don) hasta ${siddhi} (frecuencia siddhi/mas alta).`,
              isEn
                ? `At the Shadow level of ${shadow}, this energy manifests as a challenge or unconscious pattern. As you become aware and embrace this shadow, it naturally transforms into the Gift of ${gift}. At the highest level, the Siddhi of ${siddhi} represents the full flowering of this energy in its most divine expression.`
                : `Al nivel de Sombra de ${shadow}, esta energia se manifiesta como un desafio o patron inconsciente. A medida que te haces consciente y abrazas esta sombra, se transforma naturalmente en el Don de ${gift}. Al nivel mas alto, el Siddhi de ${siddhi} representa el florecimiento completo de esta energia en su expresion mas divina.`
            ]
          },
          {
            title: isEn ? 'Living Your Gate' : 'Viviendo Tu Gate',
            paragraphs: [
              isEn
                ? `To live authentically with Gate ${gateNum}, observe how the theme of "${g.name_en}" shows up in your daily life. Notice when you fall into the shadow pattern of ${shadow.toLowerCase()} and gently redirect your energy toward the gift of ${gift.toLowerCase()}. This is not about forcing change, but about deepening self-awareness and allowing your natural transformation to unfold.`
                : `Para vivir autenticamente con el Gate ${gateNum}, observa como el tema de "${g.name_es}" aparece en tu vida diaria. Nota cuando caes en el patron sombra de ${shadow.toLowerCase()} y redirige suavemente tu energia hacia el don de ${gift.toLowerCase()}. No se trata de forzar el cambio, sino de profundizar la autoconciencia y permitir que tu transformacion natural se despliegue.`
            ]
          },
          {
            title: isEn ? 'The 6 Lines' : 'Las 6 Lineas',
            paragraphs: [
              isEn
                ? `Line 1: The Investigator — learns through deep research. Line 2: The Hermit — has natural talent, needs solitude. Line 3: The Martyr — learns through trial and error. Line 4: The Opportunist — shares through networks and relationships. Line 5: The Heretic — projects solutions universally. Line 6: The Role Model — embodies wisdom through life experience.`
                : `Linea 1: El Investigador — aprende a traves de la investigacion profunda. Linea 2: El Ermitano — tiene talento natural, necesita soledad. Linea 3: El Martir — aprende por ensayo y error. Linea 4: El Oportunista — comparte a traves de redes y relaciones. Linea 5: El Hereje — proyecta soluciones universalmente. Linea 6: El Modelo a Seguir — encarna sabiduria a traves de la experiencia de vida.`
            ]
          }
        ],
        ctaCards: [
          { href: isEn ? '/en/human-design/' : '/diseno-humano/', title: isEn ? 'Human Design' : 'Diseno Humano', desc: isEn ? 'Calculate your Gate' : 'Calcula tu Gate' },
          { href: isEn ? '/en/mayan-astrology/' : '/astrologia-maya/', title: 'Tzolkin Maya', desc: isEn ? 'Your Mayan Kin' : 'Tu Kin Maya' },
          { href: isEn ? '/en/enneagram/' : '/eneagrama/', title: isEn ? 'Enneagram' : 'Eneagrama', desc: isEn ? 'Discover your type' : 'Descubre tu tipo' },
        ],
        prevLink: { href: `gate-${prevGate}.html`, label: `Gate ${prevGate}` },
        nextLink: { href: `gate-${nextGate}.html`, label: `Gate ${nextGate}` },
        allLink: isEn ? '/en/human-design/' : '/diseno-humano/',
        allLabel: isEn ? 'All Gates' : 'Todos los Gates',
      });

      const filePath = path.join(__dirname, '..', dir, `gate-${gateNum}.html`);
      fs.writeFileSync(filePath, html);
      count++;
    }
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════
// ENNEAGRAM TYPES (9 pages x 2 langs = 18)
// ═══════════════════════════════════════════════════════════════

function generateEnneagramTypes() {
  const types = CC.ENNEAGRAM_TYPES;
  let count = 0;

  for (const lang of ['es', 'en']) {
    const isEn = lang === 'en';
    const dir = isEn ? 'en/enneagram' : 'eneagrama';

    for (let num = 1; num <= 9; num++) {
      const t = types[num];
      const slug = isEn ? t.slug_en : t.slug_es;
      const name = isEn ? t.name_en : t.name_es;
      const center = isEn ? t.center_en : t.center_es;
      const prevNum = num === 1 ? 9 : num - 1;
      const nextNum = num === 9 ? 1 : num + 1;
      const prevType = types[prevNum];
      const nextType = types[nextNum];
      const wingA = num === 1 ? 9 : num - 1;
      const wingB = num === 9 ? 1 : num + 1;

      const html = pageHTML({
        lang,
        title: isEn ? `Type ${num}: ${t.name_en} — Enneagram Personality` : `Tipo ${num}: ${t.name_es} — Eneagrama de la Personalidad`,
        description: isEn
          ? `Discover Enneagram Type ${num} (${t.name_en}). ${t.center_en} center personality. Wings ${wingA} and ${wingB}. Growth paths, relationships and self-development.`
          : `Descubre el Tipo ${num} del Eneagrama (${t.name_es}). Personalidad del centro ${t.center_es}. Alas ${wingA} y ${wingB}. Caminos de crecimiento, relaciones y autodesarrollo.`,
        canonicalPath: `/${dir}/${slug}.html`,
        hreflangEs: `/eneagrama/${t.slug_es}.html`,
        hreflangEn: `/en/enneagram/${t.slug_en}.html`,
        symbol: `\u{2776}`,
        h1: isEn ? `Type ${num}: ${t.name_en}` : `Tipo ${num}: ${t.name_es}`,
        subtitle: isEn ? `${t.center_en} Center | Wings: ${wingA} & ${wingB}` : `Centro ${t.center_es} | Alas: ${wingA} y ${wingB}`,
        metaItems: [
          { color: t.color, text: name },
          { color: '#d4a849', text: isEn ? `${t.center_en} Center` : `Centro ${t.center_es}` },
          { color: '#7c5cbf', text: isEn ? `Wings ${wingA} & ${wingB}` : `Alas ${wingA} y ${wingB}` }
        ],
        cards: [
          {
            title: isEn ? `Type ${num}: ${t.name_en}` : `Tipo ${num}: ${t.name_es}`,
            paragraphs: [
              isEn
                ? `Enneagram Type ${num}, ${t.name_en}, belongs to the ${t.center_en} center of intelligence. The Enneagram is a dynamic personality system that maps nine fundamental patterns of thinking, feeling, and behaving. Each type has a core motivation, a core fear, and specific growth paths.`
                : `El Tipo ${num} del Eneagrama, ${t.name_es}, pertenece al centro de inteligencia ${t.center_es}. El Eneagrama es un sistema de personalidad dinamico que mapea nueve patrones fundamentales de pensamiento, sentimiento y comportamiento. Cada tipo tiene una motivacion central, un miedo central y caminos de crecimiento especificos.`,
              isEn
                ? `As a ${t.center_en} center type, ${t.name_en} processes the world primarily through ${t.center_en === 'Body' ? 'instinct, gut feelings, and physical sensations. Their core emotion is anger, which may be expressed, repressed, or redirected' : t.center_en === 'Heart' ? 'feelings, identity, and image. Their core emotion is shame, which drives their need for recognition and self-worth' : 'thinking, analysis, and mental planning. Their core emotion is fear, which motivates their search for security and understanding'}.`
                : `Como tipo del centro ${t.center_es}, ${t.name_es} procesa el mundo principalmente a traves de ${t.center_es === 'Instintivo' ? 'el instinto, las sensaciones viscerales y las sensaciones fisicas. Su emocion central es la ira, que puede ser expresada, reprimida o redirigida' : t.center_es === 'Emocional' ? 'los sentimientos, la identidad y la imagen. Su emocion central es la verguenza, que impulsa su necesidad de reconocimiento y autovaloracion' : 'el pensamiento, el analisis y la planificacion mental. Su emocion central es el miedo, que motiva su busqueda de seguridad y comprension'}.`
            ]
          },
          {
            title: isEn ? 'Strengths & Challenges' : 'Fortalezas y Desafios',
            paragraphs: [
              isEn
                ? `Each Enneagram type has distinctive strengths that emerge when they are healthy and growing. Type ${num} at its best brings ${num === 1 ? 'integrity, wisdom, and discernment' : num === 2 ? 'genuine love, empathy, and selfless care' : num === 3 ? 'authenticity, inspiration, and true leadership' : num === 4 ? 'creativity, emotional depth, and self-renewal' : num === 5 ? 'original thinking, expertise, and visionary insight' : num === 6 ? 'courage, loyalty, and grounded faith' : num === 7 ? 'joy, gratitude, and present-moment awareness' : num === 8 ? 'magnanimity, protection, and empowering strength' : 'unconditional acceptance, mediation, and inner peace'} to the world.`
                : `Cada tipo del Eneagrama tiene fortalezas distintivas que emergen cuando estan sanos y creciendo. El Tipo ${num} en su mejor version aporta ${num === 1 ? 'integridad, sabiduria y discernimiento' : num === 2 ? 'amor genuino, empatia y cuidado desinteresado' : num === 3 ? 'autenticidad, inspiracion y liderazgo verdadero' : num === 4 ? 'creatividad, profundidad emocional y autorenovacion' : num === 5 ? 'pensamiento original, experiencia e vision visionaria' : num === 6 ? 'coraje, lealtad y fe arraigada' : num === 7 ? 'alegria, gratitud y conciencia del momento presente' : num === 8 ? 'magnanimidad, proteccion y fortaleza que empodera' : 'aceptacion incondicional, mediacion y paz interior'} al mundo.`
            ]
          },
          {
            title: isEn ? 'Wings' : 'Alas',
            paragraphs: [
              isEn
                ? `Type ${num} can lean toward Wing ${wingA} (${types[wingA].name_en}) or Wing ${wingB} (${types[wingB].name_en}). Your dominant wing adds a secondary flavor to your core type. A ${num}w${wingA} combines the core motivation of ${t.name_en} with the qualities of ${types[wingA].name_en}, while a ${num}w${wingB} blends it with ${types[wingB].name_en} energy.`
                : `El Tipo ${num} puede inclinarse hacia el Ala ${wingA} (${types[wingA].name_es}) o el Ala ${wingB} (${types[wingB].name_es}). Tu ala dominante anade un sabor secundario a tu tipo central. Un ${num}w${wingA} combina la motivacion central de ${t.name_es} con las cualidades de ${types[wingA].name_es}, mientras que un ${num}w${wingB} la mezcla con la energia de ${types[wingB].name_es}.`
            ]
          },
          {
            title: isEn ? 'Growth Path' : 'Camino de Crecimiento',
            paragraphs: [
              isEn
                ? `The Enneagram teaches that each type has paths of integration (growth) and disintegration (stress). Understanding these dynamic movements helps you recognize when you are growing versus when you are under stress. Self-observation without judgment is the key to transformation in the Enneagram system.`
                : `El Eneagrama ensena que cada tipo tiene caminos de integracion (crecimiento) y desintegracion (estres). Comprender estos movimientos dinamicos te ayuda a reconocer cuando estas creciendo versus cuando estas bajo estres. La autoobservacion sin juicio es la clave para la transformacion en el sistema del Eneagrama.`
            ]
          },
          {
            title: isEn ? 'Relationships' : 'Relaciones',
            paragraphs: [
              isEn
                ? `In relationships, Type ${num} brings ${num === 1 ? 'high standards and dedication' : num === 2 ? 'warmth and attentiveness' : num === 3 ? 'energy and mutual inspiration' : num === 4 ? 'depth and emotional authenticity' : num === 5 ? 'respect for boundaries and intellectual stimulation' : num === 6 ? 'reliability and commitment' : num === 7 ? 'fun, spontaneity, and optimism' : num === 8 ? 'protection, directness, and intensity' : 'harmony, acceptance, and patience'}. Understanding your type helps navigate both compatibility and areas of potential friction with other types.`
                : `En las relaciones, el Tipo ${num} aporta ${num === 1 ? 'altos estandares y dedicacion' : num === 2 ? 'calidez y atencion' : num === 3 ? 'energia e inspiracion mutua' : num === 4 ? 'profundidad y autenticidad emocional' : num === 5 ? 'respeto por los limites y estimulacion intelectual' : num === 6 ? 'confiabilidad y compromiso' : num === 7 ? 'diversion, espontaneidad y optimismo' : num === 8 ? 'proteccion, franqueza e intensidad' : 'armonia, aceptacion y paciencia'}. Comprender tu tipo ayuda a navegar tanto la compatibilidad como las areas de posible friccion con otros tipos.`
            ]
          }
        ],
        ctaCards: [
          { href: isEn ? '/en/enneagram/' : '/eneagrama/', title: isEn ? 'Take the Quiz' : 'Haz el Test', desc: isEn ? 'Find your type' : 'Descubre tu tipo' },
          { href: isEn ? '/en/human-design/' : '/diseno-humano/', title: isEn ? 'Human Design' : 'Diseno Humano', desc: isEn ? 'Your Sun Gate' : 'Tu Gate Solar' },
          { href: isEn ? '/en/numerology/' : '/numerologia/', title: isEn ? 'Numerology' : 'Numerologia', desc: isEn ? 'Life Path Number' : 'Numero de Vida' },
        ],
        prevLink: { href: `${isEn ? prevType.slug_en : prevType.slug_es}.html`, label: isEn ? `Type ${prevNum}` : `Tipo ${prevNum}` },
        nextLink: { href: `${isEn ? nextType.slug_en : nextType.slug_es}.html`, label: isEn ? `Type ${nextNum}` : `Tipo ${nextNum}` },
        allLink: isEn ? '/en/enneagram/' : '/eneagrama/',
        allLabel: isEn ? 'All Types' : 'Todos los Tipos',
      });

      const filePath = path.join(__dirname, '..', dir, `${slug}.html`);
      fs.writeFileSync(filePath, html);
      count++;
    }
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function ordinalEs(n) {
  const ords = ['','primer','segundo','tercer','cuarto','quinto','sexto','septimo','octavo','noveno','decimo',
    'undecimo','duodecimo','decimotercer','decimocuarto','decimoquinto','decimosexto','decimoseptimo',
    'decimoctavo','decimonoveno','vigesimo','vigesimo primer','vigesimo segundo','vigesimo tercer',
    'vigesimo cuarto','vigesimo quinto','vigesimo sexto','vigesimo septimo'];
  return ords[n] || `${n}o`;
}

function ordinalEn(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

console.log('Generating content pages for 4 new systems...\n');

const mayanSeals = generateMayanSeals();
console.log(`  Maya Seals:     ${mayanSeals} pages`);

const mayanTones = generateMayanTones();
console.log(`  Maya Tones:     ${mayanTones} pages`);

const vedicRashis = generateVedicRashis();
console.log(`  Vedic Rashis:   ${vedicRashis} pages`);

const vedicNaks = generateVedicNakshatras();
console.log(`  Vedic Nakshatras: ${vedicNaks} pages`);

const hdGates = generateHDGates();
console.log(`  HD Gates:       ${hdGates} pages`);

const ennTypes = generateEnneagramTypes();
console.log(`  Enneagram:      ${ennTypes} pages`);

const total = mayanSeals + mayanTones + vedicRashis + vedicNaks + hdGates + ennTypes;
console.log(`\n  TOTAL: ${total} pages generated.`);
