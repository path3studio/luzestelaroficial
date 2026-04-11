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

  // ─── Mayan Tzolkin ────────────────────────────────────────────────────

  var MAYAN_SEALS = [
    {num: 1,  name_es: 'Dragón Rojo',         name_en: 'Red Dragon',          nahuatl: 'Imix',    color: '#E53935', color_es: 'Rojo',     color_en: 'Red',    slug_es: 'dragon-rojo',         slug_en: 'red-dragon'},
    {num: 2,  name_es: 'Viento Blanco',        name_en: 'White Wind',          nahuatl: 'Ik',      color: '#FAFAFA', color_es: 'Blanco',   color_en: 'White',  slug_es: 'viento-blanco',       slug_en: 'white-wind'},
    {num: 3,  name_es: 'Noche Azul',           name_en: 'Blue Night',          nahuatl: 'Akbal',   color: '#1565C0', color_es: 'Azul',     color_en: 'Blue',   slug_es: 'noche-azul',          slug_en: 'blue-night'},
    {num: 4,  name_es: 'Semilla Amarilla',     name_en: 'Yellow Seed',         nahuatl: 'Kan',     color: '#FDD835', color_es: 'Amarillo', color_en: 'Yellow', slug_es: 'semilla-amarilla',    slug_en: 'yellow-seed'},
    {num: 5,  name_es: 'Serpiente Roja',       name_en: 'Red Serpent',         nahuatl: 'Chicchan',color: '#C62828', color_es: 'Rojo',     color_en: 'Red',    slug_es: 'serpiente-roja',      slug_en: 'red-serpent'},
    {num: 6,  name_es: 'Enlazador Blanco',     name_en: 'White Worldbridger',  nahuatl: 'Cimi',    color: '#E0E0E0', color_es: 'Blanco',   color_en: 'White',  slug_es: 'enlazador-blanco',    slug_en: 'white-worldbridger'},
    {num: 7,  name_es: 'Mano Azul',            name_en: 'Blue Hand',           nahuatl: 'Manik',   color: '#1976D2', color_es: 'Azul',     color_en: 'Blue',   slug_es: 'mano-azul',           slug_en: 'blue-hand'},
    {num: 8,  name_es: 'Estrella Amarilla',    name_en: 'Yellow Star',         nahuatl: 'Lamat',   color: '#F9A825', color_es: 'Amarillo', color_en: 'Yellow', slug_es: 'estrella-amarilla',   slug_en: 'yellow-star'},
    {num: 9,  name_es: 'Luna Roja',            name_en: 'Red Moon',            nahuatl: 'Muluc',   color: '#D32F2F', color_es: 'Rojo',     color_en: 'Red',    slug_es: 'luna-roja',           slug_en: 'red-moon'},
    {num: 10, name_es: 'Perro Blanco',         name_en: 'White Dog',           nahuatl: 'Oc',      color: '#F5F5F5', color_es: 'Blanco',   color_en: 'White',  slug_es: 'perro-blanco',        slug_en: 'white-dog'},
    {num: 11, name_es: 'Mono Azul',            name_en: 'Blue Monkey',         nahuatl: 'Chuen',   color: '#1E88E5', color_es: 'Azul',     color_en: 'Blue',   slug_es: 'mono-azul',           slug_en: 'blue-monkey'},
    {num: 12, name_es: 'Humano Amarillo',      name_en: 'Yellow Human',        nahuatl: 'Eb',      color: '#FFB300', color_es: 'Amarillo', color_en: 'Yellow', slug_es: 'humano-amarillo',     slug_en: 'yellow-human'},
    {num: 13, name_es: 'Caminante Rojo',       name_en: 'Red Skywalker',       nahuatl: 'Ben',     color: '#EF5350', color_es: 'Rojo',     color_en: 'Red',    slug_es: 'caminante-rojo',      slug_en: 'red-skywalker'},
    {num: 14, name_es: 'Mago Blanco',          name_en: 'White Wizard',        nahuatl: 'Ix',      color: '#EEEEEE', color_es: 'Blanco',   color_en: 'White',  slug_es: 'mago-blanco',         slug_en: 'white-wizard'},
    {num: 15, name_es: 'Águila Azul',          name_en: 'Blue Eagle',          nahuatl: 'Men',     color: '#1565C0', color_es: 'Azul',     color_en: 'Blue',   slug_es: 'aguila-azul',         slug_en: 'blue-eagle'},
    {num: 16, name_es: 'Guerrero Amarillo',    name_en: 'Yellow Warrior',      nahuatl: 'Cib',     color: '#FBC02D', color_es: 'Amarillo', color_en: 'Yellow', slug_es: 'guerrero-amarillo',   slug_en: 'yellow-warrior'},
    {num: 17, name_es: 'Tierra Roja',          name_en: 'Red Earth',           nahuatl: 'Caban',   color: '#B71C1C', color_es: 'Rojo',     color_en: 'Red',    slug_es: 'tierra-roja',         slug_en: 'red-earth'},
    {num: 18, name_es: 'Espejo Blanco',        name_en: 'White Mirror',        nahuatl: 'Etznab', color: '#CFD8DC', color_es: 'Blanco',   color_en: 'White',  slug_es: 'espejo-blanco',       slug_en: 'white-mirror'},
    {num: 19, name_es: 'Tormenta Azul',        name_en: 'Blue Storm',          nahuatl: 'Cauac',   color: '#0D47A1', color_es: 'Azul',     color_en: 'Blue',   slug_es: 'tormenta-azul',       slug_en: 'blue-storm'},
    {num: 20, name_es: 'Sol Amarillo',         name_en: 'Yellow Sun',          nahuatl: 'Ahau',    color: '#FFD600', color_es: 'Amarillo', color_en: 'Yellow', slug_es: 'sol-amarillo',        slug_en: 'yellow-sun'}
  ];

  var MAYAN_TONES = [
    {num: 1,  name_es: 'Magnético',    name_en: 'Magnetic',     keyword_es: 'Propósito',     keyword_en: 'Purpose'},
    {num: 2,  name_es: 'Lunar',        name_en: 'Lunar',        keyword_es: 'Desafío',       keyword_en: 'Challenge'},
    {num: 3,  name_es: 'Eléctrico',    name_en: 'Electric',     keyword_es: 'Servicio',      keyword_en: 'Service'},
    {num: 4,  name_es: 'Autoexistente',name_en: 'Self-Existing',keyword_es: 'Forma',         keyword_en: 'Form'},
    {num: 5,  name_es: 'Entonado',     name_en: 'Overtone',     keyword_es: 'Resplandor',    keyword_en: 'Radiance'},
    {num: 6,  name_es: 'Rítmico',      name_en: 'Rhythmic',     keyword_es: 'Igualdad',      keyword_en: 'Equality'},
    {num: 7,  name_es: 'Resonante',    name_en: 'Resonant',     keyword_es: 'Sintonización', keyword_en: 'Attunement'},
    {num: 8,  name_es: 'Galáctico',    name_en: 'Galactic',     keyword_es: 'Integridad',    keyword_en: 'Integrity'},
    {num: 9,  name_es: 'Solar',        name_en: 'Solar',        keyword_es: 'Intención',     keyword_en: 'Intention'},
    {num: 10, name_es: 'Planetario',   name_en: 'Planetary',    keyword_es: 'Manifestación', keyword_en: 'Manifestation'},
    {num: 11, name_es: 'Espectral',    name_en: 'Spectral',     keyword_es: 'Liberación',    keyword_en: 'Liberation'},
    {num: 12, name_es: 'Cristal',      name_en: 'Crystal',      keyword_es: 'Cooperación',   keyword_en: 'Cooperation'},
    {num: 13, name_es: 'Cósmico',      name_en: 'Cosmic',       keyword_es: 'Presencia',     keyword_en: 'Presence'}
  ];

  /**
   * Gregorian date → Julian Day Number
   */
  function gregorianToJDN(year, month, day) {
    var a = Math.floor((14 - month) / 12);
    var y = year + 4800 - a;
    var m = month + 12 * a - 3;
    return day + Math.floor((153 * m + 2) / 5) + 365 * y
         + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  }

  /**
   * Calculate Mayan Tzolkin Kin from birth date.
   * Uses GMT correlation constant 584,283.
   * @returns {Object} {kin, seal, tone, color_es, color_en}
   */
  function getMayanKin(year, month, day) {
    var jdn = gregorianToJDN(year, month, day);
    var kin = ((jdn - 584283) % 260 + 260) % 260;  // 0-259
    var sealIdx = kin % 20;                          // 0-19
    var toneIdx = kin % 13;                          // 0-12
    var seal = MAYAN_SEALS[sealIdx];
    var tone = MAYAN_TONES[toneIdx];
    return {
      kin: kin + 1,              // Kin 1-260 (display value)
      seal: seal,
      tone: tone,
      color_es: seal.color_es,
      color_en: seal.color_en
    };
  }

  // ─── Vedic / Jyotish Astrology ──────────────────────────────────────

  var VEDIC_RASHIS = [
    {num: 1,  name_sa: 'Mesha',      name_es: 'Mesha (Aries)',       name_en: 'Mesha (Aries)',       element_es: 'Fuego', element_en: 'Fire',  ruler_es: 'Marte',    ruler_en: 'Mars',    slug_es: 'mesha',      slug_en: 'mesha',      color: '#E53935'},
    {num: 2,  name_sa: 'Vrishabha',  name_es: 'Vrishabha (Tauro)',   name_en: 'Vrishabha (Taurus)',  element_es: 'Tierra',element_en: 'Earth', ruler_es: 'Venus',    ruler_en: 'Venus',   slug_es: 'vrishabha',  slug_en: 'vrishabha',  color: '#43A047'},
    {num: 3,  name_sa: 'Mithuna',    name_es: 'Mithuna (Géminis)',   name_en: 'Mithuna (Gemini)',    element_es: 'Aire',  element_en: 'Air',   ruler_es: 'Mercurio', ruler_en: 'Mercury', slug_es: 'mithuna',    slug_en: 'mithuna',    color: '#FDD835'},
    {num: 4,  name_sa: 'Karka',      name_es: 'Karka (Cáncer)',      name_en: 'Karka (Cancer)',      element_es: 'Agua',  element_en: 'Water', ruler_es: 'Luna',     ruler_en: 'Moon',    slug_es: 'karka',      slug_en: 'karka',      color: '#1E88E5'},
    {num: 5,  name_sa: 'Simha',      name_es: 'Simha (Leo)',         name_en: 'Simha (Leo)',         element_es: 'Fuego', element_en: 'Fire',  ruler_es: 'Sol',      ruler_en: 'Sun',     slug_es: 'simha',      slug_en: 'simha',      color: '#FF8F00'},
    {num: 6,  name_sa: 'Kanya',      name_es: 'Kanya (Virgo)',       name_en: 'Kanya (Virgo)',       element_es: 'Tierra',element_en: 'Earth', ruler_es: 'Mercurio', ruler_en: 'Mercury', slug_es: 'kanya',      slug_en: 'kanya',      color: '#6D4C41'},
    {num: 7,  name_sa: 'Tula',       name_es: 'Tula (Libra)',        name_en: 'Tula (Libra)',        element_es: 'Aire',  element_en: 'Air',   ruler_es: 'Venus',    ruler_en: 'Venus',   slug_es: 'tula',       slug_en: 'tula',       color: '#AB47BC'},
    {num: 8,  name_sa: 'Vrischika',  name_es: 'Vrischika (Escorpio)',name_en: 'Vrischika (Scorpio)', element_es: 'Agua',  element_en: 'Water', ruler_es: 'Marte',    ruler_en: 'Mars',    slug_es: 'vrischika',  slug_en: 'vrischika',  color: '#C62828'},
    {num: 9,  name_sa: 'Dhanu',      name_es: 'Dhanu (Sagitario)',   name_en: 'Dhanu (Sagittarius)', element_es: 'Fuego', element_en: 'Fire',  ruler_es: 'Júpiter',  ruler_en: 'Jupiter', slug_es: 'dhanu',      slug_en: 'dhanu',      color: '#7B1FA2'},
    {num: 10, name_sa: 'Makara',     name_es: 'Makara (Capricornio)',name_en: 'Makara (Capricorn)',  element_es: 'Tierra',element_en: 'Earth', ruler_es: 'Saturno',  ruler_en: 'Saturn',  slug_es: 'makara',     slug_en: 'makara',     color: '#455A64'},
    {num: 11, name_sa: 'Kumbha',     name_es: 'Kumbha (Acuario)',    name_en: 'Kumbha (Aquarius)',   element_es: 'Aire',  element_en: 'Air',   ruler_es: 'Saturno',  ruler_en: 'Saturn',  slug_es: 'kumbha',     slug_en: 'kumbha',     color: '#00ACC1'},
    {num: 12, name_sa: 'Meena',      name_es: 'Meena (Piscis)',      name_en: 'Meena (Pisces)',      element_es: 'Agua',  element_en: 'Water', ruler_es: 'Júpiter',  ruler_en: 'Jupiter', slug_es: 'meena',      slug_en: 'meena',      color: '#1565C0'}
  ];

  var VEDIC_NAKSHATRAS = [
    {num: 1,  name_sa: 'Ashwini',       name_es: 'Ashwini',       name_en: 'Ashwini',       ruler_es: 'Ketu',     ruler_en: 'Ketu',    deity_es: 'Ashwini Kumaras', deity_en: 'Ashwini Kumaras', slug_es: 'ashwini',       slug_en: 'ashwini'},
    {num: 2,  name_sa: 'Bharani',       name_es: 'Bharani',       name_en: 'Bharani',       ruler_es: 'Venus',    ruler_en: 'Venus',   deity_es: 'Yama',            deity_en: 'Yama',            slug_es: 'bharani',       slug_en: 'bharani'},
    {num: 3,  name_sa: 'Krittika',      name_es: 'Krittika',      name_en: 'Krittika',      ruler_es: 'Sol',      ruler_en: 'Sun',     deity_es: 'Agni',            deity_en: 'Agni',            slug_es: 'krittika',      slug_en: 'krittika'},
    {num: 4,  name_sa: 'Rohini',        name_es: 'Rohini',        name_en: 'Rohini',        ruler_es: 'Luna',     ruler_en: 'Moon',    deity_es: 'Brahma',          deity_en: 'Brahma',          slug_es: 'rohini',        slug_en: 'rohini'},
    {num: 5,  name_sa: 'Mrigashira',    name_es: 'Mrigashira',    name_en: 'Mrigashira',    ruler_es: 'Marte',    ruler_en: 'Mars',    deity_es: 'Soma',            deity_en: 'Soma',            slug_es: 'mrigashira',    slug_en: 'mrigashira'},
    {num: 6,  name_sa: 'Ardra',         name_es: 'Ardra',         name_en: 'Ardra',         ruler_es: 'Rahu',     ruler_en: 'Rahu',    deity_es: 'Rudra',           deity_en: 'Rudra',           slug_es: 'ardra',         slug_en: 'ardra'},
    {num: 7,  name_sa: 'Punarvasu',     name_es: 'Punarvasu',     name_en: 'Punarvasu',     ruler_es: 'Júpiter',  ruler_en: 'Jupiter', deity_es: 'Aditi',           deity_en: 'Aditi',           slug_es: 'punarvasu',     slug_en: 'punarvasu'},
    {num: 8,  name_sa: 'Pushya',        name_es: 'Pushya',        name_en: 'Pushya',        ruler_es: 'Saturno',  ruler_en: 'Saturn',  deity_es: 'Brihaspati',      deity_en: 'Brihaspati',      slug_es: 'pushya',        slug_en: 'pushya'},
    {num: 9,  name_sa: 'Ashlesha',      name_es: 'Ashlesha',      name_en: 'Ashlesha',      ruler_es: 'Mercurio', ruler_en: 'Mercury', deity_es: 'Naga',            deity_en: 'Naga',            slug_es: 'ashlesha',      slug_en: 'ashlesha'},
    {num: 10, name_sa: 'Magha',         name_es: 'Magha',         name_en: 'Magha',         ruler_es: 'Ketu',     ruler_en: 'Ketu',    deity_es: 'Pitris',          deity_en: 'Pitris',          slug_es: 'magha',         slug_en: 'magha'},
    {num: 11, name_sa: 'Purva Phalguni',name_es: 'Purva Phalguni',name_en: 'Purva Phalguni',ruler_es: 'Venus',    ruler_en: 'Venus',   deity_es: 'Bhaga',           deity_en: 'Bhaga',           slug_es: 'purva-phalguni',slug_en: 'purva-phalguni'},
    {num: 12, name_sa: 'Uttara Phalguni',name_es:'Uttara Phalguni',name_en:'Uttara Phalguni',ruler_es: 'Sol',     ruler_en: 'Sun',     deity_es: 'Aryaman',         deity_en: 'Aryaman',         slug_es: 'uttara-phalguni',slug_en:'uttara-phalguni'},
    {num: 13, name_sa: 'Hasta',         name_es: 'Hasta',         name_en: 'Hasta',         ruler_es: 'Luna',     ruler_en: 'Moon',    deity_es: 'Savitar',         deity_en: 'Savitar',         slug_es: 'hasta',         slug_en: 'hasta'},
    {num: 14, name_sa: 'Chitra',        name_es: 'Chitra',        name_en: 'Chitra',        ruler_es: 'Marte',    ruler_en: 'Mars',    deity_es: 'Vishwakarma',     deity_en: 'Vishwakarma',     slug_es: 'chitra',        slug_en: 'chitra'},
    {num: 15, name_sa: 'Swati',         name_es: 'Swati',         name_en: 'Swati',         ruler_es: 'Rahu',     ruler_en: 'Rahu',    deity_es: 'Vayu',            deity_en: 'Vayu',            slug_es: 'swati',         slug_en: 'swati'},
    {num: 16, name_sa: 'Vishakha',      name_es: 'Vishakha',      name_en: 'Vishakha',      ruler_es: 'Júpiter',  ruler_en: 'Jupiter', deity_es: 'Indra-Agni',      deity_en: 'Indra-Agni',      slug_es: 'vishakha',      slug_en: 'vishakha'},
    {num: 17, name_sa: 'Anuradha',      name_es: 'Anuradha',      name_en: 'Anuradha',      ruler_es: 'Saturno',  ruler_en: 'Saturn',  deity_es: 'Mitra',           deity_en: 'Mitra',           slug_es: 'anuradha',      slug_en: 'anuradha'},
    {num: 18, name_sa: 'Jyeshtha',      name_es: 'Jyeshtha',      name_en: 'Jyeshtha',      ruler_es: 'Mercurio', ruler_en: 'Mercury', deity_es: 'Indra',           deity_en: 'Indra',           slug_es: 'jyeshtha',      slug_en: 'jyeshtha'},
    {num: 19, name_sa: 'Mula',          name_es: 'Mula',          name_en: 'Mula',          ruler_es: 'Ketu',     ruler_en: 'Ketu',    deity_es: 'Nirriti',         deity_en: 'Nirriti',         slug_es: 'mula',          slug_en: 'mula'},
    {num: 20, name_sa: 'Purva Ashadha', name_es: 'Purva Ashadha', name_en: 'Purva Ashadha', ruler_es: 'Venus',    ruler_en: 'Venus',   deity_es: 'Apas',            deity_en: 'Apas',            slug_es: 'purva-ashadha', slug_en: 'purva-ashadha'},
    {num: 21, name_sa: 'Uttara Ashadha',name_es: 'Uttara Ashadha',name_en: 'Uttara Ashadha',ruler_es: 'Sol',      ruler_en: 'Sun',     deity_es: 'Vishvadevas',     deity_en: 'Vishvadevas',     slug_es: 'uttara-ashadha',slug_en: 'uttara-ashadha'},
    {num: 22, name_sa: 'Shravana',      name_es: 'Shravana',      name_en: 'Shravana',      ruler_es: 'Luna',     ruler_en: 'Moon',    deity_es: 'Vishnu',          deity_en: 'Vishnu',          slug_es: 'shravana',      slug_en: 'shravana'},
    {num: 23, name_sa: 'Dhanishta',     name_es: 'Dhanishta',     name_en: 'Dhanishta',     ruler_es: 'Marte',    ruler_en: 'Mars',    deity_es: 'Vasus',           deity_en: 'Vasus',           slug_es: 'dhanishta',     slug_en: 'dhanishta'},
    {num: 24, name_sa: 'Shatabhisha',   name_es: 'Shatabhisha',   name_en: 'Shatabhisha',   ruler_es: 'Rahu',     ruler_en: 'Rahu',    deity_es: 'Varuna',          deity_en: 'Varuna',          slug_es: 'shatabhisha',   slug_en: 'shatabhisha'},
    {num: 25, name_sa: 'Purva Bhadrapada',name_es:'Purva Bhadrapada',name_en:'Purva Bhadrapada',ruler_es:'Júpiter',ruler_en:'Jupiter',  deity_es: 'Ajaikapada',      deity_en: 'Ajaikapada',      slug_es: 'purva-bhadrapada',slug_en:'purva-bhadrapada'},
    {num: 26, name_sa: 'Uttara Bhadrapada',name_es:'Uttara Bhadrapada',name_en:'Uttara Bhadrapada',ruler_es:'Saturno',ruler_en:'Saturn',deity_es: 'Ahirbudhnya',     deity_en: 'Ahirbudhnya',     slug_es: 'uttara-bhadrapada',slug_en:'uttara-bhadrapada'},
    {num: 27, name_sa: 'Revati',        name_es: 'Revati',        name_en: 'Revati',        ruler_es: 'Mercurio', ruler_en: 'Mercury', deity_es: 'Pushan',          deity_en: 'Pushan',          slug_es: 'revati',        slug_en: 'revati'}
  ];

  /**
   * Approximate tropical Sun longitude for a given date.
   * Good enough for rashi determination (within ~1 degree).
   */
  function approxSunLongitude(year, month, day) {
    // Days since J2000.0 (Jan 1.5, 2000)
    var jdn = gregorianToJDN(year, month, day);
    var n = jdn - 2451545.0;
    // Mean longitude (degrees)
    var L = (280.460 + 0.9856474 * n) % 360;
    if (L < 0) L += 360;
    // Mean anomaly (degrees)
    var g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
    // Ecliptic longitude (approx)
    var lambda = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
    return ((lambda % 360) + 360) % 360;
  }

  /**
   * Calculate Vedic (sidereal) sign and nakshatra.
   * Uses Lahiri ayanamsa approximation.
   */
  function getVedicProfile(year, month, day) {
    var tropical = approxSunLongitude(year, month, day);
    // Lahiri ayanamsa: ~23.85° at J2000, precessing ~50.3"/year
    var ayanamsa = 23.85 + (year - 2000) * 0.01397;
    var sidereal = ((tropical - ayanamsa) % 360 + 360) % 360;
    var rashiIdx = Math.floor(sidereal / 30);            // 0-11
    var nakshatraIdx = Math.floor(sidereal / (360/27));  // 0-26 (13.333° each)
    var pada = Math.floor((sidereal % (360/27)) / (360/108)) + 1; // 1-4

    return {
      sidereal_longitude: Math.round(sidereal * 100) / 100,
      rashi: VEDIC_RASHIS[rashiIdx],
      nakshatra: VEDIC_NAKSHATRAS[nakshatraIdx],
      pada: pada
    };
  }

  // ─── Human Design — Sun Gate ────────────────────────────────────────

  /**
   * HD Mandala gate sequence — maps 64 gates around the 360° wheel.
   * Each gate spans 5.625° (360/64). Sequence starts at Gate 41 (0°).
   * This is the standard Human Design wheel order.
   */
  var HD_GATE_SEQUENCE = [
    41, 19, 13, 49, 30, 55, 37, 63,  // 0°–45°
    22, 36, 25, 17, 21, 51, 42, 3,   // 45°–90°
    27, 24, 2,  23, 8,  20, 16, 35,  // 90°–135°
    45, 12, 15, 52, 39, 53, 62, 56,  // 135°–180°
    31, 33, 7,  4,  29, 59, 40, 64,  // 180°–225°
    47, 6,  46, 18, 48, 57, 32, 50,  // 225°–270°
    28, 44, 1,  43, 14, 34, 9,  5,   // 270°–315°
    26, 11, 10, 58, 38, 54, 61, 60   // 315°–360°
  ];

  var HD_GATE_DATA = {
    1:  {name_es: 'La Autoexpresión',     name_en: 'Self-Expression',     genekey_shadow_es: 'Entropía',       genekey_shadow_en: 'Entropy',        genekey_gift_es: 'Frescura',        genekey_gift_en: 'Freshness',       genekey_siddhi_es: 'Belleza',        genekey_siddhi_en: 'Beauty'},
    2:  {name_es: 'La Dirección',         name_en: 'The Direction',       genekey_shadow_es: 'Desplazamiento', genekey_shadow_en: 'Dislocation',    genekey_gift_es: 'Orientación',     genekey_gift_en: 'Orientation',     genekey_siddhi_es: 'Unidad',         genekey_siddhi_en: 'Unity'},
    3:  {name_es: 'El Ordenar',           name_en: 'Ordering',            genekey_shadow_es: 'Caos',           genekey_shadow_en: 'Chaos',          genekey_gift_es: 'Innovación',      genekey_gift_en: 'Innovation',      genekey_siddhi_es: 'Inocencia',      genekey_siddhi_en: 'Innocence'},
    4:  {name_es: 'La Formulación',       name_en: 'Formulization',       genekey_shadow_es: 'Intolerancia',   genekey_shadow_en: 'Intolerance',    genekey_gift_es: 'Entendimiento',   genekey_gift_en: 'Understanding',   genekey_siddhi_es: 'Perdón',         genekey_siddhi_en: 'Forgiveness'},
    5:  {name_es: 'Los Patrones',         name_en: 'Fixed Patterns',      genekey_shadow_es: 'Impaciencia',    genekey_shadow_en: 'Impatience',     genekey_gift_es: 'Paciencia',       genekey_gift_en: 'Patience',        genekey_siddhi_es: 'Atemporalidad',  genekey_siddhi_en: 'Timelessness'},
    6:  {name_es: 'La Fricción',          name_en: 'Friction',            genekey_shadow_es: 'Conflicto',      genekey_shadow_en: 'Conflict',       genekey_gift_es: 'Diplomacia',      genekey_gift_en: 'Diplomacy',       genekey_siddhi_es: 'Paz',            genekey_siddhi_en: 'Peace'},
    7:  {name_es: 'El Ejército',          name_en: 'The Army',            genekey_shadow_es: 'División',       genekey_shadow_en: 'Division',       genekey_gift_es: 'Guía',            genekey_gift_en: 'Guidance',        genekey_siddhi_es: 'Virtud',         genekey_siddhi_en: 'Virtue'},
    8:  {name_es: 'La Contribución',      name_en: 'Contribution',        genekey_shadow_es: 'Mediocridad',    genekey_shadow_en: 'Mediocrity',     genekey_gift_es: 'Estilo',          genekey_gift_en: 'Style',           genekey_siddhi_es: 'Exquisitez',     genekey_siddhi_en: 'Exquisiteness'},
    9:  {name_es: 'El Enfoque',           name_en: 'Focus',               genekey_shadow_es: 'Inercia',        genekey_shadow_en: 'Inertia',        genekey_gift_es: 'Determinación',   genekey_gift_en: 'Determination',   genekey_siddhi_es: 'Invencibilidad', genekey_siddhi_en: 'Invincibility'},
    10: {name_es: 'El Comportamiento',    name_en: 'Behavior',            genekey_shadow_es: 'Autoobsesión',   genekey_shadow_en: 'Self-Obsession', genekey_gift_es: 'Naturalidad',     genekey_gift_en: 'Naturalness',     genekey_siddhi_es: 'Ser',            genekey_siddhi_en: 'Being'},
    11: {name_es: 'Las Ideas',            name_en: 'Ideas',               genekey_shadow_es: 'Oscuridad',      genekey_shadow_en: 'Obscurity',      genekey_gift_es: 'Idealismo',       genekey_gift_en: 'Idealism',        genekey_siddhi_es: 'Luz',            genekey_siddhi_en: 'Light'},
    12: {name_es: 'La Cautela',           name_en: 'Caution',             genekey_shadow_es: 'Vanidad',        genekey_shadow_en: 'Vanity',         genekey_gift_es: 'Discriminación',  genekey_gift_en: 'Discrimination',  genekey_siddhi_es: 'Pureza',         genekey_siddhi_en: 'Purity'},
    13: {name_es: 'El Oyente',            name_en: 'The Listener',        genekey_shadow_es: 'Discordia',      genekey_shadow_en: 'Discord',        genekey_gift_es: 'Discernimiento',  genekey_gift_en: 'Discernment',     genekey_siddhi_es: 'Empatía',        genekey_siddhi_en: 'Empathy'},
    14: {name_es: 'La Posesión',          name_en: 'Possession',          genekey_shadow_es: 'Compromiso',     genekey_shadow_en: 'Compromise',     genekey_gift_es: 'Competencia',     genekey_gift_en: 'Competence',      genekey_siddhi_es: 'Opulencia',      genekey_siddhi_en: 'Bounteousness'},
    15: {name_es: 'La Modestia',          name_en: 'Modesty',             genekey_shadow_es: 'Opacidad',       genekey_shadow_en: 'Dullness',       genekey_gift_es: 'Magnetismo',      genekey_gift_en: 'Magnetism',       genekey_siddhi_es: 'Florecimiento',  genekey_siddhi_en: 'Florescence'},
    16: {name_es: 'El Entusiasmo',        name_en: 'Enthusiasm',          genekey_shadow_es: 'Indiferencia',   genekey_shadow_en: 'Indifference',   genekey_gift_es: 'Versatilidad',    genekey_gift_en: 'Versatility',     genekey_siddhi_es: 'Maestría',       genekey_siddhi_en: 'Mastery'},
    17: {name_es: 'Las Opiniones',        name_en: 'Opinions',            genekey_shadow_es: 'Opinión',        genekey_shadow_en: 'Opinion',        genekey_gift_es: 'Presciencia',     genekey_gift_en: 'Far-Sightedness', genekey_siddhi_es: 'Omnisciencia',   genekey_siddhi_en: 'Omniscience'},
    18: {name_es: 'La Corrección',        name_en: 'Correction',          genekey_shadow_es: 'Juicio',         genekey_shadow_en: 'Judgement',      genekey_gift_es: 'Integridad',      genekey_gift_en: 'Integrity',       genekey_siddhi_es: 'Perfección',     genekey_siddhi_en: 'Perfection'},
    19: {name_es: 'El Acercamiento',      name_en: 'Approach',            genekey_shadow_es: 'Codependencia',  genekey_shadow_en: 'Co-Dependence',  genekey_gift_es: 'Sensibilidad',    genekey_gift_en: 'Sensitivity',     genekey_siddhi_es: 'Sacrificio',     genekey_siddhi_en: 'Sacrifice'},
    20: {name_es: 'La Contemplación',     name_en: 'Contemplation',       genekey_shadow_es: 'Superficialidad',genekey_shadow_en: 'Superficiality', genekey_gift_es: 'Autopresencia',   genekey_gift_en: 'Self-Assurance',  genekey_siddhi_es: 'Presencia',      genekey_siddhi_en: 'Presence'},
    21: {name_es: 'El Cazador',           name_en: 'The Hunter',          genekey_shadow_es: 'Control',        genekey_shadow_en: 'Control',        genekey_gift_es: 'Autoridad',       genekey_gift_en: 'Authority',       genekey_siddhi_es: 'Valor',          genekey_siddhi_en: 'Valour'},
    22: {name_es: 'La Gracia',            name_en: 'Grace',               genekey_shadow_es: 'Deshonra',       genekey_shadow_en: 'Dishonour',      genekey_gift_es: 'Gracia',          genekey_gift_en: 'Graciousness',    genekey_siddhi_es: 'Gracia',         genekey_siddhi_en: 'Grace'},
    23: {name_es: 'La Asimilación',       name_en: 'Assimilation',        genekey_shadow_es: 'Complejidad',    genekey_shadow_en: 'Complexity',     genekey_gift_es: 'Simplicidad',     genekey_gift_en: 'Simplicity',      genekey_siddhi_es: 'Quintaesencia',  genekey_siddhi_en: 'Quintessence'},
    24: {name_es: 'El Retorno',           name_en: 'The Return',          genekey_shadow_es: 'Adicción',       genekey_shadow_en: 'Addiction',      genekey_gift_es: 'Invención',       genekey_gift_en: 'Invention',       genekey_siddhi_es: 'Silencio',       genekey_siddhi_en: 'Silence'},
    25: {name_es: 'La Inocencia',         name_en: 'Innocence',           genekey_shadow_es: 'Constricción',   genekey_shadow_en: 'Constriction',   genekey_gift_es: 'Aceptación',      genekey_gift_en: 'Acceptance',      genekey_siddhi_es: 'Amor Universal', genekey_siddhi_en: 'Universal Love'},
    26: {name_es: 'El Domador',           name_en: 'The Taming',          genekey_shadow_es: 'Orgullo',        genekey_shadow_en: 'Pride',          genekey_gift_es: 'Astucia',         genekey_gift_en: 'Artfulness',      genekey_siddhi_es: 'Invisibilidad',  genekey_siddhi_en: 'Invisibility'},
    27: {name_es: 'El Alimento',          name_en: 'Nourishment',         genekey_shadow_es: 'Egoísmo',        genekey_shadow_en: 'Selfishness',    genekey_gift_es: 'Altruismo',       genekey_gift_en: 'Altruism',        genekey_siddhi_es: 'Desinterés',     genekey_siddhi_en: 'Selflessness'},
    28: {name_es: 'El Jugador',           name_en: 'The Game Player',     genekey_shadow_es: 'Falta de Propósito',genekey_shadow_en:'Purposelessness',genekey_gift_es: 'Totalidad',      genekey_gift_en: 'Totality',        genekey_siddhi_es: 'Inmortalidad',   genekey_siddhi_en: 'Immortality'},
    29: {name_es: 'El Abismo',            name_en: 'The Abyss',           genekey_shadow_es: 'Agobio',         genekey_shadow_en: 'Half-Heartedness',genekey_gift_es: 'Compromiso',     genekey_gift_en: 'Commitment',      genekey_siddhi_es: 'Devoción',       genekey_siddhi_en: 'Devotion'},
    30: {name_es: 'Los Sentimientos',     name_en: 'Feelings',            genekey_shadow_es: 'Deseo',          genekey_shadow_en: 'Desire',         genekey_gift_es: 'Ligereza',        genekey_gift_en: 'Lightness',       genekey_siddhi_es: 'Éxtasis',        genekey_siddhi_en: 'Rapture'},
    31: {name_es: 'La Influencia',        name_en: 'Influence',           genekey_shadow_es: 'Arrogancia',     genekey_shadow_en: 'Arrogance',      genekey_gift_es: 'Liderazgo',       genekey_gift_en: 'Leadership',      genekey_siddhi_es: 'Humildad',       genekey_siddhi_en: 'Humility'},
    32: {name_es: 'La Duración',          name_en: 'Duration',            genekey_shadow_es: 'Fracaso',        genekey_shadow_en: 'Failure',        genekey_gift_es: 'Preservación',    genekey_gift_en: 'Preservation',    genekey_siddhi_es: 'Veneración',     genekey_siddhi_en: 'Veneration'},
    33: {name_es: 'El Retiro',            name_en: 'Retreat',             genekey_shadow_es: 'Olvido',         genekey_shadow_en: 'Forgetting',     genekey_gift_es: 'Atención',        genekey_gift_en: 'Mindfulness',     genekey_siddhi_es: 'Revelación',     genekey_siddhi_en: 'Revelation'},
    34: {name_es: 'El Poder',             name_en: 'Power',               genekey_shadow_es: 'Fuerza',         genekey_shadow_en: 'Force',          genekey_gift_es: 'Fortaleza',       genekey_gift_en: 'Strength',        genekey_siddhi_es: 'Majestad',       genekey_siddhi_en: 'Majesty'},
    35: {name_es: 'El Progreso',          name_en: 'Progress',            genekey_shadow_es: 'Hambre',         genekey_shadow_en: 'Hunger',         genekey_gift_es: 'Aventura',        genekey_gift_en: 'Adventure',       genekey_siddhi_es: 'Ilimitado',      genekey_siddhi_en: 'Boundlessness'},
    36: {name_es: 'La Crisis',            name_en: 'Crisis',              genekey_shadow_es: 'Turbulencia',    genekey_shadow_en: 'Turbulence',     genekey_gift_es: 'Humanidad',       genekey_gift_en: 'Humanity',        genekey_siddhi_es: 'Compasión',      genekey_siddhi_en: 'Compassion'},
    37: {name_es: 'La Familia',           name_en: 'The Family',          genekey_shadow_es: 'Debilidad',      genekey_shadow_en: 'Weakness',       genekey_gift_es: 'Igualdad',        genekey_gift_en: 'Equality',        genekey_siddhi_es: 'Ternura',        genekey_siddhi_en: 'Tenderness'},
    38: {name_es: 'La Oposición',         name_en: 'Opposition',          genekey_shadow_es: 'Lucha',          genekey_shadow_en: 'Struggle',       genekey_gift_es: 'Perseverancia',   genekey_gift_en: 'Perseverance',    genekey_siddhi_es: 'Honor',          genekey_siddhi_en: 'Honour'},
    39: {name_es: 'La Obstrucción',       name_en: 'Obstruction',         genekey_shadow_es: 'Provocación',    genekey_shadow_en: 'Provocation',    genekey_gift_es: 'Dinamismo',       genekey_gift_en: 'Dynamism',        genekey_siddhi_es: 'Liberación',     genekey_siddhi_en: 'Liberation'},
    40: {name_es: 'La Entrega',           name_en: 'Deliverance',         genekey_shadow_es: 'Agotamiento',    genekey_shadow_en: 'Exhaustion',     genekey_gift_es: 'Resolución',      genekey_gift_en: 'Resolve',         genekey_siddhi_es: 'Voluntad Divina',genekey_siddhi_en: 'Divine Will'},
    41: {name_es: 'La Disminución',       name_en: 'Decrease',            genekey_shadow_es: 'Fantasía',       genekey_shadow_en: 'Fantasy',        genekey_gift_es: 'Anticipación',    genekey_gift_en: 'Anticipation',    genekey_siddhi_es: 'Emanación',      genekey_siddhi_en: 'Emanation'},
    42: {name_es: 'El Aumento',           name_en: 'Increase',            genekey_shadow_es: 'Expectativa',    genekey_shadow_en: 'Expectation',    genekey_gift_es: 'Desapego',        genekey_gift_en: 'Detachment',      genekey_siddhi_es: 'Celebración',    genekey_siddhi_en: 'Celebration'},
    43: {name_es: 'La Penetración',       name_en: 'Breakthrough',        genekey_shadow_es: 'Sordera',        genekey_shadow_en: 'Deafness',       genekey_gift_es: 'Perspicacia',     genekey_gift_en: 'Insight',         genekey_siddhi_es: 'Epifanía',       genekey_siddhi_en: 'Epiphany'},
    44: {name_es: 'El Encuentro',         name_en: 'Coming to Meet',      genekey_shadow_es: 'Interferencia',  genekey_shadow_en: 'Interference',   genekey_gift_es: 'Trabajo en Equipo',genekey_gift_en: 'Teamwork',       genekey_siddhi_es: 'Sinergia',       genekey_siddhi_en: 'Synarchy'},
    45: {name_es: 'La Reunión',           name_en: 'Gathering',           genekey_shadow_es: 'Dominación',     genekey_shadow_en: 'Dominance',      genekey_gift_es: 'Comunión',        genekey_gift_en: 'Communion',       genekey_siddhi_es: 'Comunión',       genekey_siddhi_en: 'Communion'},
    46: {name_es: 'El Empuje',            name_en: 'Pushing Upward',      genekey_shadow_es: 'Seriedad',       genekey_shadow_en: 'Seriousness',    genekey_gift_es: 'Deleite',         genekey_gift_en: 'Delight',         genekey_siddhi_es: 'Éxtasis',        genekey_siddhi_en: 'Ecstasy'},
    47: {name_es: 'La Opresión',          name_en: 'Oppression',          genekey_shadow_es: 'Opresión',       genekey_shadow_en: 'Oppression',     genekey_gift_es: 'Transmutación',   genekey_gift_en: 'Transmutation',   genekey_siddhi_es: 'Transfiguración',genekey_siddhi_en: 'Transfiguration'},
    48: {name_es: 'El Pozo',             name_en: 'The Well',            genekey_shadow_es: 'Inadecuación',   genekey_shadow_en: 'Inadequacy',     genekey_gift_es: 'Inventiva',       genekey_gift_en: 'Resourcefulness', genekey_siddhi_es: 'Sabiduría',      genekey_siddhi_en: 'Wisdom'},
    49: {name_es: 'La Revolución',        name_en: 'Revolution',          genekey_shadow_es: 'Reacción',       genekey_shadow_en: 'Reaction',       genekey_gift_es: 'Revolución',      genekey_gift_en: 'Revolution',      genekey_siddhi_es: 'Renacimiento',   genekey_siddhi_en: 'Rebirth'},
    50: {name_es: 'Los Valores',          name_en: 'Values',              genekey_shadow_es: 'Corrupción',     genekey_shadow_en: 'Corruption',     genekey_gift_es: 'Equilibrio',      genekey_gift_en: 'Equilibrium',     genekey_siddhi_es: 'Armonía',        genekey_siddhi_en: 'Harmony'},
    51: {name_es: 'El Despertar',         name_en: 'Arousing',            genekey_shadow_es: 'Agitación',      genekey_shadow_en: 'Agitation',      genekey_gift_es: 'Iniciativa',      genekey_gift_en: 'Initiative',      genekey_siddhi_es: 'Despertar',      genekey_siddhi_en: 'Awakening'},
    52: {name_es: 'La Quietud',           name_en: 'Stillness',           genekey_shadow_es: 'Estrés',         genekey_shadow_en: 'Stress',         genekey_gift_es: 'Contención',      genekey_gift_en: 'Restraint',       genekey_siddhi_es: 'Quietud',        genekey_siddhi_en: 'Stillness'},
    53: {name_es: 'El Desarrollo',        name_en: 'Development',         genekey_shadow_es: 'Inmadurez',      genekey_shadow_en: 'Immaturity',     genekey_gift_es: 'Expansión',       genekey_gift_en: 'Expansion',       genekey_siddhi_es: 'Superabundancia',genekey_siddhi_en: 'Superabundance'},
    54: {name_es: 'La Ambición',          name_en: 'Ambition',            genekey_shadow_es: 'Avaricia',       genekey_shadow_en: 'Greed',          genekey_gift_es: 'Aspiración',      genekey_gift_en: 'Aspiration',      genekey_siddhi_es: 'Ascensión',      genekey_siddhi_en: 'Ascension'},
    55: {name_es: 'La Abundancia',        name_en: 'Abundance',           genekey_shadow_es: 'Victimismo',     genekey_shadow_en: 'Victimization',  genekey_gift_es: 'Libertad',        genekey_gift_en: 'Freedom',         genekey_siddhi_es: 'Libertad',       genekey_siddhi_en: 'Freedom'},
    56: {name_es: 'El Viajero',           name_en: 'The Wanderer',        genekey_shadow_es: 'Distracción',    genekey_shadow_en: 'Distraction',    genekey_gift_es: 'Enriquecimiento', genekey_gift_en: 'Enrichment',      genekey_siddhi_es: 'Intoxicación',   genekey_siddhi_en: 'Intoxication'},
    57: {name_es: 'La Intuición',         name_en: 'Intuition',           genekey_shadow_es: 'Inquietud',      genekey_shadow_en: 'Unease',         genekey_gift_es: 'Intuición',       genekey_gift_en: 'Intuition',       genekey_siddhi_es: 'Claridad',       genekey_siddhi_en: 'Clarity'},
    58: {name_es: 'La Alegría',           name_en: 'Joy',                 genekey_shadow_es: 'Insatisfacción', genekey_shadow_en: 'Dissatisfaction', genekey_gift_es: 'Vitalidad',      genekey_gift_en: 'Vitality',        genekey_siddhi_es: 'Dicha',          genekey_siddhi_en: 'Bliss'},
    59: {name_es: 'La Dispersión',        name_en: 'Dispersion',          genekey_shadow_es: 'Deshonestidad',  genekey_shadow_en: 'Dishonesty',     genekey_gift_es: 'Intimidad',       genekey_gift_en: 'Intimacy',        genekey_siddhi_es: 'Transparencia',  genekey_siddhi_en: 'Transparency'},
    60: {name_es: 'La Limitación',        name_en: 'Limitation',          genekey_shadow_es: 'Limitación',     genekey_shadow_en: 'Limitation',     genekey_gift_es: 'Realismo',        genekey_gift_en: 'Realism',         genekey_siddhi_es: 'Justicia',       genekey_siddhi_en: 'Justice'},
    61: {name_es: 'La Verdad Interior',   name_en: 'Inner Truth',         genekey_shadow_es: 'Psicoticismo',   genekey_shadow_en: 'Psychosis',      genekey_gift_es: 'Inspiración',     genekey_gift_en: 'Inspiration',     genekey_siddhi_es: 'Santidad',       genekey_siddhi_en: 'Sanctity'},
    62: {name_es: 'Los Detalles',         name_en: 'Details',             genekey_shadow_es: 'Intelecto',      genekey_shadow_en: 'Intellect',      genekey_gift_es: 'Precisión',       genekey_gift_en: 'Precision',       genekey_siddhi_es: 'Impecabilidad',  genekey_siddhi_en: 'Impeccability'},
    63: {name_es: 'Después de la Conclusión',name_en:'After Completion',  genekey_shadow_es: 'Duda',           genekey_shadow_en: 'Doubt',          genekey_gift_es: 'Investigación',   genekey_gift_en: 'Inquiry',         genekey_siddhi_es: 'Verdad',         genekey_siddhi_en: 'Truth'},
    64: {name_es: 'Antes de la Conclusión',name_en: 'Before Completion',  genekey_shadow_es: 'Confusión',      genekey_shadow_en: 'Confusion',      genekey_gift_es: 'Imaginación',     genekey_gift_en: 'Imagination',     genekey_siddhi_es: 'Iluminación',    genekey_siddhi_en: 'Illumination'}
  };

  /**
   * Get Human Design Sun Gate from birth date.
   * Maps solar longitude to the HD Mandala's 64-gate sequence.
   * @returns {Object} {gate, line, gateData}
   */
  function getHumanDesignGate(year, month, day) {
    var sunLong = approxSunLongitude(year, month, day);
    var gateIdx = Math.floor(sunLong / 5.625) % 64;  // each gate = 5.625°
    var gate = HD_GATE_SEQUENCE[gateIdx];
    var lineAngle = sunLong % 5.625;                  // position within gate
    var line = Math.floor(lineAngle / 0.9375) + 1;    // 6 lines per gate (5.625/6)
    if (line > 6) line = 6;
    return {
      gate: gate,
      line: line,
      gateData: HD_GATE_DATA[gate]
    };
  }

  // ─── Enneagram Quiz Engine ──────────────────────────────────────────

  var ENNEAGRAM_TYPES = {
    1: {name_es: 'El Reformador',      name_en: 'The Reformer',      slug_es: 'tipo-1-reformador',   slug_en: 'type-1-reformer',    color: '#607D8B', center_es: 'Instintivo', center_en: 'Body'},
    2: {name_es: 'El Ayudador',        name_en: 'The Helper',         slug_es: 'tipo-2-ayudador',    slug_en: 'type-2-helper',      color: '#E91E63', center_es: 'Emocional',  center_en: 'Heart'},
    3: {name_es: 'El Triunfador',      name_en: 'The Achiever',       slug_es: 'tipo-3-triunfador',  slug_en: 'type-3-achiever',    color: '#FF9800', center_es: 'Emocional',  center_en: 'Heart'},
    4: {name_es: 'El Individualista',  name_en: 'The Individualist',  slug_es: 'tipo-4-individualista',slug_en:'type-4-individualist',color: '#9C27B0', center_es: 'Emocional',  center_en: 'Heart'},
    5: {name_es: 'El Investigador',    name_en: 'The Investigator',   slug_es: 'tipo-5-investigador',slug_en: 'type-5-investigator',color: '#3F51B5', center_es: 'Mental',     center_en: 'Head'},
    6: {name_es: 'El Leal',            name_en: 'The Loyalist',       slug_es: 'tipo-6-leal',        slug_en: 'type-6-loyalist',    color: '#795548', center_es: 'Mental',     center_en: 'Head'},
    7: {name_es: 'El Entusiasta',      name_en: 'The Enthusiast',     slug_es: 'tipo-7-entusiasta',  slug_en: 'type-7-enthusiast',  color: '#FFC107', center_es: 'Mental',     center_en: 'Head'},
    8: {name_es: 'El Desafiador',      name_en: 'The Challenger',     slug_es: 'tipo-8-desafiador',  slug_en: 'type-8-challenger',  color: '#F44336', center_es: 'Instintivo', center_en: 'Body'},
    9: {name_es: 'El Pacificador',     name_en: 'The Peacemaker',     slug_es: 'tipo-9-pacificador', slug_en: 'type-9-peacemaker',  color: '#4CAF50', center_es: 'Instintivo', center_en: 'Body'}
  };

  var ENNEAGRAM_QUESTIONS = {
    es: [
      {q: 'En situaciones nuevas, tiendo a:',                          a: [{t: 7, text: 'Buscar lo divertido y las posibilidades'}, {t: 5, text: 'Observar y analizar antes de actuar'}, {t: 1, text: 'Evaluar qué es lo correcto'}]},
      {q: 'Lo que más me importa en las relaciones es:',               a: [{t: 2, text: 'Sentirme necesitado/a y útil'}, {t: 4, text: 'Conexión emocional profunda'}, {t: 9, text: 'Armonía y paz'}]},
      {q: 'Cuando enfrento un conflicto:',                             a: [{t: 8, text: 'Lo confronto directamente'}, {t: 6, text: 'Busco apoyo y seguridad'}, {t: 9, text: 'Evito el conflicto si puedo'}]},
      {q: 'Mi mayor miedo es:',                                        a: [{t: 3, text: 'Ser considerado un fracaso'}, {t: 4, text: 'No tener identidad propia'}, {t: 5, text: 'Ser incompetente o inútil'}]},
      {q: 'En mi trabajo, me destaco por:',                            a: [{t: 1, text: 'Mi atención al detalle y ética'}, {t: 3, text: 'Mi eficiencia y logros'}, {t: 8, text: 'Mi liderazgo y determinación'}]},
      {q: 'Lo que más me motiva es:',                                  a: [{t: 7, text: 'Nuevas experiencias y libertad'}, {t: 2, text: 'Ayudar y conectar con otros'}, {t: 6, text: 'Seguridad y estabilidad'}]},
      {q: 'Cuando estoy bajo estrés:',                                 a: [{t: 1, text: 'Me vuelvo crítico/a y exigente'}, {t: 4, text: 'Me retraigo y me pongo melancólico/a'}, {t: 8, text: 'Me vuelvo controlador/a'}]},
      {q: 'Creo que el mundo sería mejor si:',                         a: [{t: 2, text: 'Las personas se cuidaran más entre sí'}, {t: 5, text: 'Hubiera más conocimiento y comprensión'}, {t: 9, text: 'Hubiera más paz y aceptación'}]},
      {q: 'Lo que mejor me describe es:',                              a: [{t: 3, text: 'Adaptable, ambicioso/a, orientado/a al éxito'}, {t: 6, text: 'Responsable, leal, comprometido/a'}, {t: 7, text: 'Optimista, versátil, espontáneo/a'}]}
    ],
    en: [
      {q: 'In new situations, I tend to:',                             a: [{t: 7, text: 'Look for fun and possibilities'}, {t: 5, text: 'Observe and analyze before acting'}, {t: 1, text: 'Evaluate what is the right thing to do'}]},
      {q: 'What matters most to me in relationships is:',              a: [{t: 2, text: 'Feeling needed and useful'}, {t: 4, text: 'Deep emotional connection'}, {t: 9, text: 'Harmony and peace'}]},
      {q: 'When I face a conflict:',                                   a: [{t: 8, text: 'I confront it directly'}, {t: 6, text: 'I seek support and security'}, {t: 9, text: 'I avoid the conflict if I can'}]},
      {q: 'My greatest fear is:',                                      a: [{t: 3, text: 'Being seen as a failure'}, {t: 4, text: 'Not having my own identity'}, {t: 5, text: 'Being incompetent or useless'}]},
      {q: 'At work, I stand out for:',                                 a: [{t: 1, text: 'My attention to detail and ethics'}, {t: 3, text: 'My efficiency and achievements'}, {t: 8, text: 'My leadership and determination'}]},
      {q: 'What motivates me most is:',                                a: [{t: 7, text: 'New experiences and freedom'}, {t: 2, text: 'Helping and connecting with others'}, {t: 6, text: 'Security and stability'}]},
      {q: 'When I am under stress:',                                   a: [{t: 1, text: 'I become critical and demanding'}, {t: 4, text: 'I withdraw and become melancholic'}, {t: 8, text: 'I become controlling'}]},
      {q: 'I believe the world would be better if:',                   a: [{t: 2, text: 'People cared more for each other'}, {t: 5, text: 'There was more knowledge and understanding'}, {t: 9, text: 'There was more peace and acceptance'}]},
      {q: 'What best describes me is:',                                a: [{t: 3, text: 'Adaptable, ambitious, success-oriented'}, {t: 6, text: 'Responsible, loyal, committed'}, {t: 7, text: 'Optimistic, versatile, spontaneous'}]}
    ]
  };

  /**
   * Score enneagram quiz answers.
   * @param {number[]} answers — array of 9 selected answer indices (0-2)
   * @param {string} lang — 'es' or 'en'
   * @returns {Object} {type, wing, typeData, scores}
   */
  function scoreEnneagram(answers, lang) {
    lang = lang || 'es';
    var questions = ENNEAGRAM_QUESTIONS[lang] || ENNEAGRAM_QUESTIONS.es;
    var scores = {};
    for (var i = 1; i <= 9; i++) scores[i] = 0;

    for (var q = 0; q < questions.length; q++) {
      var ansIdx = answers[q];
      if (ansIdx !== undefined && ansIdx !== null && questions[q].a[ansIdx]) {
        var typeNum = questions[q].a[ansIdx].t;
        scores[typeNum] = (scores[typeNum] || 0) + 1;
      }
    }

    // Find primary type (highest score)
    var maxScore = 0, primaryType = 9;
    for (var t = 1; t <= 9; t++) {
      if (scores[t] > maxScore) { maxScore = scores[t]; primaryType = t; }
    }

    // Determine wing (adjacent type with higher score)
    var wingA = primaryType === 1 ? 9 : primaryType - 1;
    var wingB = primaryType === 9 ? 1 : primaryType + 1;
    var wing = (scores[wingA] || 0) >= (scores[wingB] || 0) ? wingA : wingB;

    return {
      type: primaryType,
      wing: wing,
      typeData: ENNEAGRAM_TYPES[primaryType],
      wingData: ENNEAGRAM_TYPES[wing],
      scores: scores
    };
  }

  // ─── Unified Profile Calculator ──────────────────────────────────────

  /**
   * Calculate all eight systems from a birth date.
   * Enneagram requires a separate quiz — not included in auto-profile.
   * @param {number} year  — birth year (e.g., 1990)
   * @param {number} month — birth month (1-12)
   * @param {number} day   — birth day (1-31)
   * @returns {Object} — unified profile with all date-based systems
   */
  function calculateProfile(year, month, day) {
    var western = getWesternSign(month, day);
    var chinese = getChineseAnimal(year);
    var chineseElement = getChineseElement(year);
    var chineseYinYang = getChineseYinYang(year);
    var lifePathNumber = getLifePathNumber(year, month, day);
    var numerology = getNumerologyData(lifePathNumber);
    var celtic = getCelticSign(month, day);
    var mayan = getMayanKin(year, month, day);
    var vedic = getVedicProfile(year, month, day);
    var humanDesign = getHumanDesignGate(year, month, day);

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
      celtic: celtic,
      mayan: mayan,
      vedic: vedic,
      humanDesign: humanDesign
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
    getMayanKin: getMayanKin,
    getVedicProfile: getVedicProfile,
    getHumanDesignGate: getHumanDesignGate,
    scoreEnneagram: scoreEnneagram,
    WESTERN_SIGNS: WESTERN_SIGNS,
    CHINESE_ANIMALS: CHINESE_ANIMALS,
    CELTIC_SIGNS: CELTIC_SIGNS,
    NUMEROLOGY_DATA: NUMEROLOGY_DATA,
    MAYAN_SEALS: MAYAN_SEALS,
    MAYAN_TONES: MAYAN_TONES,
    VEDIC_RASHIS: VEDIC_RASHIS,
    VEDIC_NAKSHATRAS: VEDIC_NAKSHATRAS,
    HD_GATE_SEQUENCE: HD_GATE_SEQUENCE,
    HD_GATE_DATA: HD_GATE_DATA,
    ENNEAGRAM_TYPES: ENNEAGRAM_TYPES,
    ENNEAGRAM_QUESTIONS: ENNEAGRAM_QUESTIONS
  };

})(typeof window !== 'undefined' ? window : this);
