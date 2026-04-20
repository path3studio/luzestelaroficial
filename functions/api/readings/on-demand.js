/**
 * POST /api/readings/on-demand — chart-level personalized daily reading
 *
 * Arco 1 backend: Gemini 2.5 Pro generates a literary daily reading
 * tailored to the profile's natal chart + today's transits, instead
 * of the sign-level KV snippet shared by thousands.
 *
 * Premium only. Lazy generation: fires only when the client detects
 * no reading for this profile today. Cached 24h in D1 by (profile_id,
 * reading_date) via UNIQUE constraint — second call the same day
 * returns the cached row, zero Gemini cost.
 *
 * Request body:
 *   { profile_id: string, lang?: 'es'|'en', date?: 'YYYY-MM-DD' }
 *
 * Response (ok):
 *   { ok: true, reading: { text, sections?, source, generatedAt },
 *     cached: boolean }
 *
 * Response (feature off / tier gate):
 *   { ok: false, error: 'disabled'|'premium_only'|...,
 *     fallback: 'sign_level'|null }
 *   — the client should silently use the existing sign-level flow.
 *
 * Safety envelope:
 *   - Feature flag ENABLE_ONDEMAND_READINGS must equal "1" or the
 *     endpoint returns 503 immediately. Kill switch is instant.
 *   - Ownership check: profile_id must belong to the authenticated user.
 *   - UNIQUE (profile_id, reading_date) in D1 prevents double-generation
 *     even under concurrent requests (second INSERT fails, we read the
 *     existing row).
 *   - 30s timeout on Gemini fetch. On timeout/error we record the
 *     attempt (status='timeout'/'gemini_error') and return fallback
 *     so the UI can gracefully fall back to sign-level.
 *   - Every successful call persists tokens_in, tokens_out, latency_ms
 *     and cost_usd for the admin observability widget.
 */

import { computePositions, computeAscMc } from '../../_shared/ephemeris.js';

// Gemini public pricing as of 2026-04. Keep in sync with
// https://ai.google.dev/pricing. Pricing is recorded per-call at
// write time so future repricing doesn't invalidate historical rows.
const PRICING = {
  'gemini-2.5-pro': { in: 1.25 / 1e6, out: 5.0 / 1e6 },    // USD per token
  'gemini-2.5-flash': { in: 0.075 / 1e6, out: 0.30 / 1e6 },
};
// DEFAULT_MODEL is on Flash while the GCP project is on the free
// tier — 2.5 Pro requires billing enabled. To flip to Pro after
// linking a billing account, just change this single line:
//   'gemini-2.5-flash' → 'gemini-2.5-pro'
// No other code changes needed; pricing table already has both.
const DEFAULT_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 30000;

// Ptolemaic aspects — same orbs the client's transits.js uses.
const ASPECTS = [
  { key: 'Conjunción',  angle:   0, orb: 8 },
  { key: 'Oposición',   angle: 180, orb: 8 },
  { key: 'Cuadratura',  angle:  90, orb: 7 },
  { key: 'Trígono',     angle: 120, orb: 7 },
  { key: 'Sextil',      angle:  60, orb: 5 },
];

const PERSONAL = new Set(['Sun','Moon','Mercury','Venus','Mars']);

const PLANET_ES = {
  Sun: 'Sol', Moon: 'Luna', Mercury: 'Mercurio', Venus: 'Venus', Mars: 'Marte',
  Jupiter: 'Júpiter', Saturn: 'Saturno', Uranus: 'Urano', Neptune: 'Neptuno', Pluto: 'Plutón',
};
const PLANET_EN = {
  Sun: 'Sun', Moon: 'Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars',
  Jupiter: 'Jupiter', Saturn: 'Saturn', Uranus: 'Uranus', Neptune: 'Neptune', Pluto: 'Pluto',
};
const SIGN_ES = ['Aries','Tauro','Géminis','Cáncer','Leo','Virgo','Libra','Escorpio','Sagitario','Capricornio','Acuario','Piscis'];
const SIGN_EN = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

