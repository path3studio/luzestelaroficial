/**
 * GET /api/reports/compatibility?profile_a=xxx&profile_b=yyy — Cross-cultural compatibility (v2)
 *
 * Premium only. Rich multi-system synastry across Western, Chinese, Numerology,
 * Celtic, Mayan, Vedic, Human Design & Enneagram with narrative synthesis.
 *
 * v2 (Apr 16): Rewrote synthesis from generic template to layered narrative
 * (panorama / fortalezas / tensiones / crecimiento / ritual). Cached with
 * `compat_v2_*` key to invalidate v1.
 */

// ───────── Reference tables ─────────
const WESTERN_ELEMENTS = {
  'Aries':'Fire','Taurus':'Earth','Gemini':'Air','Cancer':'Water',
  'Leo':'Fire','Virgo':'Earth','Libra':'Air','Scorpio':'Water',
  'Sagittarius':'Fire','Capricorn':'Earth','Aquarius':'Air','Pisces':'Water',
};

const WESTERN_MODE = {
  'Aries':'cardinal','Cancer':'cardinal','Libra':'cardinal','Capricorn':'cardinal',
  'Taurus':'fixed','Leo':'fixed','Scorpio':'fixed','Aquarius':'fixed',
  'Gemini':'mutable','Virgo':'mutable','Sagittarius':'mutable','Pisces':'mutable',
};

const ELEMENT_DYN = {
  'Fire-Fire':   { score: 85, es: { gift: 'chispa compartida, velocidad y coraje', risk: 'combustión mutua sin pausa' }, en: { gift: 'shared spark, speed and courage', risk: 'mutual burnout without pause' } },
  'Fire-Earth':  { score: 55, es: { gift: 'fuego con contención — la acción aterriza', risk: 'impaciencia contra cautela' }, en: { gift: 'fire with grounding — action lands', risk: 'impatience vs caution' } },
  'Fire-Air':    { score: 90, es: { gift: 'aire que aviva la llama — ideas + ejecución', risk: 'ambos evitando lo emocional profundo' }, en: { gift: 'air fans the flame — ideas + execution', risk: 'both avoiding deep emotion' } },
  'Fire-Water':  { score: 50, es: { gift: 'pasión + profundidad: intensidad mutua', risk: 'el fuego quema, el agua apaga — temperatura oscilante' }, en: { gift: 'passion + depth: mutual intensity', risk: 'fire burns, water extinguishes — oscillating temperature' } },
  'Earth-Earth': { score: 80, es: { gift: 'estabilidad, construcción conjunta', risk: 'rutina que se vuelve inercia' }, en: { gift: 'stability, joint building', risk: 'routine that hardens into inertia' } },
  'Earth-Air':   { score: 60, es: { gift: 'la idea del aire se materializa en tierra', risk: 'ritmos incompatibles (rápido vs lento)' }, en: { gift: 'air ideas take tangible form', risk: 'mismatched pacing (fast vs slow)' } },
  'Earth-Water': { score: 85, es: { gift: 'nutrición mutua — refugio seguro', risk: 'exceso de confort, miedo al cambio' }, en: { gift: 'mutual nourishment — safe refuge', risk: 'excess comfort, fear of change' } },
  'Air-Air':     { score: 78, es: { gift: 'conversación infinita, estímulo mental', risk: 'mucha teoría, poca encarnación' }, en: { gift: 'endless conversation, mental stimulation', risk: 'much theory, little embodiment' } },
  'Air-Water':   { score: 55, es: { gift: 'poesía + pensamiento — sensibilidad narrada', risk: 'el aire racionaliza lo que el agua siente' }, en: { gift: 'poetry + thought — narrated feeling', risk: 'air rationalizes what water feels' } },
  'Water-Water': { score: 82, es: { gift: 'empatía de espejo, vínculo emocional profundo', risk: 'absorción mutua, pérdida de límites' }, en: { gift: 'mirror empathy, deep emotional bond', risk: 'mutual absorption, lost boundaries' } },
};

function elementDyn(a, b) {
  const k1 = `${a}-${b}`, k2 = `${b}-${a}`;
  return ELEMENT_DYN[k1] || ELEMENT_DYN[k2] || ELEMENT_DYN['Fire-Water'];
}

