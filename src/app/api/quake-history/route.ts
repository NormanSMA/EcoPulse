import { fetchQuakeHistory } from "@/lib/earthquakes";
import { badRequest, cachedJson, parseLatLon, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Historial sísmico de la zona (30 días, radio 150 km) para el panel de detalle.
export async function GET(request: Request) {
  const point = parseLatLon(new URL(request.url));
  if (!point) return badRequest("lat/lon inválidos");
  try {
    const features = await fetchQuakeHistory(point.lat, point.lon);
    return cachedJson({ type: "FeatureCollection", features }, 900, true);
  } catch (error) {
    return upstreamError("quake-history", error);
  }
}
