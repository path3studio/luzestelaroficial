/**
 * GET /api/reports/unified?profile_id=xxx — Cross-cultural unified report
 *
 * Plus only. Combines Western, Chinese, Numerology, Celtic, Mayan, Vedic,
 * Human Design and Enneagram into a personalized, multi-section narrative.
 * Cached per profile in D1 for 7 days.
 */

// ─── Reference tables (bilingual) ──────────────────────────────────

const WESTERN = {
  Aries:       { es: 'Aries',       en: 'Aries',       element: 'Fire',   mode: 'Cardinal', ruler: 'Marte/Mars',     shadow_es: 'impaciencia', shadow_en: 'impatience',  gift_es: 'iniciativa pura', gift_en: 'pure initiative' },
  Taurus:      { es: 'Tauro',       en: 'Taurus',      element: 'Earth',  mode: 'Fixed',    ruler: 'Venus',          shadow_es: 'terquedad',   shadow_en: 'stubbornness',gift_es: 'constancia sensorial', gift_en: 'grounded constancy' },
  Gemini:      { es: 'Géminis',     en: 'Gemini',      element: 'Air',    mode: 'Mutable',  ruler: 'Mercurio/Mercury',shadow_es: 'dispersión', shadow_en: 'scatter',     gift_es: 'curiosidad multiplicadora', gift_en: 'multiplying curiosity' },
  Cancer:      { es: 'Cáncer',      en: 'Cancer',      element: 'Water',  mode: 'Cardinal', ruler: 'Luna/Moon',      shadow_es: 'apego',       shadow_en: 'clinging',    gift_es: 'memoria emocional', gift_en: 'emotional memory' },
  Leo:         { es: 'Leo',         en: 'Leo',         element: 'Fire',   mode: 'Fixed',    ruler: 'Sol/Sun',        shadow_es: 'orgullo',     shadow_en: 'pride',       gift_es: 'generosidad radiante', gift_en: 'radiant generosity' },
  Virgo:       { es: 'Virgo',       en: 'Virgo',       element: 'Earth',  mode: 'Mutable',  ruler: 'Mercurio/Mercury',shadow_es: 'autocrítica', shadow_en: 'self-criticism', gift_es: 'servicio preciso', gift_en: 'precise service' },
  Libra:       { es: 'Libra',       en: 'Libra',       element: 'Air',    mode: 'Cardinal', ruler: 'Venus',          shadow_es: 'indecisión',  shadow_en: 'indecision',  gift_es: 'justicia relacional', gift_en: 'relational fairness' },
  Scorpio:     { es: 'Escorpio',    en: 'Scorpio',     element: 'Water',  mode: 'Fixed',    ruler: 'Plutón/Pluto',   shadow_es: 'control',     shadow_en: 'control',     gift_es: 'transformación profunda', gift_en: 'deep transformation' },
  Sagittarius: { es: 'Sagitario',   en: 'Sagittarius', element: 'Fire',   mode: 'Mutable',  ruler: 'Júpiter/Jupiter',shadow_es: 'exceso',      shadow_en: 'excess',      gift_es: 'visión expansiva', gift_en: 'expansive vision' },
  Capricorn:   { es: 'Capricornio', en: 'Capricorn',   element: 'Earth',  mode: 'Cardinal', ruler: 'Saturno/Saturn', shadow_es: 'rigidez',     shadow_en: 'rigidity',    gift_es: 'arquitectura a largo plazo', gift_en: 'long-horizon architecture' },
  Aquarius:    { es: 'Acuario',     en: 'Aquarius',    element: 'Air',    mode: 'Fixed',    ruler: 'Urano/Uranus',   shadow_es: 'desapego frío', shadow_en: 'cold detachment', gift_es: 'originalidad colectiva', gift_en: 'collective originality' },
  Pisces:      { es: 'Piscis',      en: 'Pisces',      element: 'Water',  mode: 'Mutable',  ruler: 'Neptuno/Neptune',shadow_es: 'evasión',     shadow_en: 'escapism',    gift_es: 'compasión sin fronteras', gift_en: 'boundaryless compassion' },
};

