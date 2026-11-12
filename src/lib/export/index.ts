import type { ExportFile, ExportFormat, ZonePack } from "../zones/types";
import { toCsv } from "./toCsv";
import { toJson } from "./toJson";
import { toReport } from "./toReport";

export { csvCell, toCsv } from "./toCsv";
export { downloadFile } from "./download";
export { toJson } from "./toJson";
export { escapeHtml, toReport } from "./toReport";

export function exportPack(pack: ZonePack, format: ExportFormat, locale: "es" | "en"): ExportFile[] {
  if (format === "json") return [toJson(pack)];
  if (format === "csv") return toCsv(pack);
  return [toReport(pack, locale)];
}