function angDist(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Find today's transits that tightly aspect the user's personal natal
// points. Returns a ranked list (tightest first) used to anchor the
// Gemini prompt — "today's cosmic weather FOR THIS PERSON".
function findKeyAspects(natalPlanets, transitPositions) {
  const natalByName = {};
  for (const p of natalPlanets) natalByName[p.name] = p.longitude;

  const aspects = [];
  for (const tName of Object.keys(transitPositions)) {
    const tLon = transitPositions[tName];
    for (const nName of Object.keys(natalByName)) {
      // Only anchor aspects involving at least one personal body —
      // outer-to-outer transits are too generational for a daily reading.
      if (!PERSONAL.has(tName) && !PERSONAL.has(nName)) continue;
      const nLon = natalByName[nName];
      const d = angDist(tLon, nLon);
      for (const asp of ASPECTS) {
        const orb = Math.abs(d - asp.angle);
        if (orb <= asp.orb) {
          aspects.push({ transit: tName, natal: nName, type: asp.key, orb });
          break; // first matching aspect per pair
        }
      }
    }
  }
  // Tightest first, cap at 6 so the prompt stays focused.
  aspects.sort((a, b) => a.orb - b.orb);
  return aspects.slice(0, 6);
}

function signAt(lon, lang) {
  const arr = lang === 'en' ? SIGN_EN : SIGN_ES;
  return arr[Math.floor(lon / 30) % 12];
}

function buildPrompt({ profile, natalPlanets, natalAsc, transitPositions, keyAspects, date, lang }) {
  const P = lang === 'en' ? PLANET_EN : PLANET_ES;
  const firstName = (profile.nombre || '').split(/\s+/)[0] || '';

  // Current transit snapshot
  const transitsLines = Object.entries(transitPositions).map(([name, lon]) =>
    `- ${P[name]}: ${signAt(lon, lang)} ${(lon % 30).toFixed(1)}°`
  ).join('\n');

  // Natal snapshot (personal points only — keep input token count tight)
  const natalLines = natalPlanets
    .filter(p => PERSONAL.has(p.name))
    .map(p => `- ${P[p.name]}: ${signAt(p.longitude, lang)} ${(p.longitude % 30).toFixed(1)}°`)
    .join('\n');

  const ascLine = natalAsc != null
    ? `- ${lang === 'en' ? 'Ascendant' : 'Ascendente'}: ${signAt(natalAsc, lang)} ${(natalAsc % 30).toFixed(1)}°`
    : '';

  const aspectsLines = keyAspects.length
    ? keyAspects.map(a => `- ${P[a.transit]} (${lang === 'en' ? 'transit' : 'tránsito'}) ${a.type} ${P[a.natal]} (${lang === 'en' ? 'natal' : 'natal'}) — orb ${a.orb.toFixed(1)}°`).join('\n')
    : (lang === 'en' ? '- No exact aspects to personal points today (a quieter sky).' : '- Sin aspectos exactos a puntos personales hoy (un cielo más tranquilo).');

  if (lang === 'en') {
    return `You are the lead astrologer of "Luz Estelar Oficial". Write ${firstName}'s personalized daily reading for ${date}. This is a premium chart-level reading, not a generic sign horoscope — it must feel like you wrote it for them after looking at their chart this morning.

THEIR NATAL SNAPSHOT (personal points):
${natalLines}
${ascLine}

TODAY'S SKY (${date}):
${transitsLines}

TODAY'S KEY ASPECTS TO THEIR CHART (tightest first):
${aspectsLines}

STYLE:
- Warm, literary, grounded. Contemplative tone, not predictive or alarmist.
- Vary sentence length. Short phrases with breath between them. Let the cadence carry the meaning.
- Name the person once, near the opening. Never repeat their name mechanically.
- Reference concrete aspects from the data above — not "today brings" clichés. If Mars squares their natal Moon, say what that asks them to hold.
- No emojis, no markdown, no asterisks, no bullet lists in the output.
- Length: 280–360 words. One flowing piece in 4–5 paragraphs.

STRUCTURE (implicit, not labeled):
1. Opening image — the quality of today for them specifically
2. The strongest aspect, what it's actually asking
3. A secondary thread (second aspect, or the moon, or something the Ascendant speaks to)
4. A practical invitation — something to do, try, notice, or release
5. A closing that returns to stillness

Return ONLY the reading text. No preamble, no explanation, no quoted formatting.`;
  }

  return `Eres el astrólogo principal de "Luz Estelar Oficial". Escribe la lectura diaria personalizada de ${firstName} para el ${date}. Esta es una lectura premium a nivel de carta natal — no un horóscopo genérico por signo. Debe sentirse como si la escribieras esta mañana después de mirar SU carta.

SU RETRATO NATAL (puntos personales):
${natalLines}
${ascLine}

EL CIELO DE HOY (${date}):
${transitsLines}

ASPECTOS CLAVE DE HOY A SU CARTA (más exactos primero):
${aspectsLines}

ESTILO:
- Cálido, literario, aterrizado. Tono contemplativo, no predictivo ni alarmista.
- Varía longitud de oración. Frases cortas con respiración entre ellas. Deja que la cadencia cargue el sentido.
- Nombra a la persona UNA vez, cerca del inicio. Nunca repitas su nombre mecánicamente.
- Referencia aspectos concretos de los datos arriba — no clichés tipo "hoy trae". Si Marte cuadra su Luna natal, di qué te pide sostener.
- Sin emojis, sin markdown, sin asteriscos, sin listas en el output.
- Extensión: 280–360 palabras. Una pieza fluida en 4–5 párrafos.

ESTRUCTURA (implícita, sin etiquetar):
1. Imagen de apertura — el tono del día para ELLA/ÉL específicamente
2. El aspecto más fuerte, qué está pidiendo realmente
3. Un hilo secundario (segundo aspecto, o la luna, o algo que habla el Ascendente)
4. Una invitación práctica — algo que hacer, probar, notar, o soltar
5. Un cierre que regrese al silencio

Responde SOLO con el texto de la lectura. Sin preámbulo, sin explicación, sin formato de comillas.`;
}

async function callGemini({ apiKey, model, prompt, timeoutMs }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 1800,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latency = Date.now() - started;
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return { ok: false, status: r.status, error: body.slice(0, 500), latency };
    }
    const json = await r.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    const usage = json?.usageMetadata || {};
    if (!text) return { ok: false, error: 'empty_response', latency };
    return {
      ok: true,
      text,
      tokensIn: usage.promptTokenCount || 0,
      tokensOut: usage.candidatesTokenCount || 0,
      latency,
    };
  } catch (e) {
    clearTimeout(timer);
    const latency = Date.now() - started;
    if (e.name === 'AbortError') return { ok: false, error: 'timeout', latency };
    return { ok: false, error: String(e).slice(0, 500), latency };
  }
}

