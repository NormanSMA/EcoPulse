import type { ActiveVolcanoFeature, ActiveVolcanoGeoJSON } from "./types";

// Volcanes con actividad esta semana: Weekly Volcanic Activity Report
// (Smithsonian GVP + USGS). ~20 volcanes con coordenadas, estado y el texto
// del reporte — mucho más útil que los 1.300 volcanes del catálogo histórico.

const WEEKLY_RSS = "https://volcano.si.edu/news/WeeklyVolcanoRSS.xml";

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

function decodeEntities(s: string): string {
  return s
    .replace(/&(lt|gt|amp|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

/**
 * El feed llega con caracteres ya perdidos en origen ("?" en lugar de "’" y
 * del subíndice de SO₂): se reparan los dos casos que aparecen en la práctica.
 */
export function repairText(s: string): string {
  return s.replace(/\b(SO|CO)\?(?=\W|$)/g, "$1₂").replace(/(\p{L})\?(s|t|re|ll|ve|d)\b/gu, "$1’$2");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tag(item: string, name: string): string | null {
  // Admite atributos (p.ej. <guid isPermaLink="true">).
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(item);
  return m ? m[1].trim() : null;
}

/** "Krakatau (Indonesia) - Report for 10 September-16 September 2026 - New Eruptive Activity" */
export function parseWeeklyTitle(title: string): { name: string; country: string; period: string; isNew: boolean } | null {
  const m = /^(.+?) \((.+?)\) - Report for (.+?) - (.+)$/.exec(title.trim());
  if (!m) return null;
  return { name: m[1], country: m[2], period: m[3], isNew: /new/i.test(m[4]) };
}

export function parseWeeklyRss(xml: string): ActiveVolcanoFeature[] {
  const items = xml.split("<item>").slice(1).map((chunk) => chunk.split("</item>")[0]);
  const features: ActiveVolcanoFeature[] = [];
  for (const item of items) {
    const title = tag(item, "title");
    const point = tag(item, "georss:point");
    if (!title || !point) continue;
    const parsed = parseWeeklyTitle(decodeEntities(title));
    const [lat, lon] = point.split(/\s+/).map(Number);
    if (!parsed || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const html = decodeEntities(tag(item, "description") ?? "");
    const paragraphs = html.split(/<\/p>/i).map((p) => repairText(stripHtml(p))).filter(Boolean);
    const sourcesLine = paragraphs.find((p) => /^Sources?:/i.test(p));
    const summary = paragraphs.filter((p) => p !== sourcesLine).join(" ");
    const guid = tag(item, "guid") ?? "";
    const vn = /vn_(\d+)/.exec(guid)?.[1];

    features.push({
      type: "Feature",
      id: vn ? Number(vn) : features.length,
      properties: {
        name: parsed.name,
        country: parsed.country,
        period: parsed.period,
        status: parsed.isNew ? "new" : "continuing",
        summary,
        sources: sourcesLine?.replace(/^Sources?:\s*/i, "") ?? null,
        reportUrl: vn ? `https://volcano.si.edu/volcano.cfm?vn=${vn}` : "https://volcano.si.edu/reports_weekly.cfm",
        published: (() => {
          const d = Date.parse(tag(item, "pubDate") ?? "");
          return Number.isFinite(d) ? new Date(d).toISOString() : null;
        })(),
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }
  return features;
}

export async function fetchActiveVolcanoes(signal?: AbortSignal): Promise<ActiveVolcanoGeoJSON> {
  try {
    const res = await fetch(WEEKLY_RSS, { signal });
    if (!res.ok) throw new Error(`GVP weekly HTTP ${res.status}`);
    // El feed se sirve en ISO-8859-1.
    const buf = await res.arrayBuffer();
    const xml = new TextDecoder("iso-8859-1").decode(buf);
    return { type: "FeatureCollection", features: parseWeeklyRss(xml) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("Error obteniendo el reporte semanal de volcanes:", error);
    return { type: "FeatureCollection", features: [] };
  }
}
