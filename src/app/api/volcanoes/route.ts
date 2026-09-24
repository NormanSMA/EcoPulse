import { fetchVolcanoes } from "@/lib/gvp";
import { fetchActiveVolcanoes } from "@/lib/gvpWeekly";
import { cachedJson, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Por defecto: volcanes con actividad esta semana (reporte Smithsonian/USGS).
// ?catalog=1: catálogo histórico completo del Holoceno (GVP).
export async function GET(request: Request) {
  const catalog = new URL(request.url).searchParams.get("catalog") === "1";
  try {
    const data = catalog ? await fetchVolcanoes() : await fetchActiveVolcanoes();
    return cachedJson(data, catalog ? 86400 : 3600, data.features.length > 0);
  } catch (error) {
    return upstreamError("volcanoes", error);
  }
}
