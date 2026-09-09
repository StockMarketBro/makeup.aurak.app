// Cryptoguitar Analytics — snippet de tracking
// -----------------------------------------------------------------
// Cómo usarlo: pega esto en cada app, justo antes de </body>:
//
//   <script type="module" src="/cg-analytics.js"></script>
//
// (sube este mismo archivo, sin cambios, a las 4 apps — el sitio se
// detecta solo por el dominio desde el que se carga)
//
// Para marcar un evento propio desde cualquier botón/acción de tu app:
//   window.cgTrack("signup_click", { plan: "premium" })
// -----------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD0LwwG-MbBuR-_fqtTK3BSYu5zz9elbRU",
  authDomain: "cryptoguitar-analytics.firebaseapp.com",
  projectId: "cryptoguitar-analytics",
  storageBucket: "cryptoguitar-analytics.firebasestorage.app",
  messagingSenderId: "633601798162",
  appId: "1:633601798162:web:3c8c0ff93db244ce7028cb",
};

// Mapa de dominio -> nombre de sitio para el dashboard.
// Si cargas este script desde un subdominio (ej. guitar.bentoboxband.app)
// y no está listado, se usa el hostname completo tal cual.
const SITE_MAP = {
  "stockmarketbro.app": "stockmarketbro",
  "pronostiko.app": "pronostiko",
  "aurak.app": "aurak",
  "makeup.aurak.app": "aurak-makeup",
  "bentoboxband.app": "bentoboxband",
  "hero.bentoboxband.app": "bentobox-hero",
  "daesa.bentoboxband.app": "daesa",
  "bentoboxguitar.vercel.app": "bentobox-guitar",
  "nihongobentobox.vercel.app": "kotoba",
  "combi.bentoboxband.app": "combi-box",
  "queiauso.app": "queiauso",
};

function detectSite() {
  const host = location.hostname.replace(/^www\./, "");
  if (SITE_MAP[host]) return SITE_MAP[host];
  for (const [domain, name] of Object.entries(SITE_MAP)) {
    if (host.endsWith("." + domain)) return name; // subdominios
  }
  return host || "unknown";
}

function getSessionId() {
  let sid = sessionStorage.getItem("cg_sid");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("cg_sid", sid);
  }
  return sid;
}

function deviceType() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const SITE = detectSite();

async function logEvent(type, extra = {}) {
  try {
    await addDoc(collection(db, "events"), {
      site: SITE,
      type,
      page: location.pathname || "/",
      referrer: document.referrer || null,
      device: deviceType(),
      sessionId: getSessionId(),
      ts: serverTimestamp(),
      ...extra,
    });
  } catch (e) {
    // Nunca romper la app del usuario por un fallo de tracking
    console.debug("cg-analytics:", e && e.message);
  }
}

// Pageview automático al cargar el script
logEvent("pageview");

// Disponible globalmente para eventos custom
window.cgTrack = (type, extra) => logEvent(type, extra);