const CHINESE_ANIMALS = {
  Rat:     { es: 'Rata',      theme_es: 'astucia y oportunidad', theme_en: 'wit and opportunity', verb_es: 'detectas', verb_en: 'detect' },
  Ox:      { es: 'Buey',      theme_es: 'paciencia y construcción', theme_en: 'patience and construction', verb_es: 'sostienes', verb_en: 'sustain' },
  Tiger:   { es: 'Tigre',     theme_es: 'coraje y presencia', theme_en: 'courage and presence', verb_es: 'irrumpes', verb_en: 'break through' },
  Rabbit:  { es: 'Conejo',    theme_es: 'sensibilidad y elegancia', theme_en: 'sensitivity and grace', verb_es: 'matizas', verb_en: 'attune' },
  Dragon:  { es: 'Dragón',    theme_es: 'poder visionario', theme_en: 'visionary power', verb_es: 'manifiestas', verb_en: 'manifest' },
  Snake:   { es: 'Serpiente', theme_es: 'sabiduría silenciosa', theme_en: 'silent wisdom', verb_es: 'discierne', verb_en: 'discern' },
  Horse:   { es: 'Caballo',   theme_es: 'libertad e impulso', theme_en: 'freedom and momentum', verb_es: 'galopa', verb_en: 'gallop' },
  Goat:    { es: 'Cabra',     theme_es: 'gentileza creativa', theme_en: 'creative gentleness', verb_es: 'compones', verb_en: 'compose' },
  Monkey:  { es: 'Mono',      theme_es: 'ingenio y juego', theme_en: 'wit and play', verb_es: 'improvisas', verb_en: 'improvise' },
  Rooster: { es: 'Gallo',     theme_es: 'precisión y orgullo', theme_en: 'precision and pride', verb_es: 'afinas', verb_en: 'refine' },
  Dog:     { es: 'Perro',     theme_es: 'lealtad y justicia', theme_en: 'loyalty and justice', verb_es: 'defiendes', verb_en: 'defend' },
  Pig:     { es: 'Cerdo',     theme_es: 'generosidad y goce', theme_en: 'generosity and pleasure', verb_es: 'celebras', verb_en: 'celebrate' },
};

const CHINESE_ELEMENTS_CYCLE = ['Metal','Water','Wood','Fire','Earth'];

const LIFE_PATH = {
  1:  { es: 'Liderazgo e iniciativa',     en: 'Leadership & Initiative',    task_es: 'abrir camino donde no lo hay', task_en: 'open paths where none exist' },
  2:  { es: 'Cooperación y sensibilidad', en: 'Cooperation & Sensitivity',  task_es: 'tejer vínculos con tacto', task_en: 'weave bonds with tact' },
  3:  { es: 'Expresión y creatividad',    en: 'Expression & Creativity',    task_es: 'darle voz a lo que otros sienten', task_en: 'give voice to what others feel' },
  4:  { es: 'Estructura y disciplina',    en: 'Structure & Discipline',     task_es: 'construir bases que duren', task_en: 'build foundations that last' },
  5:  { es: 'Libertad y aventura',        en: 'Freedom & Adventure',        task_es: 'experimentar para aprender', task_en: 'experiment to learn' },
  6:  { es: 'Cuidado y responsabilidad',  en: 'Nurturing & Responsibility', task_es: 'cuidar lo que amas sin disolverte', task_en: 'care for what you love without dissolving' },
  7:  { es: 'Análisis e introspección',   en: 'Analysis & Introspection',   task_es: 'buscar verdad bajo la superficie', task_en: 'seek truth beneath the surface' },
  8:  { es: 'Poder y logro material',     en: 'Power & Material Mastery',   task_es: 'usar el poder al servicio de algo mayor', task_en: 'wield power in service of something larger' },
  9:  { es: 'Humanitarismo y sabiduría',  en: 'Humanitarianism & Wisdom',   task_es: 'cerrar ciclos con compasión', task_en: 'close cycles with compassion' },
  11: { es: 'Intuición maestra',          en: 'Master Intuition',           task_es: 'traducir lo invisible en acción', task_en: 'translate the invisible into action' },
  22: { es: 'Constructor maestro',        en: 'Master Builder',             task_es: 'materializar una visión ambiciosa', task_en: 'materialize an ambitious vision' },
  33: { es: 'Maestro espiritual',         en: 'Master Teacher',             task_es: 'enseñar con el ejemplo amoroso', task_en: 'teach through loving example' },
};

const CELTIC = {
  Birch:    { es: 'Abedul',   theme_es: 'nuevos comienzos y limpieza', theme_en: 'new beginnings and clearing' },
  Rowan:    { es: 'Serbal',   theme_es: 'protección y visión interior', theme_en: 'protection and inner sight' },
  Ash:      { es: 'Fresno',   theme_es: 'conexión entre mundos', theme_en: 'connection between worlds' },
  Alder:    { es: 'Aliso',    theme_es: 'fundamento y guía espiritual', theme_en: 'foundation and spiritual guidance' },
  Willow:   { es: 'Sauce',    theme_es: 'intuición lunar y memoria', theme_en: 'lunar intuition and memory' },
  Hawthorn: { es: 'Espino',   theme_es: 'paciencia y belleza oculta', theme_en: 'patience and hidden beauty' },
  Oak:      { es: 'Roble',    theme_es: 'fuerza longeva y generosidad', theme_en: 'enduring strength and generosity' },
  Holly:    { es: 'Acebo',    theme_es: 'desafío y dignidad', theme_en: 'challenge and dignity' },
  Hazel:    { es: 'Avellano', theme_es: 'sabiduría e inspiración', theme_en: 'wisdom and inspiration' },
  Vine:     { es: 'Vid',      theme_es: 'profecía y celebración', theme_en: 'prophecy and celebration' },
  Ivy:      { es: 'Hiedra',   theme_es: 'tenacidad y transformación', theme_en: 'tenacity and transformation' },
  Reed:     { es: 'Caña',     theme_es: 'armonía y crecimiento', theme_en: 'harmony and growth' },
  Elder:    { es: 'Saúco',    theme_es: 'transición y renovación', theme_en: 'transition and renewal' },
};

