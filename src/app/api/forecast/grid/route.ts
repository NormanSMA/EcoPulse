import { badRequest, cachedJson, hasOnlyParams, upstreamError } from "@/lib/apiResponse";
import { fetchGridForecast } from "@/lib/forecast/openMeteo";
import type { GridForecast } from "@/lib/forecast/types";
import { airEveryFor, gridPoints, zoneFromId } from "@/lib/zones/grid";
import type { ZoneSpec } from "@/lib/zones/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TTL_SECONDS = 1800;
const MAX_POINTS = 80;
const MAX_ID_LENGTH = 64;

export interface GridForecastResponse {
  zone: ZoneSpec;
  forecast: GridForecast;
}

// Pronóstico de 72 h sobre la malla de una zona. El cliente solo envía el id
// de zona: la malla la calcula el servidor (ajustada a una retícula global),
// así nadie puede pedir listas arbitrarias de puntos y las zonas vecinas
// comparten respuesta en el CDN. Una llamada a Open-Meteo por API.
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!hasOnlyParams(url, ["zone"])) return badRequest("parámetros no admitidos");
  const id = url.searchParams.get("zone") ?? "";
  const zone = id && id.length <= MAX_ID_LENGTH ? zoneFromId(id) : null;
  // El id debe venir en su forma canónica (la que genera el cliente): "tactical:012.10,-86.3"
  // y "tactical:12.1,-86.30" son la misma malla, pero serían dos claves de CDN.
  if (!zone || zone.id !== id) return badRequest("zone inválida: usa country:ni, metro:ni-<departamento>, metro:<lat>,<lon> o tactical:<lat>,<lon>");

  // Una caja pegada al antimeridiano puede salirse de ±180°: esos puntos no existen.
  const points = gridPoints(zone).filter((point) => Math.abs(point.lon) <= 180 && Math.abs(point.lat) <= 90);
  if (points.length === 0 || points.length > MAX_POINTS) return badRequest("la zona no produce una malla válida");

  try {
    const forecast = await fetchGridForecast(points, request.signal, airEveryFor(zone));
    const body: GridForecastResponse = { zone, forecast };
    return cachedJson(body, TTL_SECONDS, forecast.time.length > 0);
  } catch (error) {
    return upstreamError("forecast/grid", error);
  }
}
