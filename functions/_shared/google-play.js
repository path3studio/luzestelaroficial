/**
 * Google Play — suscripción Plus comprada dentro de la app Android (Trusted Web Activity).
 *
 * La web, dentro de la app, cobra con la caja de Google Play (Digital Goods API +
 * PaymentRequest) y nos manda el purchaseToken. Aquí:
 *   · obtenemos un token de acceso con la cuenta de servicio (JWT RS256 firmado con WebCrypto),
 *   · consultamos purchases.subscriptionsv2.get para saber el estado REAL de la compra,
 *   · la reconocemos (acknowledge) — si no, Play la reembolsa a los 3 días,
 *   · y la guardamos en D1 igual que una suscripción de Stripe (tabla subscriptions,
 *     provider = 'google_play') marcando users.tier = premium/free.
 *
 * Secretos (Pages → Settings → Variables, nunca en el repo):
 *   GOOGLE_PLAY_SERVICE_ACCOUNT  — el JSON completo de la cuenta de servicio con acceso
 *                                  a la app en Play Console (Usuarios y permisos).
 *   GOOGLE_PLAY_RTDN_TOKEN       — cadena secreta que Pub/Sub manda en ?token= al endpoint RTDN.
 *   GOOGLE_PLAY_PACKAGE          — opcional; por defecto com.luzestelaroficial.app.
 *
 * Productos de Play Console (IDs fijos; la web usa los mismos en js/play-billing.js):
 *   plus_mensual → cadence monthly · plus_anual → cadence annual
 */

export const PACKAGE_NAME_DEFAULT = 'com.luzestelaroficial.app';

export const PLAY_PRODUCTS = {
  plus_mensual: { plan: 'premium', cadence: 'monthly' },
  plus_anual:   { plan: 'premium', cadence: 'annual' },
};

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const TOKEN_KV_KEY = 'google_play:access_token';

// ── Cuenta de servicio → token de acceso ───────────────────────────────

function b64url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem) {
  const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function readServiceAccount(env) {
  const raw = env.GOOGLE_PLAY_SERVICE_ACCOUNT;
  if (!raw) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT no configurado');
  const sa = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!sa.client_email || !sa.private_key) throw new Error('cuenta de servicio incompleta');
  return sa;
}

export async function getAccessToken(env) {
  const kv = env.AUTH_KV;
  if (kv) {
    try {
      const cached = await kv.get(TOKEN_KV_KEY, 'json');
      if (cached && cached.token && cached.exp > Math.floor(Date.now() / 1000) + 120) return cached.token;
    } catch (_) { /* sin caché */ }
  }
  const sa = readServiceAccount(env);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat, exp,
  }));
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error('token de Google: ' + (data.error_description || data.error || res.status));
  }
  if (kv) {
    // Una escritura por hora como mucho (el KV gratuito tiene 1.000 escrituras/día).
    const ttl = Math.max(300, (data.expires_in || 3600) - 60);
    await kv.put(TOKEN_KV_KEY, JSON.stringify({ token: data.access_token, exp: iat + ttl }), { expirationTtl: ttl }).catch(() => {});
  }
  return data.access_token;
}

// ── Play Developer API ─────────────────────────────────────────────────

function pkg(env) { return env.GOOGLE_PLAY_PACKAGE || PACKAGE_NAME_DEFAULT; }

/** purchases.subscriptionsv2.get — estado real de la suscripción para un purchaseToken. */
export async function getSubscription(env, purchaseToken) {
  const token = await getAccessToken(env);
  const url = `${API}/${pkg(env)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error('Play API ' + res.status + ': ' + (data.error?.message || 'error'));
    err.status = res.status;
    throw err;
  }
  return data;
}

/** purchases.subscriptions.acknowledge — obligatorio en los 3 días siguientes a la compra. */
export async function acknowledgeSubscription(env, productId, purchaseToken) {
  const token = await getAccessToken(env);
  const url = `${API}/${pkg(env)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ developerPayload: 'luzestelar' }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error('acknowledge ' + res.status + ': ' + (data.error?.message || 'error'));
  }
  return true;
}

// ── Interpretación del estado ──────────────────────────────────────────

/**
 * Resume la respuesta de subscriptionsv2 en lo que guardamos en D1.
 *   entitled: true mientras la persona tenga acceso (activa, en periodo de gracia o
 *             cancelada pero aún dentro del periodo pagado).
 */