// Mayan seals — using English keys that match profile.mayan_seal storage
const MAYAN = {
  'Red Dragon':        { es: 'Dragón Rojo',        theme_es: 'origen y nutrición', theme_en: 'origin and nourishment' },
  'White Wind':        { es: 'Viento Blanco',      theme_es: 'comunicación del espíritu', theme_en: 'spirit communication' },
  'Blue Night':        { es: 'Noche Azul',         theme_es: 'sueños y abundancia', theme_en: 'dreams and abundance' },
  'Yellow Seed':       { es: 'Semilla Amarilla',   theme_es: 'florecimiento y potencial', theme_en: 'flowering and potential' },
  'Red Serpent':       { es: 'Serpiente Roja',     theme_es: 'fuerza vital y supervivencia', theme_en: 'life force and survival' },
  'White Worldbridger':{ es: 'Enlazador Blanco',   theme_es: 'igualdad y muerte simbólica', theme_en: 'equality and symbolic death' },
  'Blue Hand':         { es: 'Mano Azul',          theme_es: 'sanación y realización', theme_en: 'healing and accomplishment' },
  'Yellow Star':       { es: 'Estrella Amarilla',  theme_es: 'elegancia y arte', theme_en: 'elegance and art' },
  'Red Moon':          { es: 'Luna Roja',          theme_es: 'flujo universal y purificación', theme_en: 'universal flow and purification' },
  'White Dog':         { es: 'Perro Blanco',       theme_es: 'amor leal y guía', theme_en: 'loyal love and guidance' },
  'Blue Monkey':       { es: 'Mono Azul',          theme_es: 'magia y juego divino', theme_en: 'magic and divine play' },
  'Yellow Human':      { es: 'Humano Amarillo',    theme_es: 'libre albedrío y sabiduría', theme_en: 'free will and wisdom' },
  'Red Skywalker':     { es: 'Caminante Rojo',     theme_es: 'exploración y profecía', theme_en: 'exploration and prophecy' },
  'White Wizard':      { es: 'Mago Blanco',        theme_es: 'atemporalidad y receptividad', theme_en: 'timelessness and receptivity' },
  'Blue Eagle':        { es: 'Águila Azul',        theme_es: 'visión y creación', theme_en: 'vision and creation' },
  'Yellow Warrior':    { es: 'Guerrero Amarillo',  theme_es: 'inteligencia intrépida', theme_en: 'fearless intelligence' },
  'Red Earth':         { es: 'Tierra Roja',        theme_es: 'sincronicidad y navegación', theme_en: 'synchronicity and navigation' },
  'White Mirror':      { es: 'Espejo Blanco',      theme_es: 'reflexión y orden', theme_en: 'reflection and order' },
  'Blue Storm':        { es: 'Tormenta Azul',      theme_es: 'catálisis y auto-generación', theme_en: 'catalysis and self-generation' },
  'Yellow Sun':        { es: 'Sol Amarillo',       theme_es: 'iluminación y vida plena', theme_en: 'enlightenment and full life' },
};

const VEDIC = {
  Mesha:     { es: 'Mesha (Aries)',     dharma_es: 'iniciar con valentía', dharma_en: 'initiate with courage' },
  Vrishabha: { es: 'Vrishabha (Tauro)', dharma_es: 'sostener la belleza', dharma_en: 'sustain beauty' },
  Mithuna:   { es: 'Mithuna (Géminis)', dharma_es: 'comunicar ideas vivas', dharma_en: 'transmit living ideas' },
  Karka:     { es: 'Karka (Cáncer)',    dharma_es: 'cuidar el linaje', dharma_en: 'nurture the lineage' },
  Simha:     { es: 'Simha (Leo)',       dharma_es: 'reinar con nobleza', dharma_en: 'rule with nobility' },
  Kanya:     { es: 'Kanya (Virgo)',     dharma_es: 'servir con precisión', dharma_en: 'serve with precision' },
  Tula:      { es: 'Tula (Libra)',      dharma_es: 'equilibrar fuerzas', dharma_en: 'balance forces' },
  Vrishchika:{ es: 'Vrishchika (Escorpio)', dharma_es: 'transformar sombras', dharma_en: 'transform shadows' },
  Dhanu:     { es: 'Dhanu (Sagitario)', dharma_es: 'buscar verdad filosófica', dharma_en: 'seek philosophical truth' },
  Makara:    { es: 'Makara (Capricornio)', dharma_es: 'cristalizar estructura', dharma_en: 'crystallize structure' },
  Kumbha:    { es: 'Kumbha (Acuario)',  dharma_es: 'liberar el futuro colectivo', dharma_en: 'free the collective future' },
  Meena:     { es: 'Meena (Piscis)',    dharma_es: 'disolverse en lo universal', dharma_en: 'dissolve into the universal' },
};

