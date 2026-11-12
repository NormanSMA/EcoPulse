const STATIC_PREFIX = "/_next/static/";

export function shellUrls(doc: Pick<Document, "querySelectorAll">, origin: string): string[] {
  const out = new Set<string>();
  const add = (raw: string | null | undefined) => {
    if (!raw) return;
    try {
      const url = new URL(raw, origin);
      if (url.origin === origin && url.pathname.startsWith(STATIC_PREFIX)) out.add(url.href);
    } catch {
      // URL inválida: se ignora.
    }
  };
  doc.querySelectorAll("script[src]").forEach((el) => add((el as HTMLScriptElement).src));
  doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((el) => add((el as HTMLLinkElement).href));
  return [...out];
}

function domReady(): Promise<void> {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}

let pending: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * Registra el service worker una sola vez y le envía el cascarón del build
 * actual. Cada llamada puede sumar sus propias URLs: quien llega después
 * (el registro lo comparten push y el modo sin conexión) no las pierde.
 */
export function registerSW(extraUrls: string[] = []): Promise<ServiceWorkerRegistration | null> {
  if (!pending) {
    pending = (async () => {
      try {
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !navigator.serviceWorker) return null;
        // En desarrollo el worker no cachea (ver public/sw.js): los chunks de `next dev` no llevan hash.
        await navigator.serviceWorker.register(process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1");
        const registration = await navigator.serviceWorker.ready;
        // En la primera visita el worker tarda un instante en tomar el control
        // de la página: hasta entonces no intercepta (ni guarda) peticiones.
        if (!navigator.serviceWorker.controller) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 3000);
            navigator.serviceWorker.addEventListener("controllerchange", () => {
              clearTimeout(timer);
              resolve();
            }, { once: true });
          });
        }
        await domReady();
        registration.active?.postMessage({ type: "precache", urls: shellUrls(document, location.origin) });
        return registration;
      } catch {
        return null;
      }
    })();
  }
  if (extraUrls.length > 0) {
    // `pending` nunca rechaza: los fallos devuelven null.
    void pending.then((registration) => registration?.active?.postMessage({ type: "precache", urls: extraUrls }));
  }
  return pending;
}
