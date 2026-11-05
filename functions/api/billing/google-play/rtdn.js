/**
 * POST /api/billing/google-play/rtdn?token=… — Real-time developer notifications de Google Play
 * entregadas por Pub/Sub (suscripción push). Renovaciones, cancelaciones, pausas, reembolsos…
 *
 * Seguridad: Pub/Sub no firma el cuerpo; el endpoint exige ?token= igual a GOOGLE_PLAY_RTDN_TOKEN
 * (la URL con el token se pega en la suscripción push de Pub/Sub, no en el chat ni en el repo).
 * Ante cualquier aviso NO confiamos en el contenido: volvemos a consultar subscriptionsv2.get
 * y guardamos lo que diga Google. Siempre devolvemos 200 (si no, Pub/Sub reintenta sin fin),
 * salvo con token incorrecto.
 */
import { syncPurchaseToken, notifyTelegram } from '../../../_shared/google-play.js';

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const expected = env.GOOGLE_PLAY_RTDN_TOKEN;
  if (!expected || !safeEqual(url.searchParams.get('token') || '', expected)) {
    return new Response('forbidden', { status: 403 });
  }

  let envelope;
  try { envelope = await request.json(); } catch { return new Response('bad json', { status: 200 }); }
  const data64 = envelope?.message?.data;
  if (!data64) return new Response('no data', { status: 200 });

  let note;
  try {
    note = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data64), (c) => c.charCodeAt(0))));
  } catch { return new Response('bad payload', { status: 200 }); }

  const expectedPkg = env.GOOGLE_PLAY_PACKAGE || 'com.luzestelaroficial.app';
  if (note.packageName && note.packageName !== expectedPkg) return new Response('other app', { status: 200 });

  // Marca en KV de la última notificación (los logs de Pages no se conservan):
  //   npx wrangler kv key get google_play:rtdn_last --binding AUTH_KV
  const marca = (tipo, extra) => env.AUTH_KV
    ? env.AUTH_KV.put('google_play:rtdn_last', JSON.stringify({ at: new Date().toISOString(), tipo, ...extra }), { expirationTtl: 30 * 86400 }).catch(() => {})
    : Promise.resolve();

  if (note.testNotification) {
    console.log(JSON.stringify({ event: 'google_play_rtdn_test', version: note.testNotification.version }));
    await marca('test', { version: note.testNotification.version });
    return new Response('ok', { status: 200 });
  }

  const sn = note.subscriptionNotification;
  const vn = note.voidedPurchaseNotification;
  try {
    if (sn && sn.purchaseToken) {
      const r = await syncPurchaseToken(env, sn.purchaseToken, sn.subscriptionId);
      console.log(JSON.stringify({
        event: 'google_play_rtdn', type: sn.notificationType, product: sn.subscriptionId,
        known: r.known, status: r.summary?.status, entitled: r.summary?.entitled,
      }));
      await marca('subscription', { notificationType: sn.notificationType, product: sn.subscriptionId, known: r.known, status: r.summary?.status });
      // 3 cancelada · 12 revocada · 13 expirada → aviso corto al dueño (sin PII)
      if (r.known && [3, 12, 13].includes(Number(sn.notificationType))) {
        const label = { 3: 'canceló la renovación', 12: 'fue revocada/reembolsada', 13: 'expiró' }[sn.notificationType];
        await notifyTelegram(env, `📉 <b>Plus por Google Play</b>: una suscripción ${label} (${sn.subscriptionId}).`);
      }
    } else if (vn && vn.purchaseToken) {
      const r = await syncPurchaseToken(env, vn.purchaseToken, null).catch(() => ({ known: false }));
      console.log(JSON.stringify({ event: 'google_play_voided', known: r.known, order: vn.orderId }));
    }
  } catch (e) {
    // Lo dejamos legible en KV (los logs de Pages no se retienen) y respondemos 200.
    console.error('google-play rtdn:', e.message);
    if (env.AUTH_KV) {
      await env.AUTH_KV.put('webhook_error:last', JSON.stringify({
        at: new Date().toISOString(), type: 'google_play_rtdn', error: String(e.message || e).slice(0, 300),
      }), { expirationTtl: 30 * 86400 }).catch(() => {});
    }
  }
  return new Response('ok', { status: 200 });
}
