import { NextResponse } from "next/server";
import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isIngestAuthorized } from "@/lib/ingest";
import { fetchMergedEarthquakes } from "@/lib/earthquakes";
import { fetchActiveCyclones } from "@/lib/gdacsCyclones";
import { fetchActiveVolcanoes } from "@/lib/gvpWeekly";
import { fetchLiveDisasters } from "@/lib/gdacs";
import { collectCandidateEvents, matchesPrefs, normalizePrefs, textFor, type PushLocale } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Fuentes externas y servicios push lentos no deben agotar los 60 s de la funcion.
const UPSTREAM_TIMEOUT_MS = 20_000;
const PUSH_TIMEOUT_MS = 15_000;

const NO_STORE = { "Cache-Control": "no-store" };
const SENT_RETENTION_MS = 14 * 24 * 3_600_000;

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  prefs: unknown;
  locale: PushLocale;
  failures: number;
}

async function handle(request: Request) {
  if (!isIngestAuthorized(request, process.env.INGEST_SECRET)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json(
      { success: false, error: "Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT" },
      { status: 503, headers: NO_STORE }
    );
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const db = getSupabaseAdmin();
    const now = Date.now();
    const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
    const appUrl = process.env.APP_URL || new URL(request.url).origin;

    const [quakes, cyclones, volcanoes, disasters] = await Promise.all([
      fetchMergedEarthquakes("day", signal),
      fetchActiveCyclones(signal),
      fetchActiveVolcanoes(signal),
      fetchLiveDisasters(signal),
    ]);
    const candidates = collectCandidateEvents(
      {
        quakes: quakes.features,
        cyclones: cyclones.features,
        volcanoes: volcanoes.features,
        disasters: disasters.features,
        appUrl,
      },
      now
    );

    // Limpieza de registros viejos.
    await db.from("push_sent").delete().lt("sent_at", new Date(now - SENT_RETENTION_MS).toISOString());

    // Primera ejecución (registro vacío): se marcan los eventos actuales sin
    // notificar, para no enviar de golpe todo lo que ya está en curso.
    const { count: sentCount, error: countError } = await db.from("push_sent").select("event_key", { count: "exact", head: true });
    if (countError) throw new Error(`push_sent: ${countError.message}`);
    if (!sentCount && candidates.length) {
      const { error } = await db.from("push_sent").upsert(candidates.map((e) => ({ event_key: e.key })), { onConflict: "event_key" });
      if (error) throw new Error(`push_sent seed: ${error.message}`);
      return NextResponse.json({ success: true, events: 0, sent: 0, removed: 0, seeded: candidates.length }, { headers: NO_STORE });
    }

    let events = candidates;
    if (candidates.length) {
      const { data, error } = await db.from("push_sent").select("event_key").in("event_key", candidates.map((e) => e.key));
      if (error) throw new Error(`push_sent: ${error.message}`);
      const done = new Set((data ?? []).map((r: { event_key: string }) => r.event_key));
      events = candidates.filter((e) => !done.has(e.key));
    }
    if (!events.length) {
      return NextResponse.json({ success: true, events: 0, sent: 0, removed: 0 }, { headers: NO_STORE });
    }

    const { data: subsData, error: subsError } = await db.from("push_subscriptions").select("*");
    if (subsError) throw new Error(`push_subscriptions: ${subsError.message}`);
    const subs = (subsData ?? []) as SubRow[];

    let sent = 0;
    const gone = new Set<string>();
    const failed = new Map<string, string>();

    const jobs: Promise<void>[] = [];
    for (const sub of subs) {
      const prefs = normalizePrefs(sub.prefs);
      for (const ev of events) {
        if (!matchesPrefs(ev, prefs)) continue;
        const { title, body } = textFor(ev, sub.locale);
        const payload = JSON.stringify({ title, body, url: ev.url, tag: ev.key });
        jobs.push(
          webpush
            .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
              TTL: 3600,
              timeout: PUSH_TIMEOUT_MS,
              urgency: (ev.magnitude ?? 0) >= 7 ? "high" : "normal",
            })
            .then(() => {
              sent++;
            })
            .catch((err: { statusCode?: number; message?: string }) => {
              if (err.statusCode === 404 || err.statusCode === 410) gone.add(sub.endpoint);
              else failed.set(sub.endpoint, err.message ?? `HTTP ${err.statusCode ?? "?"}`);
            })
        );
      }
    }
    await Promise.all(jobs);

    if (gone.size) {
      await db.from("push_subscriptions").delete().in("endpoint", [...gone]);
    }
    for (const [endpoint, message] of failed) {
      if (gone.has(endpoint)) continue;
      const sub = subs.find((s) => s.endpoint === endpoint);
      await db
        .from("push_subscriptions")
        .update({ failures: (sub?.failures ?? 0) + 1, last_error: message.slice(0, 500) })
        .eq("endpoint", endpoint);
    }

    const { error: insError } = await db
      .from("push_sent")
      .upsert(events.map((e) => ({ event_key: e.key })), { onConflict: "event_key" });
    if (insError) throw new Error(`push_sent insert: ${insError.message}`);

    return NextResponse.json({ success: true, events: events.length, sent, removed: gone.size }, { headers: NO_STORE });
  } catch (error) {
    console.error("[api/push/dispatch]", error);
    return NextResponse.json({ success: false, error: "Dispatch failed" }, { status: 500, headers: NO_STORE });
  }
}

export const GET = handle;
export const POST = handle;
