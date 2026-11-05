/**
 * POST /api/billing/google-play/verify — la web, dentro de la app Android, acaba de comprar
 * (o quiere restaurar) la suscripción Plus en la caja de Google Play y nos manda el purchaseToken.
 *
 * Body: { purchaseToken, productId }
 *   · verificamos el token con la Play Developer API (nunca nos fiamos del cliente),
 *   · lo reconocemos (acknowledge) si hace falta,
 *   · lo guardamos en D1 y marcamos al usuario como Plus (igual que el webhook de Stripe),
 *   · un token solo puede pertenecer a UNA cuenta de Luz Estelar (409 si ya es de otra).
 */
import {
  PLAY_PRODUCTS, getSubscription, acknowledgeSubscription, applySubscription,
  findByToken, notifyTelegram,
} from '../../../_shared/google-play.js';

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const { env } = context;
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT) {
    return Response.json({ ok: false, error: 'Compras por Google Play no configuradas' }, { status: 503 });
  }

  const body = await context.request.json().catch(() => ({}));
  const purchaseToken = String(body.purchaseToken || '').trim();
  const productId = String(body.productId || '').trim();
  if (!purchaseToken || purchaseToken.length > 1024) {
    return Response.json({ ok: false, error: 'purchaseToken requerido' }, { status: 400 });
  }
  if (productId && !PLAY_PRODUCTS[productId]) {
    return Response.json({ ok: false, error: 'Producto desconocido' }, { status: 400 });
  }

  // Un token = una cuenta. Si ya está ligado a otra persona, no se transfiere.
  const existing = await findByToken(env.DB, purchaseToken);
  if (existing && existing.user_id !== user.sub) {
    return Response.json({ ok: false, error: 'Esta compra ya está vinculada a otra cuenta de Luz Estelar' }, { status: 409 });
  }

  let sub;
  try {
    sub = await getSubscription(env, purchaseToken);
  } catch (e) {
    console.error('google-play verify:', e.message);
    const status = e.status === 404 || e.status === 400 ? 400 : 502;
    return Response.json({ ok: false, error: status === 400 ? 'Compra no encontrada en Google Play' : 'No se pudo verificar con Google Play' }, { status });
  }

  const items = Array.isArray(sub.lineItems) ? sub.lineItems : [];
  const boughtProduct = items[0]?.productId || productId;
  if (!PLAY_PRODUCTS[boughtProduct]) {
    return Response.json({ ok: false, error: 'La compra no corresponde a Plus' }, { status: 400 });
  }

  const result = await applySubscription(env, user.sub, purchaseToken, sub, boughtProduct);
  const s = result.summary;

  let acknowledged = s.acknowledged;
  if (!acknowledged && s.entitled) {
    try {
      await acknowledgeSubscription(env, boughtProduct, purchaseToken);
      acknowledged = true;
    } catch (e) {
      // No fatal para el usuario: RTDN / el refresco de status lo reintenta.
      console.warn('google-play acknowledge:', e.message);
    }
  }

  if (result.created && s.entitled) {
    const when = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
    await notifyTelegram(env, [
      `🤖 <b>Plus por Google Play</b>${s.isTest ? ' (compra de PRUEBA, sin cobro)' : ''}`,
      `${boughtProduct === 'plus_anual' ? 'Anual' : 'Mensual'} · ${s.status}`,
      `<i>${(user.email || 'sin correo').replace(/</g, '&lt;')}</i>`,
      `<i>${when}</i>`,
    ].join('\n'));
    if (env.AUTH_KV) {
      await env.AUTH_KV.put('sale_notification:last', JSON.stringify({
        plan: 'premium', provider: 'google_play', cadence: s.cadence, email: user.email || '',
        order_id: s.orderId, test: s.isTest, timestamp: new Date().toISOString(),
      }), { expirationTtl: 7 * 86400 }).catch(() => {});
    }
  }

  console.log(JSON.stringify({ event: 'google_play_verify', product: boughtProduct, status: s.status, entitled: s.entitled, test: s.isTest, created: result.created }));

  return Response.json({
    ok: true,
    tier: result.tier,
    entitled: s.entitled,
    acknowledged,
    subscription: {
      provider: 'google_play',
      productId: boughtProduct,
      plan: s.plan,
      cadence: s.cadence,
      status: s.status,
      autoRenew: s.autoRenew,
      currentPeriodEnd: s.expiryTime,
      test: s.isTest,
    },
  });
}