export function summarize(sub) {
  const items = Array.isArray(sub.lineItems) ? sub.lineItems : [];
  const item = items[0] || {};
  const productId = item.productId || null;
  const expiry = item.expiryTime ? new Date(item.expiryTime) : null;
  const now = new Date();
  const state = sub.subscriptionState || 'SUBSCRIPTION_STATE_UNSPECIFIED';
  const autoRenew = !!(item.autoRenewingPlan && item.autoRenewingPlan.autoRenewEnabled);
  const liveStates = new Set([
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
    'SUBSCRIPTION_STATE_CANCELED',
  ]);
  const entitled = liveStates.has(state) && !!expiry && expiry > now;

  let status;
  switch (state) {
    case 'SUBSCRIPTION_STATE_ACTIVE': status = 'active'; break;
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD': status = 'past_due'; break;
    case 'SUBSCRIPTION_STATE_CANCELED': status = entitled ? 'canceled' : 'expired'; break;
    case 'SUBSCRIPTION_STATE_ON_HOLD': status = 'on_hold'; break;
    case 'SUBSCRIPTION_STATE_PAUSED': status = 'paused'; break;
    case 'SUBSCRIPTION_STATE_EXPIRED': status = 'expired'; break;
    case 'SUBSCRIPTION_STATE_PENDING': status = 'pending'; break;
    default: status = 'unknown';
  }

  return {
    productId,
    cadence: (PLAY_PRODUCTS[productId] || {}).cadence || 'monthly',
    plan: (PLAY_PRODUCTS[productId] || {}).plan || 'premium',
    state,
    status,
    entitled,
    autoRenew,
    startTime: sub.startTime || null,
    expiryTime: expiry ? expiry.toISOString() : null,
    orderId: sub.latestOrderId || null,
    linkedPurchaseToken: sub.linkedPurchaseToken || null,
    acknowledged: sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    isTest: !!sub.testPurchase,
    canceledAt: sub.canceledStateContext ? (sub.canceledStateContext.userInitiatedCancellation?.cancelTime || null) : null,
  };
}

// ── D1 ────────────────────────────────────────────────────────────────

export async function findByToken(DB, purchaseToken) {
  return DB.prepare(
    'SELECT id, user_id, status, plan, cadence FROM subscriptions WHERE google_purchase_token = ? LIMIT 1',
  ).bind(purchaseToken).first();
}

// 2026-11-06: accesos a Plus que no pasan por Play ni por Stripe.
//   'semillas' = suscriptores de Instagram (semillas_plus.py renueva la fila cada mañana, +35 d)
//   'regalo'   = probadores de la app (3 meses)
// Cuentan como vivos si status = 'active' y current_period_end no ha pasado. Ningún
// cambio de Play o Stripe debe quitarle Plus a quien tenga uno de estos vivo.
const SQL_ACCESO_MANUAL =
  "(provider IN ('semillas','regalo') AND status = 'active' AND current_period_end > ?)";

/** ¿Tiene el usuario Plus vivo por algo que no sea Stripe (Play, Semillas o regalo)? */
export async function hasNonStripeAccess(DB, userId) {
  const now = new Date().toISOString();
  try {
    const row = await DB.prepare(
      "SELECT 1 AS ok FROM subscriptions WHERE user_id = ? AND (" +
      "(provider = 'google_play' AND status IN ('active','past_due','canceled') AND current_period_end > ?) " +
      "OR " + SQL_ACCESO_MANUAL + ") LIMIT 1",
    ).bind(userId, now, now).first();
    return !!row;
  } catch (_) {
    return hasActiveGooglePlay(DB, userId);
  }
}

export async function hasActiveGooglePlay(DB, userId) {
  try {
    const row = await DB.prepare(
      "SELECT 1 AS ok FROM subscriptions WHERE user_id = ? AND provider = 'google_play' " +
      "AND status IN ('active','past_due','canceled') AND current_period_end > ? LIMIT 1",
    ).bind(userId, new Date().toISOString()).first();
    return !!row;
  } catch (_) {
    return false; // columnas aún sin migrar → no hay suscripciones de Play
  }
}

/**
 * Guarda/actualiza la suscripción de Play del usuario y ajusta users.tier.
 * Devuelve { row, created, summary }.
 */
