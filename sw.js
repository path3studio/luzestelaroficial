/**
 * Luz Estelar Oficial — Service Worker
 * Enables offline access and installable PWA experience.
 * Strategy: Network-first with cache fallback for pages,
 * Cache-first for static assets (fonts, images, CSS).
 */

// Bumped v42 → v43 (Apr 18 p8.6): share-card pipelined + diagnostic.
// build() now runs as five discrete phases (Fondo → Texto → Carta →
// Detalles → Codificando) with a setTimeout(0) yield between each,
// and a progress callback updates the share button's label at each
// phase. This gives two things at once: (a) the browser actually
// paints the "in progress" label between steps so the user sees the
// work happening, and (b) if a phase hangs on their specific device,
// the button freezes on that phase's label — instant diagnosis.
// Also: the chart is now drawn via ctx.drawImage() from the already
// painted on-screen natal canvas instead of re-rendering offscreen,
// skipping the single heaviest sync block in the old pipeline.
// share-card.js bumped to ?v=6.
// Bumped v41 → v42 (Apr 18 p8.5): share-card reliability, round 3.
// The "Ver en Mapa Estelar" CTA was pulled per user feedback — simpler
// UX: share on natal, nothing on sky views. Canvas halved from
// 1080×1920 → 720×1280 (memory-safer on older Samsung Internet where
// the previous size triggered silent toBlob failures). Added an
// explicit toDataURL fallback path: if toBlob doesn't fire its
// callback within 8s (or returns null, or throws), we synchronously
// toDataURL + byte-convert to Blob so the share still works. All
// encoding now yields via setTimeout(0) before running, so the
// button's "Generando…" state actually paints before the heavy step.
// share-card.js bumped to ?v=5.
// v43 → v44 (Apr 18 p8.7): every iteration of the branded share-card
// pipeline hung on the user's device. Pivoting to the simplest thing
// that could possibly work: buildSimple() just reads the blob from
// the already-painted on-screen natal canvas. No offscreen render,
// no composition, no font loads, no gradient work. If THIS hangs,
// the problem is `canvas.toBlob` itself on that browser — which is
// why encodeCanvas already has the toDataURL fallback path. layout
// 'full' still available for the branded card; default is simple.
// Hard 15s timeout as a last-resort safety net on top of the 8s
// toBlob→toDataURL fallback. share-card.js bumped to ?v=7.
// v44 → v45 (Apr 18 p8.8): ROOT CAUSE of "Generando…" hang finally
// found. LuzEstelar.toast is the FUNCTION itself (toast(msg, opts)),
// not an object with a .show() method. share-card.js was calling
// toast.show(...) which threw TypeError SYNCHRONOUSLY, killing the
// whole buildAndShare chain before the Promise ever formed — so no
// .then or .catch ever fired and the button sat on its initial label
// forever. Fixed: call toast() as function, use pending.dismiss() not
// toast.dismiss(pending). Also wrapped the click-handler's call to
// buildAndShare in a try/catch so if any future sync-throw sneaks in,
// the error surfaces in the button text immediately instead of
// leaving the user confused.
// v45 → v46 (Apr 18 p8.9): re-enabled the branded share-card layout
// now that the toast sync-throw root cause is fixed. Default builder
// flipped from buildSimple back to the full 5-phase pipeline (Fondo
// → Texto → Carta → Detalles → Codificando). drawBadge() re-scaled
// from 1080×1920 proportions to 720×1280 (disc 46 vs 70, fonts
// 20/48/26 vs 30/72/42) and stripped of webfont refs (Cormorant +
// Noto) in favour of system stacks so canvas never blocks waiting
// for a font fetch. Users who hit any new issue can fall back to
// minimal via { layout: 'simple' } at the call site.
// v46 → v47 (Apr 18 p8.10): share-card badge glyph consistency fix.
// Virgo (♍) was rendering as a purple colour-emoji rectangle while
// Luna (☾) and ASC (↑) rendered as text-style monochrome glyphs —
// visually jarring. Every zodiac glyph now carries U+FE0E (VS15
// variation selector) to force text presentation across Android,
// iOS and desktop. Also added Spanish sign keys (Géminis, Cáncer,
// Escorpio, etc.) to SIGN_GLYPH so the lookup works whether the
// chart data stores the sign in English or its localised form.
// v47 → v48 (Apr 18 p9): TRÁNSITOS DE HOY landed. New /js/transits.js
// computes geocentric ecliptic longitudes for the ten classical bodies
// using Keplerian elements from J2000 + Moon perturbation terms
// (accuracy ~0.5° for Sun/Moon, ~1° for planets — plenty for daily-
// transit aspect detection). findAspects() scans the five Ptolemaic
// aspects with tuned orbs, ranks by weight / (orb + 0.5). natal-chart.js
// paints today's planets as an outer "transit ring" just inside the
// zodiac band with a silvery dashed rim, plus dashed aspect lines
// colored per aspect type (conjunction gold, square orange, trine
// green, etc.). A new panel under the chart toggle lists the top 5
// aspects of the moment. Tap-identify extended to include transit
// planets — the info card shows the planet's current position AND
// its top natal contacts. natal-chart.js bumped to ?v=10.
// v48 → v49 (Apr 18 p9.1): tránsitos overlay made opt-in per user
// feedback ("se ve cool, pero es difícil de entender"). New toggle
// button "Ver tránsitos" / "Ocultar tránsitos" sits next to the share
// button with a violet-tinted pill style. Off by default: the natal
// wheel reads clean at first glance like it did before v48. Tap once
// to overlay today's sky + aspect lines + expand the aspects panel;
// tap again to collapse back to clean. Aspect lines also reduced from
// 12 → 5 so even when on, the chart doesn't get smothered in crossings.
// v49 → v50 (Apr 18 p9.2): aspect glyphs in the tránsitos panel
// ("*" for conjunction, "°P" for opposition on Samsung Internet) were
// Unicode U+260C / U+260D falling back to random system glyphs because
// .tp-asp inherited the Inter font, which has zero astrological
// coverage. Added the Noto Sans Symbols 2 → Segoe UI Symbol → Apple
// Symbols fallback stack explicitly on .tp-asp, plus VS15 on each
// aspect code to force text-style rendering. ☌ / ☍ / □ / △ / ⚹ now
// render consistently across Android, iOS and desktop.
// v50 → v51 (Apr 18 p10): ONBOARDING landed. First-time users hitting
// mi-dia.html with zero profiles now see a full-screen welcome overlay
// with a starfield backdrop, 3 value-prop bullets (real chart from
// your birth data, 8 systems, free), and one primary CTA "Crear mi
// carta" that opens the Add Profile sheet pre-set to "Mi Perfil" with
// the name input auto-focused. A small "Explorar primero" link lets
// the user bypass — the dismissal persists via localStorage so they
// don't get re-badgered. When the first profile lands in the list,
// the overlay auto-closes via renderProfiles().
// v51 → v52 (Apr 18 p11): Lighthouse audit pass. Open Graph + Twitter
// Card meta tags landed on mi-dia.html and en/my-day.html so link
// previews in WhatsApp / Telegram / Twitter show a proper card
// (icon + title + description) when users share their dashboard URL.
// _headers gained explicit cache policy for /css /js /data: 1h max-age
// + 1d stale-while-revalidate for CSS/JS, 1d + 7d SWR for the static
// sky catalogs. Returning visitors now see instant cached paints with
// background refresh — on top of the existing SW stale-while-revalidate.
// v52 → v53 (Apr 18 p11.1): accessibility & SEO polish pass without
// running Lighthouse remotely. Added (1) a visually-hidden <label>
// for the newsletter email input (was placeholder-only — AT users
// got no context), (2) canonical URLs on mi-dia + en/my-day so
// social shares and browser history deduplicate properly even on
// noindex pages, (3) a .sr-only utility class for future hidden-
// label needs, (4) `id` and explicit `scope` fields on manifest.json
// so the PWA install prompt reads as a stable identity across
// reinstalls. No behaviour changes; pure metadata + a11y.
// v53 → v54 (Apr 18 p11.2): focused fixes after real Lighthouse run
// came back Performance 94 / A11y 82 / BP 77 / SEO 54. SEO 54 is
// expected for a noindex dashboard — no action. A11y: .slbl contrast
// bumped alpha .58 → .78 plus weight 500 → 600 (gold-on-dark small
// caps was borderline AA). day-nav-btn kept its compact 24×24 look
// but tap target expanded to 44×44 via a transparent ::before
// pseudo-element so it meets WCAG 2.1 AA minimum without inflating
// the UI. Best Practices: dropped the deprecated X-XSS-Protection
// header (modern browsers ignore it; older browsers can trip
// XS-Leak issues with it on).
// v54 → v55 (Apr 18 p12): TWO LANDS IN ONE. (1) Natal ↔ natal aspect
// lines were SILENTLY not rendering because the PyEphem pipeline
// stores the aspect name under `asp.aspect` in Spanish ("Cuadratura",
// "Trígono"...) while ASPECT_STYLES only had English keys ("square",
// "trine") looked up via `asp.type`. Every chart that hit the code
// path through the pipeline never drew its spider web. Fixed: accept
// `asp.aspect || asp.type`, added Spanish keys, and layered an
// orb-based visual hierarchy (orb<1° at 130% weight + full alpha,
// orb>5° at 55% of base). Hard aspects (conjunction/square/opposition)
// stroke thicker + warmer, soft aspects (trine/sextile) recede.
// (2) Beatriz's natal_chart backfilled in D1 using the same
// Keplerian engine as /js/transits.js plus a Meeus-based Ascendant +
// MC calculation. She goes from "Ascendente: No disponible" to
// "Ascendente: Aries 15°". Timezone corrected from the profile's
// invalid "UTC-7" to the historical "America/Mexico_City". Francisco
// left for later — his profile has no birth time or coords.
// natal-chart.js bumped to ?v=11.
// v55 → v56 (Apr 18 p13): SYNASTRY biwheel landed. compatibilidad-
// personal.html now paints, inside its results section, a proper
// astrological biwheel — person A's natal wheel inside, person B's
// ten planets on an outer ring (reusing the transits overlay path
// in natal-chart.js since the mechanic is identical), and dashed
// cross-aspect lines between them. Below the chart, the top 5 A↔B
// aspects render in the same pill-row pattern as Mi Día's tránsitos
// panel. Tap on any planet shows an info card labelled with the
// owner ("Sol de Beatriz", "tu Venus", etc.). No new backend
// endpoints — everything computes client-side from the natal_chart
// JSONs the profile list already returns.
// v56 → v57 (Apr 19 p14): two bug-fixes from the path3studio account
// test session. (1) The Add Profile modal's "Guardar Perfil" button
// was hidden below the scroll on some phones — the form was inside
// .mdl-body which is scrollable, but Samsung Internet seemingly
// swallowed scroll events and the button stayed out of reach. Moved
// the button OUT of the form, into a flex-shrink:0 .mdl-footer at
// the bottom of the sheet. HTML5 `form="ap-form"` attribute keeps
// the submit wired. Button is now always visible. (2) Compatibility
// empty-state (< 2 profiles) reworked from "Necesitas al menos 2
// perfiles — Crear perfiles" (generic, confusing when the user just
// created one) to "Agrega a alguien con quien compararte (pareja,
// familiar…)" + CTA → mi-dia.html where they can hit "+ Agregar
// perfil" directly.
// v57 → v58 (Apr 19 p15): THREE reported fixes from the path3studio
// account test. (1) Client-side natal chart now computes all 10
// bodies via /js/transits.js when the profile has no natal_chart in
// D1 yet (fresh profiles before the daily pipeline runs). Previously
// the fallback drew only Sun + Moon, leaving the wheel looking
// empty. If hora_nacimiento + lat + lon are present we also compute
// Ascendant + MC via the new Transits.computeAscMc() (Meeus formula),
// so a new Plus user who fills in their birth data sees a full
// wheel instantly instead of waiting for tomorrow's pipeline. (2)
// mi-dia.html reacts to the `#add-profile` hash by auto-opening the
// Add Profile sheet 400ms after hydrate — Compat's "Agregar otro
// perfil" CTA now uses it, collapsing a 3-tap flow (Compat → Inicio
// → scroll → + Agregar perfil) to 1 tap. (3) Scripts bumped:
// transits.js?v=2, natal-chart.js?v=12.
// v58 → v59 (Apr 19 p15.1): ROOT CAUSE of "no puedo guardar perfil"
// finally found. #le-tabs (the PWA bottom-tabs bar) is fixed-positioned
// at z-index 9999 — the Add Profile modal sheet was at z-index 81.
// The modal's sticky footer with the Guardar button WAS there, rendering
// at the bottom of the sheet exactly as designed, but the tab bar
// covered it visually AND intercepted all taps in that strip. Users
// saw "Ubicación seleccionada" then blackness then tabs — no way to
// submit. Fixed: raise modal z-index above the tabs (10000+) AND hide
// #le-tabs entirely while body.modal-open so the bottom edge is
// available to the modal footer. This has been the blocker across the
// last several iterations — the sticky-footer refactor was correct but
// the overlay conflict hid the result.
// v59 → v60 (Apr 19 p15.2): after creating a new profile via the
// Add Profile modal, the dashboard didn't switch to show it. The
// submit handler refreshed `profilesList` but left `currentProfile`
// pinned to the original primary (usually the first profile loaded),
// so the natal chart, badges, and insights all kept showing the old
// person's data. User creates "Dany" and expects to see her chart —
// instead sees "F.path9" still. Fixed: pick the freshly-created
// profile out of the updated list (via d.profile.id returned by the
// POST), set currentProfile = that + window.__currentProfile = that,
// then call renderAll() to refresh the entire dashboard with the
// new person's data. The client-side Transits fallback from v58
// kicks in right here, so even before the nightly pipeline runs
// for this profile, the user sees a complete wheel.
// v60 → v61 (Apr 19 p16): three interrelated UX corrections after
// user test revealed identity/profile conflation. (1) GREETING
// ("Buenas noches, X") now pins to the ACCOUNT OWNER's primary
// profile (is_primary=1) instead of whatever profile is currently
// being viewed. Creating "Dany" no longer makes the app call the
// user "Dany" — they remain themselves. (2) "Mis Perfiles" rows
// are now TAPPABLE to switch which profile's data renders in the
// dashboard (chart, badges, insights). Active row gets a "Viendo"
// pill and gold-tinted background. Greeting stays unchanged during
// the switch. Haptic tap on mobile. (3) Synastry biwheel on the
// compat page now computes both charts client-side via Transits
// when a profile's natal_chart hasn't been backfilled yet — so the
// biwheel works immediately after adding a new partner/family
// profile, not only after tomorrow's pipeline run.
// v61 → v62 (Apr 19 p17): in-app "exact aspect" indicator landed as
// the MVP of the push-notifications arc. When Mi Día computes today's
// transits, it now counts any aspects with orb < 0.8° that involve a
// personal planet (Sol/Luna/Mercurio/Venus/Marte/ASC/MC) and lights
// a pulsating gold badge on the "Ver tránsitos" button with that
// count. The underlying panel already styles exact aspects with
// heavier border + gold background, so one tap and the user sees
// exactly which aspect is firing. Full server-side push (via the
// existing /workers/push-sender cron + VAPID infra) deferred to a
// dedicated session — the ephemeris needs to be ported to the
// Worker and a sent_aspect_alerts dedup table needs to exist.
// v62 → v63 (Apr 19 p18): EN parity pass after a sprawling ES-only
// feature run. en/my-day.html gained: (1) modal z-index fix + sticky
// mdl-footer so the Save Profile button is always visible above the
// tabs (same blocker that delayed the ES release across ~3 deploys).
// (2) Profile-creation auto-switch: after POST /birth-profiles the
// client finds the new id, sets currentProfile, and calls renderAll.
// (3) Greeting now pins to the primary profile (account owner) not
// the profile currently being viewed — you stay yourself when
// exploring other people's charts. (4) 10-planet + Ascendant
// client-side fallback via Transits when natal_chart is null. (5)
// Tappable .pf-row switcher with "Viewing" pill on the active row.
// Purely defensive + methodical — zero new features, closes the
// EN vs ES gap introduced during the feature run.
// v63 → v64 (Apr 19 p19): THE automatic natal_chart compute. Previously
// new profiles waited until 3AM for the pipeline to backfill natal_chart
// — the window was visible UX debt ("insights couldn't load", Ascendant
// "No disponible"). Now the POST `/api/profile/birth-profiles` handler
// computes a full natal_chart JSON synchronously via the new shared
// ephemeris (/functions/_shared/ephemeris.js), mirroring the client-side
// /js/transits.js math. Users see complete 10-planet + Asc + aspects
// the moment the profile is saved. ALSO: fixed a quadrant bug in the
// Ascendant formula (atan2 picks one of two 180°-separated solutions;
// old rule "if asc < mc flip" got Ernesto wrong by 180°). New rule:
// Asc must be in the rising semicircle (MC+90° → MC+270° CCW). Ernesto
// now matches PyEphem exactly (Cáncer 4.44° / Libra 18.25°). Fix
// applied to both server AND client. Transits.js bumped to ?v=3.
// v64 → v65 (Apr 19 p20): onboarding UX polish — closing the last
// gap in the new-user first-day experience. Empty-state messages for
// the daily reading and cross-cultural report used to sound like bugs
// ("No pudimos cargar el reporte ahora", "Tu lectura estará disponible
// pronto"). Now they set expectations: how long until the next run
// (computed live, shows "~14h" etc), what the user is waiting on, and
// what they can do in the meantime (explore the natal chart which IS
// already rendering via the v64 auto-compute). Cross-cultural
// waiting state also includes a PREVIEW drawn from the natal chart's
// tightest aspect — "Mientras tanto, lo más apretado de tu carta:
// Trígono entre Marte y Plutón (orbe 0.1°)" — giving value NOW
// without any Gemini call. The card is no longer a dead end.
// v65 → v66 (Apr 19 p21): SERVER-SIDE EXACT ASPECT ALERTS shipped.
// The push-sender Worker cron (hourly) now computes today's transit
// positions once per run, then for each subscriber whose send_hour
// matches the current local hour, scans their primary-profile natal
// chart for an exact (<0.5° orb) aspect between a transit planet and
// a personal natal point (Sol/Luna/Mercurio/Venus/Marte/ASC/MC). If
// one is found AND it hasn't been sent in the last 3 days (dedup
// via new `sent_aspect_alerts` table), the daily push swaps from
// the generic "Tu lectura de hoy" to "⚡ Tránsito exacto hoy" with
// the specific aspect described. Users can opt out via a new toggle
// in Ajustes that updates the push_subscriptions.notify_aspects
// column via the existing subscribe endpoint. Ephemeris ported from
// /functions/_shared/ephemeris.js into /workers/push-sender/src/ so
// both client, Pages Function, and Worker share the exact same math.
// Migration 0007 already applied to D1.
// v66 → v67 (Apr 19 p22): EN feature parity closer. en/my-day.html
// gains the full transits experience that ES users have had since
// v48: opt-in "View transits" toggle pill, pulsating gold badge
// counting today's exact aspects (<0.8° orb) to personal natal
// points, and a "Today's transits" panel listing the top 5 aspects
// with properly-rendered astrological glyphs (Noto Sans Symbols 2
// + VS15). When the toggle is flipped on, the natal canvas
// re-renders with today's planets as an outer ring + dashed cross-
// aspect lines. Pure port of the ES implementation with English
// strings. en/compatibility-personal.html (synastry biwheel in
// English) still deferred — that page doesn't exist yet; when it's
// created the existing ES synastry code can be adapted one-shot.
// v67 → v68 (Apr 18): en/compatibility-personal.html created —
// full port of the ES synastry biwheel page with English copy,
// English zodiac labels in the client-side fallback compute, EN
// planet names (Sun/Moon/Mercury/…) in both PNAME dicts, EN
// UpgradeSheet, and lang=en on the /api/reports/compatibility call.
// Closes Arco 4 (EN parity for the full app shell).
const CACHE_NAME = 'luzestelar-v68';
const OFFLINE_URL = '/offline.html';
const READING_CACHE = 'luzestelar-reading-v1';

