import { badRequest, cachedJson, upstreamError } from "@/lib/apiResponse";
import { loadSeismicHistory, parseSeismicHistoryQuery } from "@/lib/seismicHistory";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = parseSeismicHistoryQuery(new URL(request.url).searchParams);
  if (!query) {
    return badRequest("parámetros inválidos: usa mode=point con lat/lon o mode=boundary con plates, por ejemplo NZ-SA");
  }
  try {
    const history = await loadSeismicHistory(query, request.signal);
    return cachedJson(history, query.mode === "point" ? 900 : 86_400, history.features.length > 0);
  } catch (error) {
    return upstreamError("seismic-history", error);
  }
}