const CHINESE_TRINES = [
  ['Rat','Dragon','Monkey'],
  ['Ox','Snake','Rooster'],
  ['Tiger','Horse','Dog'],
  ['Rabbit','Goat','Pig'],
];
const CHINESE_CLASHES = [['Rat','Horse'],['Ox','Goat'],['Tiger','Monkey'],['Rabbit','Rooster'],['Dragon','Dog'],['Snake','Pig']];
const ANIMAL_CHEMISTRY_ES = {
  'Rat':'ingenio rápido', 'Ox':'resistencia paciente', 'Tiger':'coraje magnético', 'Rabbit':'gracia prudente',
  'Dragon':'visión expansiva', 'Snake':'intuición estratégica', 'Horse':'libertad en movimiento', 'Goat':'dulzura artística',
  'Monkey':'juego inteligente', 'Rooster':'orden preciso', 'Dog':'lealtad honesta', 'Pig':'generosidad cálida',
};
const ANIMAL_CHEMISTRY_EN = {
  'Rat':'quick ingenuity', 'Ox':'patient endurance', 'Tiger':'magnetic courage', 'Rabbit':'prudent grace',
  'Dragon':'expansive vision', 'Snake':'strategic intuition', 'Horse':'freedom in motion', 'Goat':'artistic sweetness',
  'Monkey':'intelligent play', 'Rooster':'precise order', 'Dog':'honest loyalty', 'Pig':'warm generosity',
};

function chineseDyn(a, b, lang) {
  const chem = lang === 'en' ? ANIMAL_CHEMISTRY_EN : ANIMAL_CHEMISTRY_ES;
  const tA = chem[a] || '', tB = chem[b] || '';
  for (const trine of CHINESE_TRINES) {
    if (trine.includes(a) && trine.includes(b)) {
      return {
        score: 88,
        text: lang === 'en'
          ? `Allied trine (${a}/${b}): ${tA} meets ${tB} in natural synergy.`
          : `Trino aliado (${a}/${b}): ${tA} se encuentra con ${tB} en sinergia natural.`,
      };
    }
  }
  for (const [c1, c2] of CHINESE_CLASHES) {
    if ((a===c1 && b===c2) || (a===c2 && b===c1)) {
      return {
        score: 35,
        text: lang === 'en'
          ? `Classic clash (${a}/${b}): ${tA} and ${tB} collide — growth through friction.`
          : `Choque clásico (${a}/${b}): ${tA} y ${tB} colisionan — crecimiento por fricción.`,
      };
    }
  }
  return {
    score: 62,
    text: lang === 'en'
      ? `Neutral pairing (${a}/${b}): ${tA} alongside ${tB} — balance you must choose actively.`
      : `Par neutral (${a}/${b}): ${tA} junto a ${tB} — equilibrio que se elige activamente.`,
  };
}

const LIFE_PATH_PAIRS = {
  '1-5': { score: 88, es: 'liderazgo + libertad: aventura sin aburrirse', en: 'leadership + freedom: adventure without boredom' },
  '2-4': { score: 85, es: 'armonía + estructura: construyen hogar firme', en: 'harmony + structure: they build a firm home' },
  '3-6': { score: 85, es: 'expresión + cuidado: creatividad nutrida', en: 'expression + care: creativity nurtured' },
  '1-9': { score: 80, es: 'inicio + cierre: completan ciclos juntos', en: 'beginning + ending: they complete cycles together' },
  '2-8': { score: 78, es: 'diplomacia + poder: alianzas efectivas', en: 'diplomacy + power: effective alliances' },
  '4-8': { score: 82, es: 'disciplina + ambición: imperio a largo plazo', en: 'discipline + ambition: long-term empire' },
  '3-9': { score: 80, es: 'arte + humanismo: impacto emocional amplio', en: 'art + humanism: wide emotional impact' },
  '5-7': { score: 75, es: 'experiencia + análisis: viaje con sentido', en: 'experience + analysis: meaningful journey' },
  '6-9': { score: 85, es: 'servicio + compasión: familia que abraza a otros', en: 'service + compassion: family that embraces others' },
  '7-9': { score: 78, es: 'introspección + visión: búsqueda espiritual compartida', en: 'introspection + vision: shared spiritual search' },
  '1-4': { score: 52, es: 'ego pionero vs orden metódico — ritmos chocan', en: 'pioneering ego vs methodical order — rhythms clash' },
  '1-8': { score: 55, es: 'dos poderes — alianza o duelo', en: 'two powers — alliance or duel' },
  '4-5': { score: 48, es: 'raíz vs viento — tensión de estabilidad', en: 'root vs wind — stability tension' },
  '5-6': { score: 50, es: 'libertad vs responsabilidad — compromiso ambivalente', en: 'freedom vs responsibility — ambivalent commitment' },
  '3-4': { score: 55, es: 'juego vs rigor — necesitan horarios y espontaneidad', en: 'play vs rigor — they need schedules and spontaneity' },
  '2-5': { score: 58, es: 'sensibilidad vs aventura — base vs exploración', en: 'sensitivity vs adventure — base vs exploration' },
};
function lpDyn(a, b, lang) {
  const key = a <= b ? `${a}-${b}` : `${b}-${a}`;
  const hit = LIFE_PATH_PAIRS[key];
  if (hit) return { score: hit.score, text: lang === 'en' ? hit.en : hit.es };
  if (a === b) return { score: 72, text: lang === 'en' ? `Mirror numbers (${a}/${a}): same lesson, doubled intensity.` : `Números espejo (${a}/${a}): misma lección, intensidad doble.` };
  return { score: 65, text: lang === 'en' ? `Numbers ${a} and ${b}: neutral — conscious work defines outcome.` : `Números ${a} y ${b}: neutral — el trabajo consciente define el resultado.` };
}

