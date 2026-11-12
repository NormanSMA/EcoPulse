import type { BundleId } from "../live/bundle";
import { getDb } from "./db";

export async function saveSnapshot(bundle: BundleId | "pulse-week", data: unknown, now = Date.now()): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.put("liveSnapshot", { bundle, savedAt: now, data }, bundle);
    return true;
  } catch {
    return false;
  }
}

export async function loadSnapshot<T>(bundle: BundleId | "pulse-week"): Promise<{ data: T; savedAt: number } | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const row = await db.get("liveSnapshot", bundle);
    return row ? { data: row.data as T, savedAt: row.savedAt } : null;
  } catch {
    return null;
  }
}
