'use client';

import { useCallback, useEffect, useRef, useState } from "react";

// Cliente de alertas Web Push: registra /sw.js, gestiona la suscripción y
// sincroniza las preferencias con /api/push/subscribe.

export interface PushPrefs {
  minMagnitude: number;
  cyclones: boolean;
  volcanoes: boolean;
  disasters: boolean;
}

export type PushStatus = "loading" | "unsupported" | "denied" | "off" | "on";

export const DEFAULT_PUSH_PREFS: PushPrefs = { minMagnitude: 6, cyclones: true, volcanoes: true, disasters: true };

const PREFS_KEY = "ecopulse.pushPrefs";
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function loadPrefs(): PushPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<PushPrefs> | null;
    if (!raw) return DEFAULT_PUSH_PREFS;
    return {
      minMagnitude: typeof raw.minMagnitude === "number" ? raw.minMagnitude : DEFAULT_PUSH_PREFS.minMagnitude,
      cyclones: raw.cyclones !== false,
      volcanoes: raw.volcanoes !== false,
      disasters: raw.disasters !== false,
    };
  } catch {
    return DEFAULT_PUSH_PREFS;
  }
}

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Si el servicio de push del navegador no responde, se avisa en vez de esperar sin fin.
const SUBSCRIBE_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("push subscribe timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

async function register(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

async function send(method: "POST" | "DELETE", body: unknown): Promise<void> {
  const res = await fetch("/api/push/subscribe", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`push ${method} ${res.status}`);
}

function subscriptionBody(sub: PushSubscription, prefs: PushPrefs, locale: string) {
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth }, prefs, locale };
}

export function usePushAlerts(locale: "es" | "en") {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [prefs, setPrefsState] = useState<PushPrefs>(DEFAULT_PUSH_PREFS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  // Estado inicial: soporte, permiso y suscripción existente.
  useEffect(() => {
    let cancelled = false;
    setPrefsState(loadPrefs());
    if (!supported() || !VAPID_KEY) {
      setStatus("unsupported");
      return;
    }
    (async () => {
      try {
        const reg = await register();
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (Notification.permission === "denied") setStatus("denied");
        else setStatus(sub && Notification.permission === "granted" ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await register();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_KEY) }), SUBSCRIBE_TIMEOUT_MS));
      await send("POST", subscriptionBody(sub, prefs, localeRef.current));
      setStatus("on");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [prefs]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(false);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await send("DELETE", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  // Guarda en local y, si hay suscripción activa, vuelve a hacer POST.
  const setPrefs = useCallback(
    async (next: PushPrefs) => {
      setPrefsState(next);
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // Almacenamiento no disponible: se ignora.
      }
      if (status !== "on") return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await send("POST", subscriptionBody(sub, next, localeRef.current));
        setError(false);
      } catch {
        setError(true);
      }
    },
    [status]
  );

  // Notificación local para comprobar que el permiso y el icono funcionan.
  const sendTest = useCallback(async (title: string, body: string) => {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, icon: "/icons/icon-192.png", tag: "ecopulse-test", data: { url: "/" } });
    } catch {
      setError(true);
    }
  }, []);

  return { status, prefs, busy, error, enable, disable, setPrefs, sendTest };
}