// Human Design — 64 gates with short, evocative theme fragments
const HD_GATES_BRIEF = {
  1: 'creatividad radical', 2: 'dirección del yo', 3: 'orden en el caos', 4: 'fórmula juvenil',
  5: 'ritmo fijo', 6: 'conflicto íntimo', 7: 'rol del líder', 8: 'contribución',
  9: 'enfoque del detalle', 10: 'comportamiento del yo', 11: 'ideas', 12: 'precaución',
  13: 'escucha del oyente', 14: 'posesión creativa', 15: 'extremos', 16: 'habilidades',
  17: 'opinión', 18: 'corrección', 19: 'acercamiento', 20: 'presente',
  21: 'control', 22: 'gracia', 23: 'asimilación', 24: 'racionalización',
  25: 'espíritu del yo', 26: 'mercader egoísta', 27: 'responsabilidad', 28: 'luchador',
  29: 'perseverancia', 30: 'sentimientos', 31: 'influencia', 32: 'continuidad',
  33: 'retirada', 34: 'poder', 35: 'cambio', 36: 'crisis',
  37: 'amistad', 38: 'oposición', 39: 'provocación', 40: 'soledad',
  41: 'fantasía', 42: 'crecimiento', 43: 'introspección', 44: 'alerta',
  45: 'reunión', 46: 'amor al cuerpo', 47: 'realización', 48: 'profundidad',
  49: 'principios', 50: 'valores', 51: 'choque', 52: 'quietud',
  53: 'comienzos', 54: 'ambición', 55: 'espíritu', 56: 'estímulo',
  57: 'intuición clara', 58: 'vitalidad', 59: 'sexualidad', 60: 'aceptación',
  61: 'misterio interior', 62: 'detalle', 63: 'duda', 64: 'confusión',
};

const ENNEAGRAM = {
  1: { es: 'El Reformador',     en: 'The Reformer',     task_es: 'perfeccionar sin condenar',  task_en: 'perfect without condemning' },
  2: { es: 'El Ayudador',       en: 'The Helper',       task_es: 'amar sin perderte',         task_en: 'love without losing yourself' },
  3: { es: 'El Triunfador',     en: 'The Achiever',     task_es: 'lograr desde autenticidad',  task_en: 'achieve from authenticity' },
  4: { es: 'El Individualista', en: 'The Individualist',task_es: 'crear desde la diferencia',  task_en: 'create from difference' },
  5: { es: 'El Investigador',   en: 'The Investigator', task_es: 'compartir lo que sabes',     task_en: 'share what you know' },
  6: { es: 'El Leal',           en: 'The Loyalist',     task_es: 'confiar en tu propia autoridad', task_en: 'trust your own authority' },
  7: { es: 'El Entusiasta',     en: 'The Enthusiast',   task_es: 'profundizar una sola vía',   task_en: 'deepen a single path' },
  8: { es: 'El Desafiador',     en: 'The Challenger',   task_es: 'proteger con ternura',       task_en: 'protect with tenderness' },
  9: { es: 'El Pacificador',    en: 'The Peacemaker',   task_es: 'hacerte presente',           task_en: 'make yourself present' },
};

// ─── Helpers ────────────────────────────────────────────────────────

function chineseElementFromYear(year) {
  // Five-element cycle: ((year - 1924) % 10) / 2 → index into Metal-Water-Wood-Fire-Earth
  return CHINESE_ELEMENTS_CYCLE[Math.floor(((year - 1924) % 10 + 10) % 10 / 2)];
}

function get(obj, key, fallback) {
  if (obj && obj[key] != null) return obj[key];
  return fallback;
}

// Cache + report version. Module-scoped so both the route handler
// (for cache_key) and buildReport (for the version field in the
// returned payload) reference the SAME value. Previously declared
// inside onRequestGet as a local const, which caused a
// ReferenceError in buildReport and a 500 response on every call.
// Bump this when the narrative structure changes to invalidate old
// cached rows (they remain in D1 but with a different cache_key so
// they're ignored; they age out after 7 days anyway).
const VERSION = 'v3'; // v3 (2026-07-08): + weeklyFocus — sección semanal dinámica

// ── "Esta semana para ti" (2026-07-08) ──────────────────────────────────────
// El reporte era 100% determinista de la carta → idéntico PARA SIEMPRE (fuga
// #2 del audit del trial: el suscriptor lo abría el día 1 y el día 30 y era
// el mismo texto). Esta sección cruza los eventos REALES de la semana
// (ingresos de signo + lunaciones, computados con la efemeris de la casa)
// con el signo solar del perfil (casas solares) → se renueva sola cada
// semana. El cacheKey lleva el sello de semana para refrescar.
import { computePositions } from '../../_shared/ephemeris.js';

const SIGNS_EN_ORDER = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const SIGNS_ES_ORDER = ['Aries','Tauro','Géminis','Cáncer','Leo','Virgo',
  'Libra','Escorpio','Sagitario','Capricornio','Acuario','Piscis'];