function computeCost(model, tokensIn, tokensOut) {
  const p = PRICING[model];
  if (!p) return null;
  return tokensIn * p.in + tokensOut * p.out;
}

function todayKey(date) {
  return date.toISOString().split('T')[0];
}

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) {
    return Response.json({ ok: false, error: 'not_authenticated' }, { status: 401 });
  }

  const { DB, ENABLE_ONDEMAND_READINGS, GEMINI_API_KEY } = context.env;

  // ── Feature flag kill-switch ────────────────────────────────────
  // The client should only call this endpoint when flag is 1, but we
  // double-check server-side so flipping the secret to 0 really does
  // silence the feature even if stale JS is running.
  if (ENABLE_ONDEMAND_READINGS !== '1') {
    return Response.json({ ok: false, error: 'disabled', fallback: 'sign_level' }, { status: 503 });
  }

  // ── Tier gate ────────────────────────────────────────────────────
  if (user.tier !== 'premium') {
    return Response.json({ ok: false, error: 'premium_only', fallback: 'sign_level' }, { status: 403 });
  }

  if (!GEMINI_API_KEY) {
    return Response.json({ ok: false, error: 'not_configured', fallback: 'sign_level' }, { status: 503 });
  }

  let body;
  try { body = await context.request.json(); }
  catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const profileId = body?.profile_id;
  const lang = body?.lang === 'en' ? 'en' : 'es';
  const requestedDate = body?.date;
  if (!profileId || typeof profileId !== 'string') {
    return Response.json({ ok: false, error: 'missing_profile_id' }, { status: 400 });
  }

  const now = new Date();
  const dateKey = (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) ? requestedDate : todayKey(now);

  // ── Cache check (also enforces rate limit via UNIQUE constraint) ─
  try {
    const cached = await DB
      .prepare('SELECT reading_json, model, created_at FROM ondemand_generations WHERE profile_id = ? AND reading_date = ? AND status = ?')
      .bind(profileId, dateKey, 'ok')
      .first();
    if (cached) {
      const reading = JSON.parse(cached.reading_json);
      return Response.json({ ok: true, reading, cached: true });
    }
  } catch (e) {
    // Cache check failure is non-fatal — we'll regenerate. Log but proceed.
    console.warn('[on-demand] cache check failed:', e.message);
  }

  // ── Ownership check + pull natal chart ───────────────────────────
  const profile = await DB
    .prepare('SELECT id, user_id, nombre, fecha_nacimiento, hora_nacimiento, lat, lon, natal_chart, western_sign FROM birth_profiles WHERE id = ?')
    .bind(profileId)
    .first();
  if (!profile) {
    return Response.json({ ok: false, error: 'profile_not_found' }, { status: 404 });
  }
  if (profile.user_id !== user.sub) {
    // Defense in depth — never reveal another user's profile existence.
    return Response.json({ ok: false, error: 'profile_not_found' }, { status: 404 });
  }

  let natal;
  try { natal = typeof profile.natal_chart === 'string' ? JSON.parse(profile.natal_chart) : profile.natal_chart; }
  catch { natal = null; }
  const natalPlanets = natal?.planets || [];
  if (natalPlanets.length < 3) {
    // Profile doesn't have enough natal data to make a chart-level
    // reading meaningful. Fall back silently.
    return Response.json({ ok: false, error: 'insufficient_natal_data', fallback: 'sign_level' }, { status: 422 });
  }
  const natalAsc = natal?.ascendant?.longitude ?? null;

  // ── Today's transits + aspects to their chart ────────────────────
  const transitDate = new Date(`${dateKey}T12:00:00Z`);
  const transitPositions = computePositions(transitDate);
  const keyAspects = findKeyAspects(natalPlanets, transitPositions);

  // ── Build prompt + call Gemini 2.5 Pro ───────────────────────────
  const prompt = buildPrompt({
    profile, natalPlanets, natalAsc,
    transitPositions, keyAspects,
    date: dateKey, lang,
  });

  const model = DEFAULT_MODEL;
  const res = await callGemini({
    apiKey: GEMINI_API_KEY,
    model,
    prompt,
    timeoutMs: GEMINI_TIMEOUT_MS,
  });

  if (!res.ok) {
    // Record the failure so the admin dashboard sees it. Then ask the
    // client to fall back to the sign-level flow — same UX the user
    // had before the feature existed.
    const status = res.error === 'timeout' ? 'timeout' : 'gemini_error';
    try {
      await DB.prepare(
        `INSERT INTO ondemand_generations
          (user_id, profile_id, reading_date, lang, model, reading_json, latency_ms, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        user.sub, profileId, dateKey, lang, model, '{}',
        res.latency || null, status, String(res.error).slice(0, 500)
      ).run();
    } catch { /* UNIQUE race — another request already recorded something */ }
    return Response.json(
      { ok: false, error: status, fallback: 'sign_level' },
      { status: 502 }
    );
  }

  // ── Persist + return ─────────────────────────────────────────────
  const reading = {
    text: res.text,
    source: 'ondemand',
    model,
    generatedAt: new Date().toISOString(),
  };
  const cost = computeCost(model, res.tokensIn, res.tokensOut);

  try {
    await DB.prepare(
      `INSERT INTO ondemand_generations
        (user_id, profile_id, reading_date, lang, model, reading_json, tokens_in, tokens_out, latency_ms, cost_usd, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok')`
    ).bind(
      user.sub, profileId, dateKey, lang, model,
      JSON.stringify(reading),
      res.tokensIn, res.tokensOut, res.latency, cost,
    ).run();
  } catch (e) {
    // UNIQUE constraint hit — another request won the race. Read the
    // winning row instead so both callers see the same reading.
    const winner = await DB
      .prepare('SELECT reading_json FROM ondemand_generations WHERE profile_id = ? AND reading_date = ? AND status = ?')
      .bind(profileId, dateKey, 'ok')
      .first();
    if (winner) {
      return Response.json({ ok: true, reading: JSON.parse(winner.reading_json), cached: true });
    }
    // If we got here the write failed for a reason other than UNIQUE —
    // still return the reading we generated, just without persistence.
    console.warn('[on-demand] persist failed:', e.message);
  }

  return Response.json({ ok: true, reading, cached: false });
}