export async function applySubscription(env, userId, purchaseToken, sub, productIdHint) {
  const { DB } = env;
  const now = new Date().toISOString();
  const s = summarize(sub);
  const productId = s.productId || productIdHint;
  const existing = await findByToken(DB, purchaseToken);
  let created = false;

  if (existing) {
    await DB.prepare(
      'UPDATE subscriptions SET status = ?, plan = ?, cadence = ?, ' +
      'current_period_start = COALESCE(?, current_period_start), current_period_end = ?, ' +
      'google_order_id = COALESCE(?, google_order_id), google_checked_at = ?, ' +
      "canceled_at = CASE WHEN ? IN ('canceled','expired','revoked') THEN COALESCE(canceled_at, ?) ELSE canceled_at END " +
      'WHERE id = ?',
    ).bind(
      s.status, s.plan, s.cadence, s.startTime, s.expiryTime, s.orderId, now,
      s.status, s.canceledAt || now, existing.id,
    ).run();
  } else {
    created = true;
    await DB.prepare(
      `INSERT INTO subscriptions (id, user_id, plan, cadence, status, current_period_start, current_period_end,
         trial_end, created_at, provider, google_purchase_token, google_order_id, google_product_id, google_checked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'google_play', ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), userId, s.plan, s.cadence, s.status, s.startTime || now, s.expiryTime,
      now, purchaseToken, s.orderId, productId, now,
    ).run();
    // Cambio de plan o re-suscripción: el token anterior queda sustituido.
    if (s.linkedPurchaseToken) {
      await DB.prepare(
        "UPDATE subscriptions SET status = 'replaced', canceled_at = COALESCE(canceled_at, ?) WHERE google_purchase_token = ? AND status <> 'replaced'",
      ).bind(now, s.linkedPurchaseToken).run().catch(() => {});
    }
  }

  // tier del usuario: premium si esta compra da acceso o si tiene otra viva
  // (otra de Play, Stripe, Semillas o regalo).
  // 2026-11-06: `IS NULL OR` porque las filas de Stripe/Semillas no tienen token y
  // `NULL <> ?` en SQL nunca es verdadero: antes la rama de Stripe jamás coincidía.
  let tier = s.entitled ? 'premium' : 'free';
  if (!s.entitled) {
    const other = await DB.prepare(
      "SELECT 1 AS ok FROM subscriptions WHERE user_id = ? " +
      "AND (google_purchase_token IS NULL OR google_purchase_token <> ?) " +
      "AND ((provider = 'google_play' AND status IN ('active','past_due','canceled') AND current_period_end > ?) " +
      " OR ((provider = 'stripe' OR provider IS NULL) AND status IN ('active','trialing')) " +
      " OR " + SQL_ACCESO_MANUAL + ") LIMIT 1",
    ).bind(userId, purchaseToken, now, now).first().catch(() => null);
    if (other) tier = 'premium';
  }
  await DB.prepare('UPDATE users SET tier = ?, updated_at = ? WHERE id = ?').bind(tier, now, userId).run();

  if (!s.entitled && (s.status === 'expired' || s.status === 'revoked') && existing && existing.status !== s.status) {
    try {
      await DB.prepare('INSERT INTO churn_log (kind, plan, had_active_sub) VALUES (?, ?, 1)')
        .bind('google_play_' + s.status, s.plan).run();
    } catch (_) { /* no fatal */ }
  }

  return { created, summary: s, tier, productId };
}

/**
 * Sincroniza un purchaseToken con Google (usado por RTDN y por el refresco perezoso de /status).
 * Si el token no está en D1 pero su linkedPurchaseToken sí, hereda el usuario.
 */
export async function syncPurchaseToken(env, purchaseToken, productIdHint) {
  const { DB } = env;
  let row = await findByToken(DB, purchaseToken);
  const sub = await getSubscription(env, purchaseToken);
  if (!row && sub.linkedPurchaseToken) {
    const prev = await findByToken(DB, sub.linkedPurchaseToken);
    if (prev) row = { user_id: prev.user_id };
  }
  if (!row) return { known: false, summary: summarize(sub) };
  const result = await applySubscription(env, row.user_id, purchaseToken, sub, productIdHint);
  const s = result.summary;
  if (!s.acknowledged && s.entitled && result.productId) {
    await acknowledgeSubscription(env, result.productId, purchaseToken).catch((e) => console.warn('ack:', e.message));
  }
  return { known: true, userId: row.user_id, ...result };
}

// ── Aviso por Telegram (no fatal) ──────────────────────────────────────

export async function notifyTelegram(env, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  }).catch(() => {});
}