const PLANET_NAME = {
  es: { Sun: 'el Sol', Mercury: 'Mercurio', Venus: 'Venus', Mars: 'Marte',
        Jupiter: 'Júpiter', Saturn: 'Saturno' },
  en: { Sun: 'the Sun', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars',
        Jupiter: 'Jupiter', Saturn: 'Saturn' },
};
const DAY_NAME = {
  es: ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'],
  en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
};
const HOUSE_THEME = {
  es: ['tu identidad y tu cuerpo','tus recursos y lo que vales',
       'tu palabra y tus vínculos cercanos','tu hogar y tus raíces',
       'tu creatividad y tu gozo','tus rutinas y tu salud',
       'tus relaciones de a dos','lo compartido y lo profundo',
       'tus horizontes y aprendizajes','tu vocación y lo visible',
       'tus redes y amistades','tu descanso y tu mundo interior'],
  en: ['your identity and body','your resources and worth',
       'your voice and close bonds','your home and roots',
       'your creativity and joy','your routines and health',
       'your one-to-one relationships','the shared and the deep',
       'your horizons and learning','your vocation and visibility',
       'your networks and friendships','your rest and inner world'],
};

function upcomingWeekEvents(now) {
  const DAY = 86400000;
  const events = [];
  let prev = computePositions(new Date(now.getTime() + DAY));
  for (let i = 2; i <= 8; i++) {
    const t = new Date(now.getTime() + i * DAY);
    const cur = computePositions(t);
    for (const p of ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
      if (Math.floor(cur[p] / 30) !== Math.floor(prev[p] / 30)) {
        events.push({ t, kind: 'ingress', planet: p, signIdx: Math.floor(cur[p] / 30) });
      }
    }
    const e0 = (prev.Moon - prev.Sun + 360) % 360;
    const e1 = (cur.Moon - cur.Sun + 360) % 360;
    if (e0 > 340 && e1 < 20) events.push({ t, kind: 'newmoon', signIdx: Math.floor(cur.Moon / 30) });
    if (e0 < 180 && e1 >= 180) events.push({ t, kind: 'fullmoon', signIdx: Math.floor(cur.Moon / 30) });
    prev = cur;
  }
  // prioridad: lunaciones primero, luego ingresos por planeta personal
  const rank = { fullmoon: 0, newmoon: 1, ingress: 2 };
  events.sort((a, b) => (rank[a.kind] - rank[b.kind]) || (a.t - b.t));
  return events;
}

function buildWeeklyFocus(westernSignEn, lang) {
  const isES = lang === 'es';
  const sunIdx = SIGNS_EN_ORDER.indexOf(westernSignEn);
  if (sunIdx < 0) return null;
  const SIGN = isES ? SIGNS_ES_ORDER : SIGNS_EN_ORDER;
  const events = upcomingWeekEvents(new Date());
  if (!events.length) {
    return isES
      ? 'Semana de cielo tranquilo, sin eventos mayores: buen momento para consolidar lo que ya está en marcha y escuchar tu propio ritmo.'
      : 'A quiet sky this week, with no major events: a good moment to consolidate what is already moving and listen to your own rhythm.';
  }
  const fmt = (ev) => {
    const dia = `${DAY_NAME[lang][ev.t.getUTCDay()]} ${ev.t.getUTCDate()}`;
    const house = ((ev.signIdx - sunIdx + 12) % 12);
    const theme = HOUSE_THEME[lang][house];
    if (ev.kind === 'fullmoon') {
      return isES
        ? `La Luna llena del ${dia} en ${SIGN[ev.signIdx]} ilumina ${theme}: algo que venías gestando pide su culminación`
        : `The full moon on ${dia} in ${SIGN[ev.signIdx]} lights up ${theme}: something you have been growing asks for its culmination`;
    }
    if (ev.kind === 'newmoon') {
      return isES
        ? `La Luna nueva del ${dia} en ${SIGN[ev.signIdx]} abre un ciclo en ${theme}: siembra ahí una intención pequeña y concreta`
        : `The new moon on ${dia} in ${SIGN[ev.signIdx]} opens a cycle in ${theme}: plant one small, concrete intention there`;
    }
    return isES
      ? `${PLANET_NAME.es[ev.planet].charAt(0).toUpperCase() + PLANET_NAME.es[ev.planet].slice(1)} entra en ${SIGN[ev.signIdx]} el ${dia} y toca ${theme}`
      : `${PLANET_NAME.en[ev.planet].charAt(0).toUpperCase() + PLANET_NAME.en[ev.planet].slice(1)} enters ${SIGN[ev.signIdx]} on ${dia}, touching ${theme}`;
  };
  const main = fmt(events[0]);
  const second = events[1] ? fmt(events[1]) : null;
  const cierre = isES
    ? 'Vuelve a esta sección cada semana: cambia con el cielo.'
    : 'Come back to this section each week: it changes with the sky.';
  return second ? `${main}. ${second}. ${cierre}` : `${main}. ${cierre}`;
}

function _weekStamp() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const week = Math.floor((now - start) / (7 * 86400000));
  return `${now.getUTCFullYear()}w${week}`;
}

