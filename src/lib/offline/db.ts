import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { GridForecast } from "../forecast/types";
import type { ZonePackEvents, ZonePackMeta } from "../zones/types";

export const DB_NAME = "ecopulse";
const DB_VERSION = 1;

export interface EcoPulseDb extends DBSchema {
  packMeta: { key: string; value: ZonePackMeta };
  packData: { key: string; value: { forecast: GridForecast; events: ZonePackEvents } };
  liveSnapshot: { key: string; value: { bundle: string; savedAt: number; data: unknown } };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<EcoPulseDb>> | null = null;

export function getDb(): Promise<IDBPDatabase<EcoPulseDb> | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = openDB<EcoPulseDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("packMeta", { keyPath: "id" });
        db.createObjectStore("packData");
        db.createObjectStore("liveSnapshot");
        db.createObjectStore("kv");
      },
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise.catch(() => null);
}

export async function resetDbForTests(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) (await pending.catch(() => null))?.close();
}
