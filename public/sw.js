// Service worker de EcoPulse: alertas Web Push y arranque sin conexión.
//
// Solo guarda el "cascarón" de la app (HTML, JS y CSS del build, iconos,
// datos estáticos y tipografías del mapa). Las rutas /api/* nunca pasan por
// aquí: los datos sin conexión viven en IndexedDB (paquetes de zona).

const SHELL_CACHE = "ecopulse-shell-v1";
const STATIC_CACHE = "ecopulse-static-v1";
const KNOWN_CACHES = [SHELL_CACHE, STATIC_CACHE];
const STATIC_PREFIXES = ["/_next/static/", "/icons/", "/data/"];
const STATIC_FILES = ["/manifest.webmanifest", "/icon.svg"];
// Glifos de las etiquetas del mapa: pequeños e inmutables.
const FONT_PREFIX = "https://tiles.openfreemap.org/fonts/";
const MAX_STATIC_ENTRIES = 400;
const MAX_PRECACHE_URLS = 200;
// En desarrollo (registrado como /sw.js?dev=1) no se cachea nada: los
// chunks de `next dev` no llevan hash y quedarían obsoletos.
const DEV = new URL(self.location.href).searchParams.has("dev");

function isStaticPath(pathname) {
  return STATIC_FILES.includes(pathname) || STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Solo recursos propios del cascarón o glifos del mapa. Nunca /api/. */
function isCacheable(url) {
  if (url.href.startsWith(FONT_PREFIX)) return true;
  return url.origin === self.location.origin && isStaticPath(url.pathname);
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES))) await cache.delete(key);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  // Sin respuestas opacas ni errores: ocuparían espacio y se servirían rotas.
  if (response.status === 200 && (response.type === "basic" || response.type === "cors")) {
    await cache.put(request, response.clone());
    trim(cache);
  }
  return response;
}

async function navigate(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.status === 200 && new URL(request.url).pathname === "/") await cache.put("/", response.clone());
    return response;
  } catch (error) {
    const shell = await cache.match("/");
    if (shell) return shell;
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (!DEV) {
        const cache = await caches.open(SHELL_CACHE);
        // Si falla (sin red al instalar) se guardará en la primera navegación.
        await cache.add(new Request("/", { cache: "reload" })).catch(() => undefined);
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("ecopulse-") && !KNOWN_CACHES.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (DEV || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(navigate(request));
    return;
  }
  if (isCacheable(url)) event.respondWith(cacheFirst(request));
});

// La página envía las URLs exactas del build actual (scripts y hojas de
// estilo cargados) para que una recarga sin conexión no falle por un chunk.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (DEV || !data || data.type !== "precache" || !Array.isArray(data.urls)) return;
  // Solo se aceptan mensajes de ventanas de este mismo origen.
  const source = event.source;
  if (!source || !("url" in source) || new URL(source.url).origin !== self.location.origin) return;
  const urls = [];
  for (const raw of data.urls.slice(0, MAX_PRECACHE_URLS)) {
    if (typeof raw !== "string") continue;
    let url;
    try {
      url = new URL(raw, self.location.origin);
    } catch {
      continue;
    }
    if (isCacheable(url)) urls.push(url.href);
  }
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(
        urls.map(async (href) => {
          if (await cache.match(href)) return;
          try {
            const response = await fetch(href);
            if (response.status === 200 && (response.type === "basic" || response.type === "cors")) await cache.put(href, response);
          } catch {
            // Sin red: se intentará en la próxima carga.
          }
        })
      );
      trim(cache);
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "EcoPulse";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin) {
          // Si la pestaña ya existe, navega al deep link y enfoca.
          try {
            const nav = "navigate" in client ? await client.navigate(target) : client;
            return (nav || client).focus();
          } catch {
            return client.focus();
          }
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
