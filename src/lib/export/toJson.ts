import type { ExportFile, ZonePack } from "../zones/types";

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "zona";
}

function stamp(ms: number): string {
  const d = new Date(ms).toISOString();
  return `${d.slice(0, 10).replace(/-/g, "")}-${d.slice(11, 13)}${d.slice(14, 16)}`;
}

export function exportBaseName(pack: ZonePack): string {
  return `ecopulse-${slug(pack.meta.zone.id)}-${stamp(pack.meta.createdAt)}`;
}

export function toJson(pack: ZonePack): ExportFile {
  return {
    filename: `${exportBaseName(pack)}.json`,
    mime: "application/json",
    content: JSON.stringify(pack, null, 2),
  };
}