const MAYAN_TONE_MIX = {
  // groups of Mayan tones (1-13) by energetic function
  foundational: [1, 2, 3, 4],      // intention / challenge / action / form
  expressive: [5, 6, 7],            // empowerment / rhythm / attunement
  transformational: [8, 9, 10, 11], // integrity / intention / manifestation / release
  completion: [12, 13],             // cooperation / presence
};
function mayanToneRelation(t1, t2, lang) {
  if (!t1 || !t2) return null;
  if (t1 === t2) return lang === 'en' ? 'same Mayan tone — doubled galactic signature' : 'mismo tono maya — firma galáctica doblada';
  const groupOf = (t) => {
    if (MAYAN_TONE_MIX.foundational.includes(t)) return 'foundational';
    if (MAYAN_TONE_MIX.expressive.includes(t)) return 'expressive';
    if (MAYAN_TONE_MIX.transformational.includes(t)) return 'transformational';
    return 'completion';
  };
  const g1 = groupOf(t1), g2 = groupOf(t2);
  if (g1 === g2) {
    return lang === 'en'
      ? `both in ${g1} tone phase — synchronized cycles`
      : `ambos en fase ${g1 === 'foundational' ? 'fundacional' : g1 === 'expressive' ? 'expresiva' : g1 === 'transformational' ? 'transformacional' : 'de cierre'} — ciclos sincronizados`;
  }
  return lang === 'en'
    ? `complementary tone phases (${g1} + ${g2}) — each supplies what the other lacks`
    : `fases de tono complementarias — cada uno aporta lo que al otro le falta`;
}

const VEDIC_ELEMENTS = { 'Mesha':'Fire','Vrishabha':'Earth','Mithuna':'Air','Karka':'Water','Simha':'Fire','Kanya':'Earth','Tula':'Air','Vrischika':'Water','Dhanu':'Fire','Makara':'Earth','Kumbha':'Air','Meena':'Water' };

// ───────── Scoring helpers ─────────
function score(a, b, dict, fallback = 60) {
  const k1 = `${a}-${b}`, k2 = `${b}-${a}`;
  return dict[k1] || dict[k2] || fallback;
}

// ───────── Labels ─────────
const L = {
  es: {
    panorama: 'Panorama Energético',
    strengths: 'Fortalezas del Vínculo',
    tensions: 'Tensiones a Navegar',
    growth: 'Camino de Crecimiento',
    ritual: 'Ritual Sugerido',
    western: 'Occidental', chinese: 'Zodiaco Chino', numerology: 'Numerología',
    celtic: 'Celta', mayan: 'Maya', vedic: 'Védico', humanDesign: 'Human Design',
  },
  en: {
    panorama: 'Energetic Overview',
    strengths: 'Relationship Strengths',
    tensions: 'Tensions to Navigate',
    growth: 'Growth Path',
    ritual: 'Suggested Ritual',
    western: 'Western', chinese: 'Chinese Zodiac', numerology: 'Numerology',
    celtic: 'Celtic', mayan: 'Mayan', vedic: 'Vedic', humanDesign: 'Human Design',
  },
};

