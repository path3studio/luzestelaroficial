/**
 * Luz Estelar — Plus por Google Play (dentro de la app Android).
 *
 * La app es una Trusted Web Activity: la web pone html.is-twa al abrirse dentro de ella.
 * Google Play no permite cobrar con Stripe desde la app, así que aquí se cobra con su caja:
 *   · Digital Goods API  → precios reales (getDetails) y compras existentes (listPurchases)
 *   · PaymentRequest con el método https://play.google.com/billing → hoja de compra de Play
 *   · el purchaseToken va a /api/billing/google-play/verify, que lo comprueba con Google,
 *     lo reconoce y marca la cuenta como Plus (igual que Stripe en la web).
 *
 * Si la sonda falla (Chrome viejo, app sin la extensión de facturación, navegador normal)
 * NO se añade html.twa-pay y todo lo de Plus sigue oculto dentro de la app, como hasta ahora.
 * Fuera de la app no hace nada: Stripe sigue igual.
 *
 * Productos en Play Console (mismos IDs que en functions/_shared/google-play.js):
 *   plus_mensual · plus_anual  (cada uno con su oferta de 7 días gratis para cuentas nuevas)
 *
 *   LuzEstelar.PlayBilling.ready        → Promise<boolean>
 *   LuzEstelar.PlayBilling.disponible() → true cuando la caja de Play responde
 *   LuzEstelar.PlayBilling.detalles()   → {monthly:{...}, annual:{...}} con precio y prueba gratis
 *   LuzEstelar.PlayBilling.comprar('annual'|'monthly') → {ok, entitled, ...}
 *   LuzEstelar.PlayBilling.restaurar()  → revisa compras previas en este Google y las vincula
 * Evento: document 'le:playbilling' {detail:{disponible}} cuando termina la sonda.
 */
