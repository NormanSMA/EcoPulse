import { fetchStationHistory } from "@/lib/openaq";
import { badRequest, cachedJson, upstreamError } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

// Nombre e historial de 48 h de una estación OpenAQ (panel de detalle).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const location = Number(url.searchParams.get("location"));
  const sensor = Number(url.searchParams.get("sensor"));
  if (!Number.isInteger(location) || !Number.isInteger(sensor) || location <= 0 || sensor <= 0) {
    return badRequest("location/sensor inválidos");
  }
  try {
    const data = await fetchStationHistory(location, sensor);
    return cachedJson(data, 1800, data.history.length > 0);
  } catch (error) {
    return upstreamError("air-quality/station", error);
  }
}