// Ritual seed: element-driven suggestions
function ritualFor(dominantElement, lang) {
  const R = {
    es: {
      Fire:  'Caminata al amanecer juntos + una conversación honesta sobre qué quieren crear este mes.',
      Earth: 'Cocinar una comida de temporada con ingredientes de raíz y comer sin pantallas.',
      Air:   'Ir a un lugar con horizonte amplio, intercambiar una carta escrita a mano.',
      Water: 'Baño de luna (o ducha larga) + compartir un sueño reciente al despertar al día siguiente.',
    },
    en: {
      Fire:  'Dawn walk together + an honest conversation about what you want to create this month.',
      Earth: 'Cook a seasonal meal with root ingredients and eat without screens.',
      Air:   'Go somewhere with a wide horizon, exchange a handwritten letter.',
      Water: 'Moon bath (or long shower) + share a recent dream the next morning.',
    },
  };
  return R[lang === 'en' ? 'en' : 'es'][dominantElement] || R.es.Fire;
}

// ───────── Main builder ─────────
function buildReport(a, b, lang) {
  const lbl = L[lang === 'en' ? 'en' : 'es'];
  const eA = WESTERN_ELEMENTS[a.western_sign] || 'Fire';
  const eB = WESTERN_ELEMENTS[b.western_sign] || 'Fire';
  const eDyn = elementDyn(eA, eB);
  const modeA = WESTERN_MODE[a.western_sign];
  const modeB = WESTERN_MODE[b.western_sign];

  const cDyn = chineseDyn(a.chinese_animal, b.chinese_animal, lang);
  const lDyn = lpDyn(a.numerology_number, b.numerology_number, lang);

  // Celtic: same tree / different
  const celticSame = a.celtic_tree && b.celtic_tree && a.celtic_tree === b.celtic_tree;
  const celticScore = celticSame ? 92 : 62;
  const celticText = celticSame
    ? (lang === 'en' ? `Same Celtic tree (${a.celtic_tree}) — you arrived into the world under the same lunar forest.` : `Mismo árbol celta (${a.celtic_tree}) — llegaron al mundo bajo el mismo bosque lunar.`)
    : (lang === 'en' ? `Different Celtic trees (${a.celtic_tree} & ${b.celtic_tree}) — complementary seasonal wisdoms.` : `Árboles celtas distintos (${a.celtic_tree} y ${b.celtic_tree}) — sabidurías estacionales complementarias.`);

  // Mayan
  let mayanScore = 60, mayanText = '';
  if (a.mayan_seal && b.mayan_seal) {
    const MAYAN_COLORS = ['Red','White','Blue','Yellow'];
    const sameSeal = a.mayan_seal === b.mayan_seal;
    const colorA = a.mayan_kin ? MAYAN_COLORS[((a.mayan_kin - 1) % 20) % 4] : null;
    const colorB = b.mayan_kin ? MAYAN_COLORS[((b.mayan_kin - 1) % 20) % 4] : null;
    const sameColor = colorA && colorB && colorA === colorB;
    mayanScore = sameSeal ? 94 : sameColor ? 78 : 62;
    const toneRel = mayanToneRelation(a.mayan_tone, b.mayan_tone, lang);
    const base = sameSeal
      ? (lang === 'en' ? `Shared Mayan seal (${a.mayan_seal}) — same archetypal mission.` : `Sello maya compartido (${a.mayan_seal}) — misma misión arquetípica.`)
      : sameColor
        ? (lang === 'en' ? `Different seals but same color family (${colorA}) — same energetic direction.` : `Sellos distintos con misma familia de color (${colorA}) — misma dirección energética.`)
        : (lang === 'en' ? `Contrasting Mayan seals (${a.mayan_seal} / ${b.mayan_seal}) — weave different gifts.` : `Sellos mayas contrastantes (${a.mayan_seal} / ${b.mayan_seal}) — tejen dones diferentes.`);
    mayanText = toneRel ? `${base} ${toneRel}.` : base;
  }

  // Vedic
  let vedicScore = 60, vedicText = '';
  if (a.vedic_rashi && b.vedic_rashi) {
    const sameRashi = a.vedic_rashi === b.vedic_rashi;
    const sameVElement = VEDIC_ELEMENTS[a.vedic_rashi] === VEDIC_ELEMENTS[b.vedic_rashi];
    vedicScore = sameRashi ? 90 : sameVElement ? 78 : 62;
    vedicText = sameRashi
      ? (lang === 'en' ? `Same Vedic rashi (${a.vedic_rashi}) — aligned dharmic field.` : `Mismo rashi védico (${a.vedic_rashi}) — campo dhármico alineado.`)
      : sameVElement
        ? (lang === 'en' ? `Rashis in same element family — compatible dharmic temperature.` : `Rashis en la misma familia elemental — temperatura dhármica compatible.`)
        : (lang === 'en' ? `Distinct rashis (${a.vedic_rashi} / ${b.vedic_rashi}) — you each guide different rooms of the soul.` : `Rashis distintos (${a.vedic_rashi} / ${b.vedic_rashi}) — cada uno guía cuartos distintos del alma.`);
  }

  // Human Design
  let hdScore = 60, hdText = '';
  if (a.human_design_gate && b.human_design_gate) {
    const sameGate = a.human_design_gate === b.human_design_gate;
    const diff = Math.abs(a.human_design_gate - b.human_design_gate);
    hdScore = sameGate ? 92 : diff <= 4 ? 78 : 62;
    hdText = sameGate
      ? (lang === 'en' ? `Identical HD gate (${a.human_design_gate}) — amplified theme.` : `Puerta HD idéntica (${a.human_design_gate}) — tema amplificado.`)
      : diff <= 4
        ? (lang === 'en' ? `HD gates (${a.human_design_gate} & ${b.human_design_gate}) close in frequency — adjacent channels.` : `Puertas HD (${a.human_design_gate} y ${b.human_design_gate}) cercanas en frecuencia — canales adyacentes.`)
        : (lang === 'en' ? `HD gates far apart (${a.human_design_gate} / ${b.human_design_gate}) — diverse circuit types.` : `Puertas HD distantes (${a.human_design_gate} / ${b.human_design_gate}) — tipos de circuito diversos.`);
  }

  const scores = [eDyn.score, cDyn.score, lDyn.score, celticScore, mayanScore, vedicScore, hdScore];
  const overallScore = Math.round(scores.reduce((x,y)=>x+y,0) / scores.length);

  // Dominant element of the pair (count elements across western + vedic)
  const elemCount = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  elemCount[eA]++; elemCount[eB]++;
  if (a.vedic_rashi && VEDIC_ELEMENTS[a.vedic_rashi]) elemCount[VEDIC_ELEMENTS[a.vedic_rashi]]++;
  if (b.vedic_rashi && VEDIC_ELEMENTS[b.vedic_rashi]) elemCount[VEDIC_ELEMENTS[b.vedic_rashi]]++;
  const dominantElement = Object.keys(elemCount).reduce((d, k) => elemCount[k] > elemCount[d] ? k : d, 'Fire');

  // ── Compose narrative sections ──
  const dyn = eDyn[lang === 'en' ? 'en' : 'es'];
  const panorama = lang === 'en'
    ? `${a.nombre} and ${b.nombre} meet at ${overallScore}% cross-cultural resonance across 7 systems. The ${eA}/${eB} meeting reads as ${dyn.gift}. Dominant element of the pair: ${dominantElement}.`
    : `${a.nombre} y ${b.nombre} se encuentran al ${overallScore}% de resonancia cross-cultural en 7 sistemas. El encuentro ${eA}/${eB} se lee como ${dyn.gift}. Elemento dominante de la pareja: ${translateElement(dominantElement, lang)}.`;

  const strengths = [];
  if (eDyn.score >= 75) strengths.push(dyn.gift);
  if (cDyn.score >= 75) strengths.push(cDyn.text);
  if (lDyn.score >= 75) strengths.push(lDyn.text);
  if (celticSame) strengths.push(celticText);
  if (mayanScore >= 78) strengths.push(mayanText);
  if (vedicScore >= 78) strengths.push(vedicText);
  if (hdScore >= 78) strengths.push(hdText);
  if (strengths.length === 0) strengths.push(lang === 'en' ? 'Subtle strengths: conscious alchemy is required to reveal them.' : 'Fortalezas sutiles: la alquimia consciente las revela.');

  const tensions = [];
  if (eDyn.score < 60) tensions.push(dyn.risk);
  if (cDyn.score < 55) tensions.push(cDyn.text);
  if (lDyn.score < 60) tensions.push(lDyn.text);
  if (modeA && modeB && modeA === 'cardinal' && modeB === 'cardinal') {
    tensions.push(lang === 'en' ? 'Both cardinal modes: two initiators — agree who leads which domain.' : 'Ambos en modo cardinal: dos iniciadores — acuerden quién lidera qué dominio.');
  }
  if (modeA && modeB && modeA === 'fixed' && modeB === 'fixed') {
    tensions.push(lang === 'en' ? 'Both fixed: stubbornness in opposite directions is the #1 risk.' : 'Ambos fijos: la terquedad en direcciones opuestas es el riesgo #1.');
  }
  if (tensions.length === 0) tensions.push(lang === 'en' ? 'No obvious structural tensions — the risk is complacency and loss of edge.' : 'Sin tensiones estructurales obvias — el riesgo es la complacencia y perder el filo.');

  // Growth from dominant element
  const growthByElement = {
    Fire:  { es: 'Diseñen un proyecto con fecha y victoria visible a 90 días — el fuego compartido necesita un blanco.', en: 'Design a project with a deadline and visible win at 90 days — shared fire needs a target.' },
    Earth: { es: 'Agenden una ruptura deliberada de rutina cada mes — un viaje corto, un restaurante nuevo, una cama distinta.', en: 'Schedule a deliberate routine-break each month — a short trip, a new restaurant, a different bed.' },
    Air:   { es: 'Traduzcan al menos una idea en acción corporal cada semana — el pensamiento debe aterrizar.', en: 'Translate at least one idea into bodily action each week — thought must land.' },
    Water: { es: 'Establezcan un ritual de cierre diario (3 min) para no absorberse mutuamente sin darse cuenta.', en: 'Set a 3-minute daily closing ritual so you don\'t absorb each other unnoticed.' },
  };
  const growth = growthByElement[dominantElement][lang === 'en' ? 'en' : 'es'];

  const ritual = ritualFor(dominantElement, lang);

  return {
    profileA: { name: a.nombre, birthDate: a.fecha_nacimiento },
    profileB: { name: b.nombre, birthDate: b.fecha_nacimiento },
    overallScore,
    dominantElement,
    sections: {
      panorama: { title: lbl.panorama, text: panorama },
      strengths: { title: lbl.strengths, items: strengths },
      tensions: { title: lbl.tensions, items: tensions },
      growth: { title: lbl.growth, text: growth },
      ritual: { title: lbl.ritual, text: ritual },
    },
    breakdown: {
      western:     { label: lbl.western,      score: eDyn.score,    signA: a.western_sign, signB: b.western_sign, elementA: eA, elementB: eB },
      chinese:     { label: lbl.chinese,      score: cDyn.score,    animalA: a.chinese_animal, animalB: b.chinese_animal, note: cDyn.text },
      numerology:  { label: lbl.numerology,   score: lDyn.score,    numberA: a.numerology_number, numberB: b.numerology_number, note: lDyn.text },
      celtic:      { label: lbl.celtic,       score: celticScore,   treeA: a.celtic_tree, treeB: b.celtic_tree, note: celticText },
      mayan:       { label: lbl.mayan,        score: mayanScore,    sealA: a.mayan_seal, sealB: b.mayan_seal, kinA: a.mayan_kin, kinB: b.mayan_kin, note: mayanText },
      vedic:       { label: lbl.vedic,        score: vedicScore,    rashiA: a.vedic_rashi, rashiB: b.vedic_rashi, note: vedicText },
      humanDesign: { label: lbl.humanDesign,  score: hdScore,       gateA: a.human_design_gate, gateB: b.human_design_gate, note: hdText },
    },
    generatedAt: new Date().toISOString(),
    version: 'v2',
  };
}