// ─── Route ──────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  // Plus gate
  if (user.tier === 'free') {
    return Response.json({
      ok: false,
      error: 'Plus subscription required for full reports',
      upgrade: true,
    }, { status: 403 });
  }

  const url = new URL(context.request.url);
  const profileId = url.searchParams.get('profile_id');
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es';
  const { DB } = context.env;

  // Get birth profile
  let profile;
  if (profileId) {
    profile = await DB.prepare(
      'SELECT * FROM birth_profiles WHERE id = ? AND user_id = ?'
    ).bind(profileId, user.sub).first();
  } else {
    profile = await DB.prepare(
      'SELECT * FROM birth_profiles WHERE user_id = ? AND is_primary = 1'
    ).bind(user.sub).first();
  }
  if (!profile) {
    return Response.json({ ok: false, error: 'Birth profile not found' }, { status: 404 });
  }

  // Cache (VERSION is module-scoped above — keyed so a prompt bump
  // invalidates old rows via a different cache_key).
  // 2026-07-08: sello de semana en la key → la sección semanal se refresca
  // sola cada semana (antes el cache de 7 días + reporte determinista =
  // texto idéntico para siempre).
  const cacheKey = `unified_${VERSION}_${_weekStamp()}_${profile.id}_${lang}`;
  const cached = await DB.prepare(
    'SELECT report_json FROM cached_reports WHERE cache_key = ? AND created_at > datetime("now", "-7 days")'
  ).bind(cacheKey).first();
  if (cached) {
    try {
      return Response.json({ ok: true, report: JSON.parse(cached.report_json), cached: true });
    } catch (e) { /* fall through to regenerate */ }
  }

  // Compose the report
  const report = buildReport(profile, lang);

  // Persist to cache (best-effort)
  try {
    await DB.prepare(
      'INSERT OR REPLACE INTO cached_reports (id, user_id, birth_profile_id, cache_key, report_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), user.sub, profile.id, cacheKey, JSON.stringify(report), new Date().toISOString()).run();
  } catch (e) {
    console.warn('unified cache write failed:', e);
  }

  return Response.json({ ok: true, report });
}

// ─── The actual narrative generator ────────────────────────────────

