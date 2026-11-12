import { NextResponse } from "next/server";
import { badRequest, hasOnlyParams, upstreamError } from "@/lib/apiResponse";
import { bundleCacheControl } from "@/lib/live/bundle";
import { BUNDLE_SWR_SECONDS, isBundleId, loadLiveBundle } from "@/lib/live/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Datos en vivo agrupados por frecuencia de cambio:
//   pulse   sismos (?period=day|week)
//   hazards incendios, desastres, ciclones y volcanes activos
//   orbit   ISS con efeméride para mover el marcador en el cliente
export async function GET(request: Request, { params }: { params: Promise<{ bundle: string }> }) {
  const { bundle: id } = await params;
  if (!isBundleId(id)) {
    return NextResponse.json({ success: false, error: "lote desconocido" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const url = new URL(request.url);
  // Solo `period`, y solo en el lote de sismos: cualquier otro parámetro sería una clave de CDN distinta.
  if (!hasOnlyParams(url, id === "pulse" ? ["period"] : [])) return badRequest("parámetros no admitidos");
  const period = url.searchParams.get("period") ?? "day";
  if (period !== "day" && period !== "week") return badRequest("period inválido");
  try {
    const bundle = await loadLiveBundle(id, period, request.signal);
    return NextResponse.json(bundle, { headers: { "Cache-Control": bundleCacheControl(bundle, BUNDLE_SWR_SECONDS[id]) } });
  } catch (error) {
    return upstreamError(`live/${id}`, error);
  }
}
