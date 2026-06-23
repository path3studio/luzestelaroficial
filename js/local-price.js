/**
 * local-price.js — approximate local-currency price display.
 *
 * On load, fetches /api/local-price (visitor's country → currency + USD rate),
 * then exposes window.LocalPrice so pricing pages can decorate their USD
 * prices with an estimate in the visitor's currency, e.g. "$29.99 USD ≈ MX$620".
 *
 * The estimate is intentionally slightly conservative (server applies a buffer)
 * and clearly labelled "≈"; Stripe Adaptive Pricing charges the exact local
 * amount at checkout. If the visitor is in a USD country (or anything fails),
 * LocalPrice.isLocal() stays false and pages simply keep their USD text.
 */
(function () {
  var state = { currency: 'USD', rate: 1, buffer: 1, country: 'US', ready: false };
  var callbacks = [];

  function localAmount(usd) {
    var n = typeof usd === 'number' ? usd : parseFloat(String(usd).replace(/[^0-9.]/g, ''));
    if (!isFinite(n)) return null;
    return n * state.rate * state.buffer;
  }

  function format(usd) {
    if (!state.ready || state.currency === 'USD' || state.rate === 1) return '';
    var amt = localAmount(usd);
    if (amt == null) return '';
    try {
      // Drop decimals once we're at/above 100 in the local currency — cents
      // look odd on a ~MX$500 price and Stripe rounds anyway.
      var maxFrac = amt >= 100 ? 0 : 2;
      return new Intl.NumberFormat('es', {
        style: 'currency',
        currency: state.currency,
        maximumFractionDigits: maxFrac,
        minimumFractionDigits: 0,
      }).format(amt);
    } catch (e) {
      return '';
    }
  }

  window.LocalPrice = {
    // "≈ MX$620" or "" when not localizing
    suffix: function (usd) { var s = format(usd); return s ? ('≈ ' + s) : ''; },
    format: format,
    isLocal: function () { return state.ready && state.currency !== 'USD' && state.rate !== 1; },
    currency: function () { return state.currency; },
    country: function () { return state.country; },
    // Run cb now if ready, else when the fetch resolves.
    whenReady: function (cb) { if (state.ready) cb(); else callbacks.push(cb); },
  };

  function finish() {
    state.ready = true;
    callbacks.forEach(function (cb) { try { cb(); } catch (e) {} });
    callbacks = [];
    try { document.dispatchEvent(new Event('localprice:ready')); } catch (e) {}
  }

  // Optional ?country=XX override (handy for testing the localized display
  // from anywhere; checkout still charges by real geo via Stripe).
  var qp = '';
  try {
    var c = new URLSearchParams(location.search).get('country');
    if (c && /^[A-Za-z]{2}$/.test(c)) qp = '?country=' + c.toUpperCase();
  } catch (e) {}

  fetch('/api/local-price' + qp, { headers: { accept: 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.ok) {
        state.currency = d.currency || 'USD';
        state.rate = typeof d.rate === 'number' ? d.rate : 1;
        state.buffer = typeof d.buffer === 'number' ? d.buffer : 1;
        state.country = d.country || 'US';
      }
      finish();
    })
    .catch(function () { finish(); });
})();
