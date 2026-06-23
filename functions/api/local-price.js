/**
 * GET /api/local-price[?country=XX]
 *
 * Returns the visitor's country, the local currency we'd display for it, and
 * the USD→currency exchange rate. Used by /js/local-price.js to show an
 * APPROXIMATE local price on the pricing pages (consulta.html, planes.html).
 *
 * Why approximate: Stripe Adaptive Pricing charges the EXACT local amount at
 * checkout (already enabled on the account). This endpoint only powers the
 * on-page estimate so the visitor isn't first shown a foreign (USD) sticker.
 * We apply a small BUFFER so the displayed estimate trends slightly ABOVE
 * Stripe's converted charge — never below — to avoid a "charged more than
 * shown" surprise. The label on the page says "≈ … pagas el monto exacto en
 * tu moneda al confirmar".
 *
 * Country comes from Cloudflare (request.cf.country) for free; ?country=XX
 * overrides it for testing. FX rates are fetched once and cached 24h in KV.
 */

// Only LATAM/relevant markets with their OWN stable-ish currency. Countries
// that already transact in USD (EC, SV, PA, PR) or with volatile currencies
// we'd rather not quote (VE) are intentionally absent → they fall back to USD.
const COUNTRY_CURRENCY = {
  MX: 'MXN', CO: 'COP', AR: 'ARS', CL: 'CLP', PE: 'PEN',
  UY: 'UYU', BO: 'BOB', PY: 'PYG', GT: 'GTQ', HN: 'HNL',
  NI: 'NIO', CR: 'CRC', DO: 'DOP', BR: 'BRL', ES: 'EUR',
};

const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const FX_KV_KEY = 'fx_usd_rates_v1';
const FX_TTL_S = 86400;   // refresh rates daily
const BUFFER = 1.03;      // display ~3% above mid-market so it never reads below Stripe's charge

function json(obj, maxAge = 3600) {
  return new Response(JSON.stringify(obj), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${maxAge}`,
    },
  });
}

async function getRates(env) {
  // Try KV cache first
  try {
    const cached = await env.AUTH_KV.get(FX_KV_KEY, 'json');
    if (cached && cached.rates && (Date.now() - cached.ts) < FX_TTL_S * 1000) {
      return cached.rates;
    }
  } catch (_) { /* KV miss is fine */ }

  // Fetch fresh
  try {
    const r = await fetch(FX_URL, { cf: { cacheTtl: FX_TTL_S } });
    const j = await r.json();
    if (j && j.result === 'success' && j.rates) {
      try {
        await env.AUTH_KV.put(
          FX_KV_KEY,
          JSON.stringify({ ts: Date.now(), rates: j.rates }),
          { expirationTtl: FX_TTL_S },
        );
      } catch (_) { /* best-effort cache write */ }
      return j.rates;
    }
  } catch (_) { /* network error → fall through to USD */ }
  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const country = (
    url.searchParams.get('country') ||
    request.cf?.country ||
    request.headers.get('CF-IPCountry') ||
    'US'
  ).toUpperCase();

  const currency = COUNTRY_CURRENCY[country] || 'USD';

  // No localization needed (or wanted) → tell the client to keep USD as-is.
  if (currency === 'USD') {
    return json({ ok: true, country, currency: 'USD', rate: 1, buffer: 1 });
  }

  const rates = await getRates(env);
  const rate = rates && rates[currency];
  if (!rate || !isFinite(rate) || rate <= 0) {
    return json({ ok: true, country, currency: 'USD', rate: 1, buffer: 1 }); // graceful fallback
  }

  return json({ ok: true, country, currency, rate, buffer: BUFFER });
}