// Static assets to precache on install.
// Includes the design-system files so they're offline-ready on day one.
const PRECACHE_URLS = [
  '/',
  '/mi-dia.html',
  '/en/my-day.html',
  '/dashboard.html',
  '/compatibilidad-personal.html',
  '/en/compatibility-personal.html',
  '/ajustes.html',
  '/mapa-estelar.html',
  '/en/mapa-estelar.html',
  '/css/design-tokens.css',
  '/css/stars.css?v=2',
  '/css/pwa.css',
  '/css/icons.css',
  '/css/components.css',
  '/js/icons.js',
  '/js/stars.js',
  '/js/sheet-modal.js',
  '/js/toast.js',
  '/js/sw-update.js',
  '/js/haptic.js',
  '/js/bottom-tabs.js',
  '/js/upgrade-sheet.js',
  '/js/install-prompt.js',
  '/js/hero-install.js',
  '/js/sky-map.js',
  '/js/transits.js?v=3',
  '/js/share-card.js?v=10',
  '/data/stars.json',
  '/data/constellations.json',
  '/app_icon.png',
  '/manifest.json',
  OFFLINE_URL,
];

// Accept SKIP_WAITING messages from the client (sw-update.js toast).
// When the user taps "Actualizar" on the new-version banner, the
// page posts { type: 'SKIP_WAITING' }. We hand over control
// immediately instead of waiting for every tab to close.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install: precache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  const KEEP = [CACHE_NAME, READING_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => !KEEP.includes(key)).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests and cross-origin (fonts loaded via CDN will cache naturally)
  if (request.method !== 'GET') return;

  // For navigation requests (HTML pages): network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful page loads
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: try cache, then offline page
          return caches.match(request).then((cached) => {
            return cached || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // For static assets: split strategy —
  //   - CSS/JS → stale-while-revalidate (instant from cache, but
  //     quietly fetched in background so next visit has fresh bits).
  //     This is what lets new design-system rollouts land on users'
  //     PWA without them having to uninstall/reinstall.
  //   - Images/fonts → cache-first (they rarely change, so we save
  //     the round-trip).
  if (request.url.match(/\.(css|js)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const fresh = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached); // offline → serve cache
          return cached || fresh;
        })
      )
    );
    return;
  }
  if (request.url.match(/\.(png|jpg|jpeg|webp|svg|woff2?|ttf|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Daily reading API: stale-while-revalidate (offline support)
  if (request.url.includes('/api/dashboard/daily-reading')) {
    event.respondWith(
      caches.open(READING_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // API calls: always network, never cache
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Everything else: network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ─── Web Push ──────────────────────────────────────────────────────────
// Payload contract (from the daily-cron Worker):
//   { title, body, url, icon, badge, tag, lang }
// Any missing field falls back to a branded default.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : '' }; }

  const lang = (data.lang === 'en') ? 'en' : 'es';
  const title = data.title || (lang === 'en'
    ? '\u2728 Your daily reading'
    : '\u2728 Tu lectura de hoy');
  const body = data.body || (lang === 'en'
    ? 'Open Luz Estelar to see today\u2019s sky.'
    : 'Abre Luz Estelar para ver tu cielo de hoy.');
  const url = data.url || (lang === 'en' ? '/en/my-day.html' : '/mi-dia.html');

  const options = {
    body,
    icon: data.icon || '/app_icon.png',
    badge: data.badge || '/app_icon.png',
    tag: data.tag || 'luzestelar-daily',
    renotify: false,
    data: { url },
    vibrate: [60, 40, 60],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// When a notification is clicked, focus any open tab on the target URL or
// open a fresh one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const c of clientsList) {
      try {
        const cUrl = new URL(c.url);
        if (cUrl.pathname === targetUrl || cUrl.pathname + cUrl.search === targetUrl) {
          await c.focus();
          return;
        }
      } catch { /* ignore malformed client URL */ }
    }
    await self.clients.openWindow(targetUrl);
  })());
});

// If the browser re-subscribes (e.g. the push endpoint was rotated),
// forward the new subscription to our backend without bothering the user.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const reg = await self.registration;
      if (!reg || !reg.pushManager) return;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch { /* best-effort, silent */ }
  })());
});
