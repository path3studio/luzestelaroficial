/**
 * cross-cultural.js — Multi-system astrology calculator
 * =====================================================
 * Deterministic calculations for Western, Chinese, Numerology, and Celtic zodiac.
 * No API calls needed — pure math from birth date.
 */

(function(global) {
  'use strict';

  // ─── Western Zodiac ──────────────────────────────────────────────────

  var WESTERN_SIGNS = [
    {name_es: 'Aries',       name_en: 'Aries',       slug_es: 'aries',       slug_en: 'aries',       element_es: 'Fuego', element_en: 'Fire',  symbol: '\u2648\uFE0E', color: '#FF4500', start: [3,21], end: [4,19]},
    {name_es: 'Tauro',       name_en: 'Taurus',      slug_es: 'tauro',       slug_en: 'taurus',      element_es: 'Tierra',element_en: 'Earth', symbol: '\u2649\uFE0E', color: '#2E8B57', start: [4,20], end: [5,20]},
    {name_es: 'Geminis',     name_en: 'Gemini',      slug_es: 'geminis',     slug_en: 'gemini',      element_es: 'Aire',  element_en: 'Air',   symbol: '\u264A\uFE0E', color: '#FFD700', start: [5,21], end: [6,20]},
    {name_es: 'Cancer',      name_en: 'Cancer',      slug_es: 'cancer',      slug_en: 'cancer',      element_es: 'Agua',  element_en: 'Water', symbol: '\u264B\uFE0E', color: '#4169E1', start: [6,21], end: [7,22]},
    {name_es: 'Leo',         name_en: 'Leo',         slug_es: 'leo',         slug_en: 'leo',         element_es: 'Fuego', element_en: 'Fire',  symbol: '\u264C\uFE0E', color: '#FF8C00', start: [7,23], end: [8,22]},
    {name_es: 'Virgo',       name_en: 'Virgo',       slug_es: 'virgo',       slug_en: 'virgo',       element_es: 'Tierra',element_en: 'Earth', symbol: '\u264D\uFE0E', color: '#8B4513', start: [8,23], end: [9,22]},
    {name_es: 'Libra',       name_en: 'Libra',       slug_es: 'libra',       slug_en: 'libra',       element_es: 'Aire',  element_en: 'Air',   symbol: '\u264E\uFE0E', color: '#DA70D6', start: [9,23], end: [10,22]},
    {name_es: 'Escorpio',    name_en: 'Scorpio',     slug_es: 'escorpio',    slug_en: 'scorpio',     element_es: 'Agua',  element_en: 'Water', symbol: '\u264F\uFE0E', color: '#8B0000', start: [10,23],end: [11,21]},
    {name_es: 'Sagitario',   name_en: 'Sagittarius', slug_es: 'sagitario',   slug_en: 'sagittarius', element_es: 'Fuego', element_en: 'Fire',  symbol: '\u2650\uFE0E', color: '#9400D3', start: [11,22],end: [12,21]},
    {name_es: 'Capricornio', name_en: 'Capricorn',   slug_es: 'capricornio', slug_en: 'capricorn',   element_es: 'Tierra',element_en: 'Earth', symbol: '\u2651\uFE0E', color: '#2F4F4F', start: [12,22],end: [1,19]},
    {name_es: 'Acuario',     name_en: 'Aquarius',    slug_es: 'acuario',     slug_en: 'aquarius',    element_es: 'Aire',  element_en: 'Air',   symbol: '\u2652\uFE0E', color: '#00CED1', start: [1,20], end: [2,18]},
    {name_es: 'Piscis',      name_en: 'Pisces',      slug_es: 'piscis',      slug_en: 'pisces',      element_es: 'Agua',  element_en: 'Water', symbol: '\u2653\uFE0E', color: '#1E90FF', start: [2,19], end: [3,20]}
  ];

  function getWesternSign(month, day) {
    for (var i = 0; i < WESTERN_SIGNS.length; i++) {
      var s = WESTERN_SIGNS[i];
      var sm = s.start[0], sd = s.start[1], em = s.end[0], ed = s.end[1];
      if (sm > em) { // Capricorn wraps around year
        if ((month === sm && day >= sd) || (month === em && day <= ed)) return s;
      } else {
        if ((month === sm && day >= sd) || (month === em && day <= ed)) return s;
        if (month > sm && month < em) return s;
      }
    }
    return WESTERN_SIGNS[9]; // Capricorn default
  }

  // ─── Chinese Zodiac ──────────────────────────────────────────────────

  var CHINESE_ANIMALS = [
    {name_es: 'Rata',       name_en: 'Rat',     slug_es: 'rata',       slug_en: 'rat',     symbol: '\u9F20', element_es: 'Agua',   element_en: 'Water', yin_yang: 'Yang', color: '#4169E1'},
    {name_es: 'Buey',       name_en: 'Ox',      slug_es: 'buey',       slug_en: 'ox',      symbol: '\u725B', element_es: 'Tierra',  element_en: 'Earth', yin_yang: 'Yin',  color: '#8B4513'},
    {name_es: 'Tigre',      name_en: 'Tiger',   slug_es: 'tigre',      slug_en: 'tiger',   symbol: '\u864E', element_es: 'Madera',  element_en: 'Wood',  yin_yang: 'Yang', color: '#FF8C00'},
    {name_es: 'Conejo',     name_en: 'Rabbit',  slug_es: 'conejo',     slug_en: 'rabbit',  symbol: '\u5154', element_es: 'Madera',  element_en: 'Wood',  yin_yang: 'Yin',  color: '#DA70D6'},
    {name_es: 'Dragon',     name_en: 'Dragon',  slug_es: 'dragon',     slug_en: 'dragon',  symbol: '\u9F8D', element_es: 'Tierra',  element_en: 'Earth', yin_yang: 'Yang', color: '#FFD700'},
    {name_es: 'Serpiente',  name_en: 'Snake',   slug_es: 'serpiente',  slug_en: 'snake',   symbol: '\u86C7', element_es: 'Fuego',   element_en: 'Fire',  yin_yang: 'Yin',  color: '#2E8B57'},
    {name_es: 'Caballo',    name_en: 'Horse',   slug_es: 'caballo',    slug_en: 'horse',   symbol: '\u99AC', element_es: 'Fuego',   element_en: 'Fire',  yin_yang: 'Yang', color: '#CD853F'},
    {name_es: 'Cabra',      name_en: 'Goat',    slug_es: 'cabra',      slug_en: 'goat',    symbol: '\u7F8A', element_es: 'Tierra',  element_en: 'Earth', yin_yang: 'Yin',  color: '#DEB887'},
    {name_es: 'Mono',       name_en: 'Monkey',  slug_es: 'mono',       slug_en: 'monkey',  symbol: '\u7334', element_es: 'Metal',   element_en: 'Metal', yin_yang: 'Yang', color: '#B8860B'},
    {name_es: 'Gallo',      name_en: 'Rooster', slug_es: 'gallo',      slug_en: 'rooster', symbol: '\u96DE', element_es: 'Metal',   element_en: 'Metal', yin_yang: 'Yin',  color: '#DC143C'},
    {name_es: 'Perro',      name_en: 'Dog',     slug_es: 'perro',      slug_en: 'dog',     symbol: '\u72D7', element_es: 'Tierra',  element_en: 'Earth', yin_yang: 'Yang', color: '#A0522D'},
    {name_es: 'Cerdo',      name_en: 'Pig',     slug_es: 'cerdo',      slug_en: 'pig',     symbol: '\u8C6C', element_es: 'Agua',    element_en: 'Water', yin_yang: 'Yin',  color: '#FF69B4'}
  ];

  // Simplified: uses year only (ignoring lunar new year date for simplicity)
  function getChineseAnimal(year) {
    var idx = ((year - 1924) % 12 + 12) % 12;
    return CHINESE_ANIMALS[idx];
  }

  // Five-element cycle based on year
  var FIVE_ELEMENTS = [
    {es: 'Metal',  en: 'Metal'},
    {es: 'Agua',   en: 'Water'},
    {es: 'Madera', en: 'Wood'},
    {es: 'Fuego',  en: 'Fire'},
    {es: 'Tierra', en: 'Earth'}
  ];

  function getChineseElement(year) {
    var idx = Math.floor(((year - 1924) % 10 + 10) % 10 / 2);
    return FIVE_ELEMENTS[idx];
  }

  function getChineseYinYang(year) {
    return (year % 2 === 0) ? 'Yang' : 'Yin';
  }

  // ─── Numerology ──────────────────────────────────────────────────────

  function reduceToSingle(n) {
    while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
      var sum = 0;
      var str = String(n);
      for (var i = 0; i < str.length; i++) sum += parseInt(str[i], 10);
      n = sum;
    }
    return n;
  }

  function getLifePathNumber(year, month, day) {
    // Reduce each component separately, then sum
    var y = reduceToSingle(year);
    var m = reduceToSingle(month);
    var d = reduceToSingle(day);
    return reduceToSingle(y + m + d);
  }

  var NUMEROLOGY_DATA = {
    1:  {keyword_es: 'Liderazgo',          keyword_en: 'Leadership',       planet_es: 'Sol',     planet_en: 'Sun',     slug_es: 'numero-1',  slug_en: 'number-1',  color: '#FF4500'},
    2:  {keyword_es: 'Diplomacia',         keyword_en: 'Diplomacy',        planet_es: 'Luna',    planet_en: 'Moon',    slug_es: 'numero-2',  slug_en: 'number-2',  color: '#C0C0C0'},
    3:  {keyword_es: 'Creatividad',        keyword_en: 'Creativity',       planet_es: 'Jupiter', planet_en: 'Jupiter', slug_es: 'numero-3',  slug_en: 'number-3',  color: '#FFD700'},
    4:  {keyword_es: 'Estabilidad',        keyword_en: 'Stability',        planet_es: 'Urano',   planet_en: 'Uranus',  slug_es: 'numero-4',  slug_en: 'number-4',  color: '#2E8B57'},
    5:  {keyword_es: 'Libertad',           keyword_en: 'Freedom',          planet_es: 'Mercurio',planet_en: 'Mercury', slug_es: 'numero-5',  slug_en: 'number-5',  color: '#00CED1'},
    6:  {keyword_es: 'Armonia',            keyword_en: 'Harmony',          planet_es: 'Venus',   planet_en: 'Venus',   slug_es: 'numero-6',  slug_en: 'number-6',  color: '#DA70D6'},
    7:  {keyword_es: 'Espiritualidad',     keyword_en: 'Spirituality',     planet_es: 'Neptuno', planet_en: 'Neptune', slug_es: 'numero-7',  slug_en: 'number-7',  color: '#7B68EE'},
    8:  {keyword_es: 'Poder',              keyword_en: 'Power',            planet_es: 'Saturno', planet_en: 'Saturn',  slug_es: 'numero-8',  slug_en: 'number-8',  color: '#2F4F4F'},
    9:  {keyword_es: 'Humanitarismo',      keyword_en: 'Humanitarianism',  planet_es: 'Marte',   planet_en: 'Mars',    slug_es: 'numero-9',  slug_en: 'number-9',  color: '#8B0000'},
    11: {keyword_es: 'Intuicion',          keyword_en: 'Intuition',        planet_es: 'Pluton',  planet_en: 'Pluto',   slug_es: 'numero-11', slug_en: 'number-11', color: '#9400D3', master: true},
    22: {keyword_es: 'Constructor Maestro',keyword_en: 'Master Builder',   planet_es: 'Urano',   planet_en: 'Uranus',  slug_es: 'numero-22', slug_en: 'number-22', color: '#4169E1', master: true},
    33: {keyword_es: 'Maestro Espiritual', keyword_en: 'Master Teacher',   planet_es: 'Neptuno', planet_en: 'Neptune', slug_es: 'numero-33', slug_en: 'number-33', color: '#FFD700', master: true}
  };

  function getNumerologyData(lifePathNumber) {
    return NUMEROLOGY_DATA[lifePathNumber] || NUMEROLOGY_DATA[9];
  }

  // ─── Celtic Zodiac ───────────────────────────────────────────────────

  var CELTIC_SIGNS = [
    {name_es: 'Abedul',   name_en: 'Birch',    slug_es: 'abedul',   slug_en: 'birch',    ogham: 'Beith',  color: '#F5F5DC', start: [12,24], end: [1,20]},
    {name_es: 'Serbal',   name_en: 'Rowan',    slug_es: 'serbal',   slug_en: 'rowan',    ogham: 'Luis',   color: '#DC143C', start: [1,21],  end: [2,17]},
    {name_es: 'Fresno',   name_en: 'Ash',      slug_es: 'fresno',   slug_en: 'ash',      ogham: 'Nion',   color: '#8FBC8F', start: [2,18],  end: [3,17]},
    {name_es: 'Aliso',    name_en: 'Alder',    slug_es: 'aliso',    slug_en: 'alder',    ogham: 'Fearn',  color: '#CD853F', start: [3,18],  end: [4,14]},
    {name_es: 'Sauce',    name_en: 'Willow',   slug_es: 'sauce',    slug_en: 'willow',   ogham: 'Saille', color: '#9ACD32', start: [4,15],  end: [5,12]},
    {name_es: 'Espino',   name_en: 'Hawthorn', slug_es: 'espino',   slug_en: 'hawthorn', ogham: 'Huath',  color: '#FFB6C1', start: [5,13],  end: [6,9]},
    {name_es: 'Roble',    name_en: 'Oak',      slug_es: 'roble',    slug_en: 'oak',      ogham: 'Duir',   color: '#8B4513', start: [6,10],  end: [7,7]},
    {name_es: 'Acebo',    name_en: 'Holly',    slug_es: 'acebo',    slug_en: 'holly',    ogham: 'Tinne',  color: '#006400', start: [7,8],   end: [8,4]},
    {name_es: 'Avellano', name_en: 'Hazel',    slug_es: 'avellano', slug_en: 'hazel',    ogham: 'Coll',   color: '#D2B48C', start: [8,5],   end: [9,1]},
    {name_es: 'Vid',      name_en: 'Vine',     slug_es: 'vid',      slug_en: 'vine',     ogham: 'Muin',   color: '#800080', start: [9,2],   end: [9,29]},
    {name_es: 'Hiedra',   name_en: 'Ivy',      slug_es: 'hiedra',   slug_en: 'ivy',      ogham: 'Gort',   color: '#228B22', start: [9,30],  end: [10,27]},
    {name_es: 'Cana',     name_en: 'Reed',     slug_es: 'cana',     slug_en: 'reed',     ogham: 'Ngetal', color: '#BDB76B', start: [10,28], end: [11,24]},
    {name_es: 'Sauco',    name_en: 'Elder',    slug_es: 'sauco',    slug_en: 'elder',    ogham: 'Ruis',   color: '#4B0082', start: [11,25], end: [12,23]}
  ];

  function dateInRange(month, day, startM, startD, endM, endD) {
    var md = month * 100 + day;
    var s = startM * 100 + startD;
    var e = endM * 100 + endD;
    if (s > e) { // wraps around year (Birch: Dec 24 - Jan 20)
      return md >= s || md <= e;
    }
    return md >= s && md <= e;
  }

  function getCelticSign(month, day) {
    for (var i = 0; i < CELTIC_SIGNS.length; i++) {
      var c = CELTIC_SIGNS[i];
      if (dateInRange(month, day, c.start[0], c.start[1], c.end[0], c.end[1])) return c;
    }
    return CELTIC_SIGNS[0]; // Birch default
  }

  // ─── Unified Profile Calculator ──────────────────────────────────────

  /**
   * Calculate all four systems from a birth date.
   * @param {number} year  — birth year (e.g., 1990)
   * @param {number} month — birth month (1-12)
   * @param {number} day   — birth day (1-31)
   * @returns {Object} — unified profile with all systems
   */
  function calculateProfile(year, month, day) {
    var western = getWesternSign(month, day);
    var chinese = getChineseAnimal(year);
    var chineseElement = getChineseElement(year);
    var chineseYinYang = getChineseYinYang(year);
    var lifePathNumber = getLifePathNumber(year, month, day);
    var numerology = getNumerologyData(lifePathNumber);
    var celtic = getCelticSign(month, day);

    return {
      birthDate: {year: year, month: month, day: day},
      western: western,
      chinese: {
        animal: chinese,
        element: chineseElement,
        yinYang: chineseYinYang
      },
      numerology: {
        lifePathNumber: lifePathNumber,
        data: numerology
      },
      celtic: celtic
    };
  }

  // ─── Export ──────────────────────────────────────────────────────────

  global.LuzEstelar = global.LuzEstelar || {};
  global.LuzEstelar.CrossCultural = {
    calculateProfile: calculateProfile,
    getWesternSign: getWesternSign,
    getChineseAnimal: getChineseAnimal,
    getChineseElement: getChineseElement,
    getLifePathNumber: getLifePathNumber,
    getNumerologyData: getNumerologyData,
    getCelticSign: getCelticSign,
    WESTERN_SIGNS: WESTERN_SIGNS,
    CHINESE_ANIMALS: CHINESE_ANIMALS,
    CELTIC_SIGNS: CELTIC_SIGNS,
    NUMEROLOGY_DATA: NUMEROLOGY_DATA
  };

})(typeof window !== 'undefined' ? window : this);
