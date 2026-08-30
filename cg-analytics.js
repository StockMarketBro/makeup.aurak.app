/* ============================================================================
 * cg-analytics.js — Tracker unificado de CryptoGuitar
 * Proyecto Firebase: cryptoguitar-analytics (separado del backend de cada app)
 * Apps: stockmarketbro.app · pronostiko.app · aurak.app · bentoboxband.app
 *       + sub-apps de bentoboxband.app: guitar, coreostep, gear, groove, kotoba...
 *
 * USO (una sola línea, al final del <body>):
 *   <script src="/cg-analytics.js" data-app="guitar" defer></script>
 *
 * IMPORTANTE: pon el data-app correcto en cada sub-app para que el
 * dashboard te muestre el desglose por app, no solo el total del dominio.
 *
 * Eventos automáticos: session_start, page_view, scroll_depth, time_on_page,
 * click (en elementos con data-cg="nombre") y outbound (links externos).
 * Evento manual:  cgTrack('cupon_generado', { liga: 'premier', partidos: 10 });
 *
 * No usa el SDK de Firebase (0 KB extra): escribe por REST a Firestore.
 * No guarda datos personales: sin cookies, sin IP, sin fingerprint.
 * ==========================================================================*/
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. CONFIGURACIÓN
  // ---------------------------------------------------------------------------
  var CFG = {
    projectId: 'cryptoguitar-analytics',
    apiKey: 'AIzaSyD0LwwG-MbBuR-_fqtTK3BSYu5zz9elbRU',   // apiKey del firebaseConfig (proyecto cryptoguitar-analytics)
    collection: 'events',                  // colección en Firestore
    flushMs: 4000,                         // cada cuánto envía el lote
    maxBatch: 20,                          // máx. eventos por request
    sessionMins: 30,                       // minutos de inactividad = nueva sesión
    trackLocalhost: false,                 // true para probar en local
    debug: false                           // true = log en consola
  };

  // Nombre de la app: data-app del <script>, o deducido del dominio
  var SCRIPT = document.currentScript;
  var APP = (SCRIPT && SCRIPT.getAttribute('data-app')) || (function () {
    var h = location.hostname.replace(/^www\./, '');
    if (h.indexOf('stockmarketbro') === 0) return 'stockmarketbro';
    if (h.indexOf('pronostiko') === 0) return 'pronostiko';
    if (h.indexOf('aurak') === 0) return 'aurak';
    if (h.indexOf('guitar.') === 0) return 'guitar';
    if (h.indexOf('coreostep.') === 0) return 'coreostep';
    if (h.indexOf('gear.') === 0) return 'gear';
    if (h.indexOf('groove.') === 0) return 'groove';
    if (h.indexOf('kotoba.') === 0) return 'kotoba';
    if (h.indexOf('bentobox') === 0) return 'bentoboxband';
    return h || 'desconocido';
  })();

  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
                location.protocol === 'file:';
  if (isLocal && !CFG.trackLocalhost) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  var ENDPOINT = 'https://firestore.googleapis.com/v1/projects/' + CFG.projectId +
                 '/databases/(default)/documents:commit?key=' + CFG.apiKey;
  var DOCPATH = 'projects/' + CFG.projectId + '/databases/(default)/documents/' +
                CFG.collection + '/';

  function log() { if (CFG.debug) console.log.apply(console, ['[cg]'].concat([].slice.call(arguments))); }
  function uid() {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).slice(0, 20);
  }

  // ---------------------------------------------------------------------------
  // 2. SESIÓN Y VISITANTE (anónimos, solo en el navegador del usuario)
  // ---------------------------------------------------------------------------
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  var visitorId = store('cg_vid');
  var isNewVisitor = false;
  if (!visitorId) { visitorId = uid(); store('cg_vid', visitorId); isNewVisitor = true; }

  var lastSeen = parseInt(store('cg_last') || '0', 10);
  var sessionId = store('cg_sid');
  var isNewSession = false;
  if (!sessionId || (Date.now() - lastSeen) > CFG.sessionMins * 60000) {
    sessionId = uid();
    store('cg_sid', sessionId);
    isNewSession = true;
  }
  function touch() { store('cg_last', String(Date.now())); }
  touch();

  // Origen del tráfico (utm o referrer externo)
  var qs = new URLSearchParams(location.search);
  var referrer = '';
  try {
    if (document.referrer && new URL(document.referrer).hostname !== location.hostname) {
      referrer = new URL(document.referrer).hostname;
    }
  } catch (e) {}

  var CTX = {
    app: APP,
    host: location.hostname,
    vid: visitorId,
    sid: sessionId,
    lang: (navigator.language || '').slice(0, 5),
    tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
    screen: window.innerWidth + 'x' + window.innerHeight,
    device: window.innerWidth < 768 ? 'movil' : (window.innerWidth < 1200 ? 'tablet' : 'escritorio'),
    referrer: referrer,
    utm_source: qs.get('utm_source') || '',
    utm_medium: qs.get('utm_medium') || '',
    utm_campaign: qs.get('utm_campaign') || ''
  };

  // ---------------------------------------------------------------------------
  // 3. COLA + ENVÍO A FIRESTORE (REST, formato de valores tipados)
  // ---------------------------------------------------------------------------
  function toValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v)
      ? { integerValue: String(v) } : { doubleValue: v };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (Array.isArray(v)) return { arrayValue: { values: v.slice(0, 20).map(toValue) } };
    if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
    return { stringValue: String(v).slice(0, 500) };
  }
  function toFields(obj) {
    var f = {};
    Object.keys(obj).forEach(function (k) {
      if (obj[k] !== '' && obj[k] !== undefined) f[k] = toValue(obj[k]);
    });
    return f;
  }

  var queue = [];
  var timer = null;

  function send(batch, beacon) {
    if (!batch.length) return;
    var body = JSON.stringify({
      writes: batch.map(function (ev) {
        return { update: { name: DOCPATH + uid(), fields: toFields(ev) } };
      })
    });
    log('enviando', batch.length, batch);
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function (e) { log('error', e); });
    }
  }

  function flush(beacon) {
    if (timer) { clearTimeout(timer); timer = null; }
    while (queue.length) send(queue.splice(0, CFG.maxBatch), beacon);
  }

  function track(name, props) {
    var ev = {
      event: String(name).slice(0, 60),
      type: name === 'page_view' ? 'pageview' : String(name).slice(0, 60), // alias esperado por dashboard.html y las reglas de Firestore
      site: APP,                                                            // alias de "app", mismo motivo
      ts: new Date(),
      path: location.pathname.slice(0, 200),
      title: (document.title || '').slice(0, 120)
    };
    Object.keys(CTX).forEach(function (k) { ev[k] = CTX[k]; });
    if (props && typeof props === 'object') {
      Object.keys(props).slice(0, 15).forEach(function (k) {
        if (!(k in ev)) ev[k] = props[k];
      });
    }
    queue.push(ev);
    touch();
    if (queue.length >= CFG.maxBatch) flush(false);
    else if (!timer) timer = setTimeout(function () { flush(false); }, CFG.flushMs);
  }

  window.cgTrack = track;                       // API pública
  window.cgAnalytics = { track: track, flush: flush, ctx: CTX, cfg: CFG };

  // ---------------------------------------------------------------------------
  // 4. EVENTOS AUTOMÁTICOS
  // ---------------------------------------------------------------------------
  if (isNewSession) track('session_start', { nuevo_visitante: isNewVisitor });
  track('page_view');

  // 4.1 Profundidad de scroll (25/50/75/100 %)
  var marks = { 25: false, 50: false, 75: false, 100: false };
  var onScroll = function () {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h <= 0) return;
    var pct = Math.round((window.scrollY / h) * 100);
    [25, 50, 75, 100].forEach(function (m) {
      if (!marks[m] && pct >= m) { marks[m] = true; track('scroll_depth', { pct: m }); }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  // 4.2 Clicks marcados con data-cg="nombre" y links externos
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-cg], a[href]');
    if (!el) return;
    var tag = el.getAttribute('data-cg');
    if (tag) {
      track('click', { elemento: tag, texto: (el.innerText || '').trim().slice(0, 60) });
      return;
    }
    var href = el.getAttribute('href') || '';
    if (/^https?:\/\//.test(href)) {
      try {
        var dest = new URL(href);
        if (dest.hostname !== location.hostname) track('outbound', { destino: dest.hostname });
      } catch (err) {}
    }
  }, true);

  // 4.3 Tiempo en página + envío final
  var t0 = Date.now();
  var closed = false;
  function bye() {
    if (closed) return;
    closed = true;
    track('time_on_page', { segundos: Math.round((Date.now() - t0) / 1000) });
    flush(true);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') bye();
    else { closed = false; t0 = Date.now(); }
  });
  window.addEventListener('pagehide', bye);

  // 4.4 Errores JS (útil para depurar en producción)
  window.addEventListener('error', function (e) {
    track('js_error', {
      mensaje: (e.message || '').slice(0, 200),
      archivo: (e.filename || '').split('/').pop(),
      linea: e.lineno || 0
    });
  });

  log('listo', APP, CTX);
})();

/* ============================================================================
 * REGLAS DE FIRESTORE necesarias en el proyecto cryptoguitar-analytics
 * (Firestore → Reglas). Cualquiera escribe eventos, solo el admin los lee:
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{db}/documents {
 *     match /events/{id} {
 *       allow read: if request.auth != null
 *                   && request.auth.token.email == 'cryptoguitar1@gmail.com';
 *       allow create: if request.resource.data.app is string
 *                     && request.resource.data.event is string
 *                     && request.resource.data.size() < 30;
 *       allow update, delete: if false;
 *     }
 *   }
 * }
 * ==========================================================================*/
