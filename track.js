// Contador de visitas de Aura-K.
// Mantiene las claves originales (pageviews:total y pageviews:FECHA) para no
// perder el historial, y agrega el desglose por app y el cruce entre ambas.
// Variables de entorno: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

// Orígenes autorizados a reportar visitas (CORS).
// Si despliegas el Makeup Studio en otro subdominio, agrégalo aquí.
const ALLOWED_ORIGINS = [
  'https://www.aurak.app',
  'https://aurak.app',
  'https://makeup.aurak.app',
];

export default async function handler(req, res) {
  // --- CORS: necesario porque el Makeup Studio vive en otro subdominio ---
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return res.status(200).json({ ok: false });

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});

    // Evento de clic en tienda: se cuenta aparte, no como visita.
    // Con estos números se negocia comisión con cada tienda.
    if (body.evento === 'tienda') {
      const tienda = String(body.tienda || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
      if (!tienda) return res.status(200).json({ ok: false });
      const dayT = new Date().toISOString().slice(0, 10);
      const hdr = { Authorization: `Bearer ${token}` };
      await Promise.all([
        fetch(`${base}/incr/clicks:tienda:${tienda}:total`, { headers: hdr }),
        fetch(`${base}/incr/clicks:tienda:${tienda}:${dayT}`, { headers: hdr }),
        fetch(`${base}/incr/clicks:total`, { headers: hdr }),
      ]);
      return res.status(200).json({ ok: true });
    }

    // src: de qué app viene la visita · from: de dónde llegó el usuario
    const src = body.src === 'makeup' ? 'makeup' : 'landing';
    const from = String(body.from || 'directo').replace(/[^a-z0-9_-]/gi, '').slice(0, 20) || 'directo';

    // Misma fecha que usa stats.js, para que los días cuadren
    const day = new Date().toISOString().slice(0, 10);
    const headers = { Authorization: `Bearer ${token}` };
    const incr = key => fetch(`${base}/incr/${key}`, { headers });

    const ops = [
      // Claves originales: el total y el gráfico de 7 días siguen igual
      incr('pageviews:total'),
      incr(`pageviews:${day}`),
      // Desglose por app
      incr(`pageviews:${src}:total`),
      incr(`pageviews:${src}:${day}`),
    ];

    // Cruce entre apps: el número que dice si el embudo funciona
    if (from !== 'directo' && from !== src) {
      ops.push(incr(`cross:${from}-${src}:total`));
    }

    await Promise.all(ops);
    return res.status(200).json({ ok: true });
  } catch (err) {
    // El tracking nunca debe romper la experiencia del usuario
    console.error('track error:', err);
    return res.status(200).json({ ok: false });
  }
}
