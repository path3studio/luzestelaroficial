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
  // DeepSeek (fallback 2026-07-07) — api.deepseek.com pricing
  'deepseek-reasoner': { in: 0.55 / 1e6, out: 2.19 / 1e6 },
  'deepseek-chat': { in: 0.27 / 1e6, out: 1.10 / 1e6 },
};
// Gemini 2.5 Pro — active as of 2026-04-20 once GCP billing landed.
// The prose quality jump over Flash is substantial: Flash was
// truncating to ~70 output tokens during smoke testing; Pro handles
// the 280-360 word target cleanly with sophisticated metaphor and
// rhythm. Cost per call ~$0.01 vs ~$0.0005 for Flash, fully covered
// by Plus revenue (see memory/llm_cost_analysis.md).
// Revert to 'gemini-2.5-flash' is a single-line change + redeploy
// if we ever need to save money; behaviour is identical, prose
// collapses gracefully.
const DEFAULT_MODEL = 'gemini-2.5-pro';
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

function buildPrompt({ profile, natalPlanets, natalAsc, transitPositions, keyAspects, date, lang, recentTexts = [] }) {
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

  // Cross-day memory: feed back the last few readings so the model doesn't
  // echo the same opening image, metaphor, or closing invitation day after
  // day — a Plus subscriber reads this daily and repetition kills retention.
  // (2026-06-16)
  const recentList = (recentTexts || []).filter(Boolean).slice(0, 3);
  const recentMemoryEn = recentList.length
    ? `\nRECENT READINGS FOR ${firstName || 'them'} (do NOT reuse their opening images, metaphors, or closing invitation — this person reads daily; give them something genuinely new):\n`
      + recentList.map(t => `- ${String(t).replace(/\s+/g, ' ').slice(0, 320)}…`).join('\n') + '\n'
    : '';
  const recentMemoryEs = recentList.length
    ? `\nLECTURAS RECIENTES DE ${firstName || 'esta persona'} (NO reutilices sus imágenes de apertura, metáforas ni la invitación de cierre — esta persona lee a diario; dale algo genuinamente nuevo):\n`
      + recentList.map(t => `- ${String(t).replace(/\s+/g, ' ').slice(0, 320)}…`).join('\n') + '\n'
    : '';

  if (lang === 'en') {
    return `You are the lead astrologer of "Luz Estelar Oficial". Write ${firstName}'s personalized daily reading for ${date}. This is a premium chart-level reading, not a generic sign horoscope — it must feel like you wrote it for them after looking at their chart this morning.

THEIR NATAL SNAPSHOT (personal points):
${natalLines}
${ascLine}

TODAY'S SKY (${date}):
${transitsLines}

TODAY'S KEY ASPECTS TO THEIR CHART (tightest first):
${aspectsLines}
${recentMemoryEn}
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
${recentMemoryEs}
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

  // Gemini 2.5 Pro requires thinking mode (Google enforces it server-
  // side; thinkingBudget: 0 returns 400 "Budget 0 is invalid"). Flash
  // supports thinking optionally — we disable it there for speed.
  // The trick is that maxOutputTokens in Gemini 2.5 covers BOTH
  // thinking tokens AND visible-text tokens combined. So we need:
  //   maxOutputTokens >= thinkingBudget + expected_visible_tokens
  // For a 280-360 word reading (~500 visible tokens) + a small
  // thinking budget, 4500 total is a comfortable ceiling.
  // At Pro output pricing ($5/M) a full-ceiling call is ~$0.022;
  // realistic calls land much lower because Gemini stops at the
  // natural end of the reading.
  const isPro = /pro$/i.test(model);
  const thinkingConfig = isPro
    ? { thinkingBudget: 512 }   // minimum viable for Pro; won't starve output
    : { thinkingBudget: 0 };     // Flash: no thinking at all

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: isPro ? 4500 : 1800,
          thinkingConfig,
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
    // Defensive parse: Gemini 2.5 can return multiple parts, some
    // marked as `thought` (internal reasoning). We want only the
    // final visible text. Parts with `thought: true` are skipped;
    // remaining text parts are concatenated in order. If thinking
    // was disabled successfully via thinkingConfig, parts[] is just
    // one { text } object and this reduces to the old behaviour.
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .filter(p => p && !p.thought && typeof p.text === 'string')
      .map(p => p.text)
      .join('')
      .trim();
    const usage = json?.usageMetadata || {};
    if (!text) {
      // Surface the finishReason so D1 error logs are diagnostic —
      // "MAX_TOKENS" vs "SAFETY" vs "OTHER" tells us what actually
      // went wrong instead of the generic "empty_response".
      const reason = json?.candidates?.[0]?.finishReason || 'unknown';
      return { ok: false, error: `empty_response (finish=${reason})`, latency };
    }
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

// ── DeepSeek fallback (2026-07-07) ───────────────────────────────────────
// El free tier de Gemini Pro se agota (hoy: las 4 llaves con quota exceeded a
// mediodía — el pipeline matutino consume la misma cuota) y el suscriptor
// premium caía al texto genérico de su signo. DeepSeek es API PAGADA (fiable,
// con tope de gasto) — probado en la tarea real: 15s, 321 palabras, aspectos
// correctos. Cadena: Gemini Pro (gratis) → DeepSeek-Reasoner → sign_level.
async function callDeepSeek({ apiKey, model, prompt, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      }),
    });
    const latency = Date.now() - started;
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return { ok: false, status: r.status, error: body.slice(0, 500), latency };
    }
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, error: 'empty_deepseek_response', latency };
    return {
      ok: true, text, latency,
      tokensIn: j.usage?.prompt_tokens, tokensOut: j.usage?.completion_tokens,
    };
  } catch (e) {
    const latency = Date.now() - started;
    if (e.name === 'AbortError') return { ok: false, error: 'timeout', latency };
    return { ok: false, error: String(e).slice(0, 300), latency };
  } finally {
    clearTimeout(timer);
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

  // ── Cross-day memory: the last few readings, so we don't echo them ──
  // The rows already live in D1 (cached per profile/date). Non-fatal:
  // if this fails we just generate without memory.
  let recentTexts = [];
  try {
    const recentRows = await DB
      .prepare("SELECT reading_json FROM ondemand_generations WHERE profile_id = ? AND reading_date < ? AND status = 'ok' AND lang = ? ORDER BY reading_date DESC LIMIT 3")
      .bind(profileId, dateKey, lang)
      .all();
    for (const row of (recentRows?.results || [])) {
      try {
        const rj = JSON.parse(row.reading_json);
        if (rj?.text) recentTexts.push(String(rj.text));
      } catch { /* skip malformed row */ }
    }
  } catch (e) {
    console.warn('[on-demand] recent readings fetch failed (non-fatal):', e.message);
  }

  // ── Build prompt + call Gemini 2.5 Pro ───────────────────────────
  const prompt = buildPrompt({
    profile, natalPlanets, natalAsc,
    transitPositions, keyAspects,
    date: dateKey, lang, recentTexts,
  });

  let model = DEFAULT_MODEL;
  let res = await callGemini({
    apiKey: GEMINI_API_KEY,
    model,
    prompt,
    timeoutMs: GEMINI_TIMEOUT_MS,
  });

  // 2026-07-07: si Gemini falla (quota del free tier, timeout, 5xx), intenta
  // DeepSeek-Reasoner antes de degradar al texto genérico. `model` queda
  // registrado en la fila → telemetría de qué proveedor sirvió cada lectura.
  if (!res.ok && context.env.DEEPSEEK_API_KEY) {
    const dsModel = context.env.DEEPSEEK_FALLBACK_MODEL || 'deepseek-reasoner';
    const ds = await callDeepSeek({
      apiKey: context.env.DEEPSEEK_API_KEY,
      model: dsModel,
      prompt,
      timeoutMs: 90000,
    });
    if (ds.ok) {
      res = ds;
      model = dsModel;
    }
  }

  if (!res.ok) {
    // Record the failure for the admin dashboard. Use INSERT OR IGNORE
    // so we NEVER overwrite a previously-successful row for this
    // (profile, date) — if another request already landed an 'ok' row,
    // theirs wins and ours is silently dropped. This is the right
    // asymmetry: a success is the canonical outcome, an error is a
    // best-effort diagnostic.
    const status = res.error === 'timeout' ? 'timeout' : 'gemini_error';
    try {
      await DB.prepare(
        `INSERT OR IGNORE INTO ondemand_generations
          (user_id, profile_id, reading_date, lang, model, reading_json, latency_ms, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        user.sub, profileId, dateKey, lang, model, '{}',
        res.latency || null, status, String(res.error).slice(0, 500)
      ).run();
    } catch { /* persist is best-effort; never block the fallback response */ }
    return Response.json(
      { ok: false, error: status, fallback: 'sign_level' },
      { status: 502 }
    );
  }

  // ── Persist + return ─────────────────────────────────────────────
  // Use ON CONFLICT DO UPDATE so a successful call always wins over
  // any previously-recorded error row for the same (profile, date).
  // This is critical: before this fix, a single gemini_error row left
  // behind by a transient failure (e.g. invalid API key, temporary
  // Gemini 5xx, timeout) would PERMANENTLY block every future retry
  // that same day because of the UNIQUE constraint. The success-upsert
  // pattern recovers automatically — first working call lands the 'ok'
  // row and also clears the diagnostic, so the dedup check at the top
  // of the handler works normally on subsequent requests.
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
        (user_id, profile_id, reading_date, lang, model, reading_json,
         tokens_in, tokens_out, latency_ms, cost_usd, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', NULL)
       ON CONFLICT(profile_id, reading_date) DO UPDATE SET
         user_id       = excluded.user_id,
         lang          = excluded.lang,
         model         = excluded.model,
         reading_json  = excluded.reading_json,
         tokens_in     = excluded.tokens_in,
         tokens_out    = excluded.tokens_out,
         latency_ms    = excluded.latency_ms,
         cost_usd      = excluded.cost_usd,
         status        = 'ok',
         error_message = NULL,
         created_at    = datetime('now')`
    ).bind(
      user.sub, profileId, dateKey, lang, model,
      JSON.stringify(reading),
      res.tokensIn, res.tokensOut, res.latency, cost,
    ).run();
  } catch (e) {
    // The UPSERT handles the common race + error-overwrite cases, so
    // hitting this catch means something rarer (D1 unreachable mid-
    // request, schema drift, etc.). Still return the reading we
    // generated — the user's experience shouldn't suffer.
    console.warn('[on-demand] persist failed:', e.message);
  }

  return Response.json({ ok: true, reading, cached: false });
}