(function(){
  'use strict';
  var ns = (window.LuzEstelar = window.LuzEstelar || {});
  if (ns.PlayBilling) return;

  var METODO = 'https://play.google.com/billing';
  var SKUS = { monthly: 'plus_mensual', annual: 'plus_anual' };
  var html = document.documentElement;
  var service = null, listo = false, disponible = false, detallesCache = null;

  function esTwa(){ return html.classList.contains('is-twa'); }

  function fin(ok){
    listo = true;
    disponible = !!ok;
    if (ok) html.classList.add('twa-pay');
    try { document.dispatchEvent(new CustomEvent('le:playbilling', { detail: { disponible: disponible } })); } catch (e) {}
  }

  // Tres condiciones para vender dentro de la app: (1) la caja de Play responde,
  // (2) el servidor puede verificar compras (cuenta de servicio configurada) y
  // (3) Play conoce al menos uno de los dos productos. Si falla cualquiera, Plus
  // sigue oculto: nadie debe pagar sin que el servidor pueda darle Plus.
  var ready = (async function(){
    if (!esTwa() || !('getDigitalGoodsService' in window) || !window.PaymentRequest) { fin(false); return false; }
    try {
      service = await window.getDigitalGoodsService(METODO);
      if (!service) { fin(false); return false; }
      var r = await fetch('/api/billing/google-play/verify', { credentials: 'same-origin', cache: 'no-store' });
      var j = await r.json().catch(function(){ return {}; });
      if (!j || !j.ready) { service = null; fin(false); return false; }
      var d = await detalles();
      var hay = !!(d && ((d.monthly && d.monthly.price) || (d.annual && d.annual.price)));
      if (!hay) { service = null; }
      fin(hay);
    } catch (e) {
      service = null;
      fin(false);
    }
    return disponible;
  })();

  function getToken(){ try { return localStorage.getItem('le_token'); } catch (e) { return null; } }
  function authFetch(url, opts){
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = opts.headers || {};
    opts.headers['Content-Type'] = 'application/json';
    var t = getToken();
    if (t) opts.headers['Authorization'] = 'Bearer ' + t;
    return fetch(url, opts);
  }

  function formatear(precio){
    if (!precio || !precio.currency) return '';
    var v = Number(precio.value);
    try {
      return new Intl.NumberFormat(navigator.language || 'es-MX', { style: 'currency', currency: precio.currency, maximumFractionDigits: 2 }).format(v);
    } catch (e) {
      return precio.value + ' ' + precio.currency;
    }
  }

  // Detalles de los dos productos; cacheados mientras dure la página.
  async function detalles(){
    if (listo) await ready;
    if (!service) return null;
    if (detallesCache) return detallesCache;
    var items = await service.getDetails([SKUS.monthly, SKUS.annual]);
    var out = {};
    (items || []).forEach(function(it){
      if (!it || !it.itemId) return;
      var cad = it.itemId === SKUS.annual ? 'annual' : (it.itemId === SKUS.monthly ? 'monthly' : null);
      if (!cad) return;
      out[cad] = {
        itemId: it.itemId,
        title: it.title || '',
        price: it.price || null,                 // {currency, value} del cobro recurrente
        freeTrialPeriod: it.freeTrialPeriod || '', // 'P1W' si hay 7 días gratis para esta cuenta
        subscriptionPeriod: it.subscriptionPeriod || ''
      };
    });
    detallesCache = out;
    return out;
  }

  async function verificar(purchaseToken, productId){
    var res = await authFetch('/api/billing/google-play/verify', {
      method: 'POST',
      body: JSON.stringify({ purchaseToken: purchaseToken, productId: productId })
    });
    var data = await res.json().catch(function(){ return {}; });
    data.status = res.status;
    return data;
  }

  // Abre la hoja de compra de Google Play y, al volver, verifica en el servidor.
  // Lanza AbortError si la persona cierra la hoja sin comprar.
  async function comprar(cadence){
    await ready;
    if (!disponible) throw new Error('Google Play no está disponible en esta app');
    var sku = SKUS[cadence] || SKUS.annual;
    var req = new PaymentRequest(
      [{ supportedMethods: METODO, data: { sku: sku } }],
      { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } } // obligatorio, Play lo ignora
    );
    var resp = await req.show();
    var token = (resp.details && (resp.details.purchaseToken || resp.details.token)) || '';
    var r;
    try {
      r = await verificar(token, sku);
    } catch (e) {
      r = { ok: false, error: 'No se pudo verificar la compra. Vuelve a abrir la app: se restaurará sola.' };
    }
    try { await resp.complete(r.ok ? 'success' : 'fail'); } catch (e) {}
    r.productId = sku;
    r.cadence = cadence;
    return r;
  }

  // Compras ya hechas en este Google (reinstalación, otro teléfono, verificación que falló):
  // cada token se manda al servidor, que lo vincula a la cuenta actual si no es de otra.
  async function restaurar(){
    await ready;
    if (!service) return { premium: false };
    var KEY = 'le_play_restaurado';
    try { if (sessionStorage.getItem(KEY) === '1') return { premium: false, repetido: true }; } catch (e) {}
    var compras = [];
    try { compras = await service.listPurchases(); } catch (e) { return { premium: false }; }
    var premium = false, sinSesion = false;
    for (var i = 0; i < (compras || []).length; i++) {
      var c = compras[i];
      if (!c || !c.purchaseToken) continue;
      if (c.itemId !== SKUS.monthly && c.itemId !== SKUS.annual) continue;
      try {
        var r = await verificar(c.purchaseToken, c.itemId);
        if (r.status === 401) { sinSesion = true; break; }
        if (r.ok && r.entitled) premium = true;
      } catch (e) {}
    }
    if (!sinSesion) { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }
    return { premium: premium, compras: (compras || []).length };
  }

  ns.PlayBilling = {
    METODO: METODO,
    SKUS: SKUS,
    ready: ready,
    esTwa: esTwa,
    listo: function(){ return listo; },
    disponible: function(){ return disponible; },
    detalles: detalles,
    formatear: formatear,
    comprar: comprar,
    verificar: verificar,
    restaurar: restaurar
  };
})();