function translateElement(el, lang) {
  if (lang === 'en') return el;
  return { Fire: 'Fuego', Earth: 'Tierra', Air: 'Aire', Water: 'Agua' }[el] || el;
}

// ───────── Handler ─────────
export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  if (user.tier === 'free') {
    return Response.json({
      ok: false,
      error: 'Premium subscription required for compatibility reports',
      upgrade: true,
    }, { status: 403 });
  }

  const url = new URL(context.request.url);
  const profileAId = url.searchParams.get('profile_a');
  const profileBId = url.searchParams.get('profile_b');
  const lang = (url.searchParams.get('lang') || 'es').toLowerCase();
  const { DB } = context.env;

  if (!profileAId || !profileBId) {
    return Response.json({ ok: false, error: 'Two profile IDs required' }, { status: 400 });
  }

  const profileA = await DB.prepare(
    'SELECT * FROM birth_profiles WHERE id = ? AND user_id = ?'
  ).bind(profileAId, user.sub).first();

  const profileB = await DB.prepare(
    'SELECT * FROM birth_profiles WHERE id = ? AND user_id = ?'
  ).bind(profileBId, user.sub).first();

  if (!profileA || !profileB) {
    return Response.json({ ok: false, error: 'Profile(s) not found' }, { status: 404 });
  }

  const report = buildReport(profileA, profileB, lang);
  return Response.json({ ok: true, report });
}
