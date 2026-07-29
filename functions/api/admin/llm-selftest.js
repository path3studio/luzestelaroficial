/**
 * GET /api/admin/llm-selftest — ¿qué proveedor serviría una lectura Plus?
 *
 * Por qué existe (2026-07-29): la lectura diaria Plus llevaba desde siempre
 * fallando —14 de 14 generaciones con error de cuota de Gemini— porque el
 * secreto DEEPSEEK_API_KEY nunca se subió al entorno de Pages. El código sí
 * ponía DeepSeek de primario, pero estaba condicionado a esa variable, y al no
 * existir caía en silencio a un Gemini sin cuota. Nadie se enteró porque la
 * única forma de comprobarlo era esperar a que un suscriptor abriera su lectura.
 *
 * Eso es inaceptable como método de verificación. Este endpoint hace la misma
 * pregunta sin necesitar un cliente: manda un prompt mínimo por la MISMA ruta
 * de selección de proveedor y responde quién contestó.
 *
 * NO escribe en D1, NO toca datos de ningún usuario y NO consume la cuota
 * diaria de nadie: es una llamada suelta de pocos tokens.
 *
 * Auth: Bearer ADMIN_TOKEN (mismo patrón que el resto de /api/admin/*).
 *
 * Uso:
 *   curl -sL -H "Authorization: Bearer $ADMIN_TOKEN" \
 *        https://luzestelaroficial.com/api/admin/llm-selftest
 */

const PROMPT = 'Responde únicamente con la palabra: OK';

async function probeDeepSeek(apiKey, model, timeoutMs = 60000) {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: PROMPT }],
        // Los modelos de razonamiento gastan tope ANTES de emitir texto:
        // con un tope pequeño devuelven content vacío y parecen caídos.
        max_tokens: 3000,
        temperature: 0,
      }),
    });
    const latency = Date.now() - t0;
    if (!r.ok) {
      return { ok: false, error: `http_${r.status}`, latency };
    }
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) return { ok: false, error: 'empty_response', latency };
    return { ok: true, latency, sample: text.slice(0, 40) };
  } catch (e) {
    return { ok: false, error: String(e?.name || e).slice(0, 40), latency: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

async function probeGemini(apiKey, model, timeoutMs = 30000) {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        signal: ac.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }] }],
          generationConfig: { maxOutputTokens: 400, temperature: 0 },
        }),
      },
    );
    const latency = Date.now() - t0;
    if (!r.ok) {
      let quota = false;
      try {
        const body = await r.text();
        quota = r.status === 429 || /quota/i.test(body);
      } catch { /* cuerpo ilegible: nos quedamos con el código */ }
      return { ok: false, error: quota ? 'quota_exceeded' : `http_${r.status}`, latency };
    }
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!text) return { ok: false, error: 'empty_response', latency };
    return { ok: true, latency, sample: text.slice(0, 40) };
  } catch (e) {
    return { ok: false, error: String(e?.name || e).slice(0, 40), latency: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const { ADMIN_TOKEN } = env;

  if (!ADMIN_TOKEN) {
    return Response.json({ ok: false, error: 'Admin endpoint not configured' }, { status: 503 });
  }
  const auth = context.request.headers.get('Authorization') || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (provided !== ADMIN_TOKEN) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // Lo primero que había que poder ver: ¿las Functions ven la clave?
  // Solo presencia — el valor NUNCA sale de aquí.
  const secrets_present = {
    DEEPSEEK_API_KEY: Boolean(env.DEEPSEEK_API_KEY),
    GEMINI_API_KEY: Boolean(env.GEMINI_API_KEY),
    ENABLE_ONDEMAND_READINGS: Boolean(env.ENABLE_ONDEMAND_READINGS),
  };

  const dsModel = env.DEEPSEEK_FALLBACK_MODEL || 'deepseek-reasoner';
  const geminiModel = 'gemini-2.5-pro';   // DEFAULT_MODEL de on-demand.js

  const providers = {};
  if (env.DEEPSEEK_API_KEY) {
    providers[dsModel] = await probeDeepSeek(env.DEEPSEEK_API_KEY, dsModel);
  } else {
    providers[dsModel] = { ok: false, error: 'secret_missing', latency: 0 };
  }
  if (env.GEMINI_API_KEY) {
    providers[geminiModel] = await probeGemini(env.GEMINI_API_KEY, geminiModel);
  } else {
    providers[geminiModel] = { ok: false, error: 'secret_missing', latency: 0 };
  }

  // Misma precedencia que on-demand.js: DeepSeek primero, Gemini de respaldo.
  const served_by = providers[dsModel].ok
    ? dsModel
    : (providers[geminiModel].ok ? geminiModel : null);

  return Response.json({
    ok: Boolean(served_by),
    served_by,
    verdict: served_by === dsModel
      ? `✅ Una lectura Plus la generaría ${dsModel} (el primario correcto).`
      : served_by
        ? `⚠️ El primario ${dsModel} NO responde; serviría el respaldo ${served_by}.`
        : '🚨 NINGÚN proveedor responde — una lectura Plus fallaría ahora mismo.',
    secrets_present,
    providers,
    checked_at: new Date().toISOString(),
  });
}