function buildReport(profile, lang) {
  const isES = lang === 'es';
  const birthYear = parseInt((profile.fecha_nacimiento || '').split('-')[0], 10);
  const w = WESTERN[profile.western_sign] || WESTERN.Capricorn;
  const c = CHINESE_ANIMALS[profile.chinese_animal] || CHINESE_ANIMALS.Dragon;
  const cElement = chineseElementFromYear(birthYear);
  const lp = LIFE_PATH[profile.numerology_number] || LIFE_PATH[9];
  const celt = CELTIC[profile.celtic_tree] || CELTIC.Oak;
  const maya = MAYAN[profile.mayan_seal] || null;
  const vedic = VEDIC[profile.vedic_rashi] || null;
  const hdGate = profile.human_design_gate;
  const hdBrief = hdGate && HD_GATES_BRIEF[hdGate] ? HD_GATES_BRIEF[hdGate] : null;
  const enn = profile.enneagram_type && ENNEAGRAM[profile.enneagram_type] ? ENNEAGRAM[profile.enneagram_type] : null;

  // ── Elemental balance ──
  const elemCount = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  if (w.element && elemCount[w.element] !== undefined) elemCount[w.element] += 2;
  if (cElement === 'Fire')      elemCount.Fire += 1.5;
  else if (cElement === 'Water') elemCount.Water += 1.5;
  else if (cElement === 'Earth') elemCount.Earth += 1.5;
  else if (cElement === 'Wood')  { elemCount.Air += 0.75; elemCount.Earth += 0.75; }
  else if (cElement === 'Metal') { elemCount.Air += 0.75; elemCount.Earth += 0.75; }
  const elemSorted = Object.entries(elemCount).sort((a, b) => b[1] - a[1]);
  const dominantElem = elemSorted[0][0];
  const missingElem = elemSorted[3][1] === 0 ? elemSorted[3][0] : null;

  const elemLabels = isES
    ? { Fire: 'fuego', Earth: 'tierra', Air: 'aire', Water: 'agua' }
    : { Fire: 'fire', Earth: 'earth', Air: 'air', Water: 'water' };

  // ── Section 1: Core Identity ──
  const signName = isES ? w.es : w.en;
  const animalName = isES ? c.es : profile.chinese_animal;
  const celtName = isES ? celt.es : profile.celtic_tree;
  const shadow = isES ? w.shadow_es : w.shadow_en;
  const gift   = isES ? w.gift_es   : w.gift_en;
  const animTheme = isES ? c.theme_es : c.theme_en;
  const lpName = isES ? lp.es : lp.en;
  const lpTask = isES ? lp.task_es : lp.task_en;

  const coreIdentity = isES
    ? `Eres ${signName} (${w.element === 'Fire' ? 'fuego' : w.element === 'Earth' ? 'tierra' : w.element === 'Air' ? 'aire' : 'agua'} ${w.mode.toLowerCase()}, regido por ${w.ruler}): tu don natural es la ${gift}, y tu trampa recurrente es la ${shadow}. Sobre esa base solar se apoya el ${animalName} chino, que te conecta con ${animTheme} en un año de elemento ${cElement === 'Fire' ? 'fuego' : cElement === 'Water' ? 'agua' : cElement === 'Earth' ? 'tierra' : cElement === 'Wood' ? 'madera' : 'metal'}. Tu Número de Vida ${profile.numerology_number} apunta a ${lpName}: la misión pragmática es ${lpTask}. No eres un solo arquetipo — eres ese cruce específico, y ahí está tu firma.`
    : `You are ${signName} (${w.element.toLowerCase()} ${w.mode.toLowerCase()}, ruled by ${w.ruler}): your natural gift is ${gift}, and your recurring trap is ${shadow}. On top of that solar foundation sits the Chinese ${animalName}, which connects you to ${animTheme} in a ${cElement.toLowerCase()}-element year. Your Life Path ${profile.numerology_number} points to ${lpName}: the pragmatic task is to ${lpTask}. You are not any one archetype — you are this specific crossing, and that is your signature.`;

  // ── Section 2: Elemental Balance ──
  const domLabel = elemLabels[dominantElem];
  const missLabel = missingElem ? elemLabels[missingElem] : null;
  const balanceGuidance = {
    Fire:  isES ? 'canaliza ese fuego en un proyecto concreto antes de que se vuelva impaciencia' : 'channel that fire into one concrete project before it turns into impatience',
    Earth: isES ? 'aprovecha esa tierra para planes largos, pero deja espacio a lo imprevisto' : 'leverage that earth for long plans, but leave room for the unforeseen',
    Air:   isES ? 'tu aire abundante te ayuda a pensar — tradúcelo en palabras y decisiones, no solo ideas' : 'your abundant air helps you think — translate it into words and decisions, not just ideas',
    Water: isES ? 'esa agua es tu radar emocional; conviértela en empatía activa en vez de absorber sin filtro' : 'that water is your emotional radar; turn it into active empathy instead of absorbing without a filter',
  }[dominantElem];

  const missingHint = {
    Fire:  isES ? 'te puede faltar chispa: métele cuerpo, movimiento o una decisión valiente esta semana' : 'you may lack spark: add body, movement or a bold decision this week',
    Earth: isES ? 'te puede faltar suelo: agenda lo concreto y rutiniza un solo hábito pequeño' : 'you may lack grounding: schedule the concrete and routine one small habit',
    Air:   isES ? 'te puede faltar aire: ponle palabras a lo que sientes, escríbelo, pide una segunda opinión' : 'you may lack air: put words to what you feel, write it, ask for a second opinion',
    Water: isES ? 'te puede faltar agua: permítete sentir antes de decidir, no saltes al análisis' : 'you may lack water: allow yourself to feel before deciding, don\'t jump to analysis',
  };

  const elementalBalance = isES
    ? `Tu balance elemental está dominado por el ${domLabel} (${signName} + ${animalName}): ${balanceGuidance}. ${missingElem ? `Además, ${missingHint[missingElem]}.` : 'Los cuatro elementos tienen presencia, lo cual te da versatilidad — pero cuidado con volverte reactivo a cada estímulo.'}`
    : `Your elemental balance is dominated by ${domLabel} (${signName} + ${animalName}): ${balanceGuidance}. ${missingElem ? `Also, ${missingHint[missingElem]}.` : 'All four elements are present, which gives you versatility — but watch out for becoming reactive to every stimulus.'}`;

  // ── Section 3: Soul Path (Celtic + Mayan + Vedic) ──
  const celtTheme = isES ? celt.theme_es : celt.theme_en;
  const mayaLabel = maya ? (isES ? maya.es : profile.mayan_seal) : null;
  const mayaTheme = maya ? (isES ? maya.theme_es : maya.theme_en) : null;
  const vedicLabel = vedic ? (isES ? vedic.es : (profile.vedic_rashi + ' (' + (w ? (isES ? w.es : w.en) : '') + ')')) : null;
  const vedicDharma = vedic ? (isES ? vedic.dharma_es : vedic.dharma_en) : null;

  let soulPath = isES
    ? `El árbol celta del ${celtName} te ofrece la lente de ${celtTheme}: esa es la cualidad que regresa en tus ciclos de vida cada vez que necesitas reorientarte. `
    : `The Celtic ${celtName} tree offers you the lens of ${celtTheme}: that is the quality that returns in your life cycles whenever you need to reorient. `;
  if (maya) {
    soulPath += isES
      ? `Desde el Tzolkin maya, tu sello ${mayaLabel} (Kin ${profile.mayan_kin}, Tono ${profile.mayan_tone}) añade la firma de ${mayaTheme}. `
      : `From the Mayan Tzolkin, your ${mayaLabel} seal (Kin ${profile.mayan_kin}, Tone ${profile.mayan_tone}) adds the signature of ${mayaTheme}. `;
  }
  if (vedic) {
    soulPath += isES
      ? `Tu Rashi védico ${vedicLabel} apunta al dharma de ${vedicDharma}`
      : `Your Vedic Rashi ${vedicLabel} points to the dharma of ${vedicDharma}`;
    if (profile.vedic_nakshatra) {
      soulPath += isES
        ? `, matizado por el nakshatra ${profile.vedic_nakshatra}.`
        : `, flavored by the ${profile.vedic_nakshatra} nakshatra.`;
    } else {
      soulPath += '.';
    }
  }
  soulPath += isES
    ? ` Estas tres tradiciones triangulan el mismo mensaje desde ángulos distintos — cuando las tres apuntan al mismo gesto, es ahí donde conviene actuar.`
    : ` These three traditions triangulate the same message from different angles — when all three point to the same gesture, that is where you should act.`;

  // ── Section 4: Inner Mechanics (Human Design + Enneagram) ──
  let innerMechanics = '';
  if (hdGate && hdBrief) {
    innerMechanics += isES
      ? `Tu Puerta ${hdGate} de Diseño Humano imprime el tema de «${hdBrief}» en cómo procesas energía. `
      : `Your Human Design Gate ${hdGate} imprints the theme of "${hdBrief}" onto how you process energy. `;
  }
  if (enn) {
    const ennName = isES ? enn.es : enn.en;
    const ennTask = isES ? enn.task_es : enn.task_en;
    innerMechanics += isES
      ? `En Eneagrama eres Tipo ${profile.enneagram_type}, ${ennName}${profile.enneagram_wing ? ` con ala ${profile.enneagram_wing}` : ''}: tu trabajo madurativo es ${ennTask}. `
      : `In Enneagram you are Type ${profile.enneagram_type}, ${ennName}${profile.enneagram_wing ? ` with ${profile.enneagram_wing} wing` : ''}: your maturation work is to ${ennTask}. `;
  }
  if (!innerMechanics) {
    innerMechanics = isES
      ? 'Agrega tu tipo de Eneagrama en tu perfil para completar esta sección.'
      : 'Add your Enneagram type to your profile to complete this section.';
  } else {
    innerMechanics += isES
      ? 'Juntos describen tu "mecánica interna": qué activa tu energía (Diseño Humano) y qué motivación le pone dirección (Eneagrama).'
      : 'Together they describe your "inner mechanics": what activates your energy (Human Design) and what motivation gives it direction (Enneagram).';
  }

  // ── Section 5: This season's focus (actionable) ──
  const focusMap = {
    Fire:  isES ? 'Termina una cosa empezada. No arranques otra hasta cerrar.' : 'Finish one started thing. Don\'t start another until you close it.',
    Earth: isES ? 'Revisa tu agenda y poda lo que ya no sirve. Menos = más resultado.' : 'Review your calendar and prune what no longer serves. Less = more output.',
    Air:   isES ? 'Ten una conversación difícil que has estado posponiendo. El aire necesita moverse.' : 'Have a hard conversation you\'ve been postponing. Air needs to move.',
    Water: isES ? 'Nombra un sentimiento que estás evitando y escríbelo. El agua necesita cauce.' : 'Name a feeling you\'re avoiding and write it down. Water needs a channel.',
  };
  const strengths = isES
    ? `Tu fortaleza emergente esta temporada: la sinergia entre tu ${gift} (${signName}) y tu capacidad de ${animTheme} (${animalName}). Úsala concretamente así — ${focusMap[dominantElem]} Esa acción pequeña alinea los ocho sistemas a la vez.`
    : `Your emerging strength this season: the synergy between your ${gift} (${signName}) and your capacity for ${animTheme} (${animalName}). Use it concretely like this — ${focusMap[dominantElem]} That small action aligns all eight systems at once.`;

  // ── Assemble ──
  return {
    profileName: profile.nombre,
    birthDate: profile.fecha_nacimiento,
    version: VERSION,
    lang,
    systems: {
      western:     { sign: profile.western_sign, element: w.element, mode: w.mode, ruler: w.ruler },
      chinese:     { animal: profile.chinese_animal, element: cElement },
      numerology:  { lifePathNumber: profile.numerology_number, theme: lpName },
      celtic:      { tree: profile.celtic_tree, qualities: celtTheme },
      mayan:       maya ? { kin: profile.mayan_kin, seal: profile.mayan_seal, tone: profile.mayan_tone, theme: mayaTheme } : null,
      vedic:       vedic ? { rashi: profile.vedic_rashi, nakshatra: profile.vedic_nakshatra, dharma: vedicDharma } : null,
      humanDesign: hdGate ? { gate: hdGate, theme: hdBrief } : null,
      enneagram:   enn ? { type: profile.enneagram_type, name: isES ? enn.es : enn.en, wing: profile.enneagram_wing || null } : null,
    },
    elementalBalance: { dominant: dominantElem, missing: missingElem, counts: elemCount },
    synthesis: {
      // weeklyFocus primero: es la sección VIVA (cambia cada semana con el
      // cielo real) — el gancho para que el suscriptor regrese al reporte.
      weeklyFocus: buildWeeklyFocus(profile.western_sign, lang),
      coreIdentity,
      elementalBalance,
      soulPath,
      innerMechanics,
      strengths,
    },
    generatedAt: new Date().toISOString(),
  };
}
