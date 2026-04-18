/**
 * GET /api/geocode?q=<place>&lang=es|en
 *
 * Server-side proxy for Nominatim (OpenStreetMap) geocoding.
 * Why proxy instead of calling directly from the browser?
 *   1. Keeps a single, identifiable User-Agent per Nominatim's usage policy
 *      ("Provide a valid HTTP Referer or User-Agent identifying the app").
 *   2. Avoids cases where client-side CSP / PWA caching / mobile blockers
 *      silently drop third-party fetches.
 *   3. Lets us cache hot queries at the edge for 24h (lowers load + latency).
 *   4. Lets us normalize output so the browser always sees a predictable shape.
 *
 * Returns: { ok: true, results: [{ name, lat, lon, country }, …] }
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'LuzEstelar/1.0 (luzestelaroficial.com; contacto@luzestelaroficial.com)';
const CACHE_TTL_SECONDS = 86400; // 24h
const MIN_Q_LENGTH = 2;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es';

  if (q.length < MIN_Q_LENGTH) {
    return Response.json({ ok: true, results: [] }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // Build Nominatim URL
  const nomUrl = new URL(NOMINATIM_BASE);
  nomUrl.searchParams.set('q', q);
  nomUrl.searchParams.set('format', 'json');
  nomUrl.searchParams.set('limit', '6');
  nomUrl.searchParams.set('addressdetails', '1');
  nomUrl.searchParams.set('accept-language', lang);

  try {
    const upstream = await fetch(nomUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Accept-Language': lang,
      },
      // Cloudflare edge cache
      cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
    });

    if (!upstream.ok) {
      return Response.json({
        ok: false,
        error: 'upstream_' + upstream.status,
        results: [],
      }, { status: 200 });
    }

    const raw = await upstream.json();
    const results = Array.isArray(raw) ? raw.map(normalize).filter(Boolean) : [];

    return Response.json({ ok: true, results }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (e) {
    return Response.json({
      ok: false,
      error: 'network_error',
      detail: String(e).slice(0, 160),
      results: [],
    }, { status: 200 });
  }
}

function normalize(item) {
  if (!item || typeof item.lat !== 'string' || typeof item.lon !== 'string') return null;
  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const display = (item.display_name || '').split(',').map(s => s.trim()).filter(Boolean);
  const short = display.slice(0, 3).join(', ');
  const country = (item.address && (item.address.country || item.address.country_code)) || display[display.length - 1] || '';
  return {
    name: short || item.display_name || '',
    lat,
    lon,
    country: String(country),
  };
}
