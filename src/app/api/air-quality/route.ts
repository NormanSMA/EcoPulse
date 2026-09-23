import { NextResponse } from "next/server";
import { fetchLiveAirQuality } from "@/lib/openaq";

// Caché de CDN solo para respuestas OK y con datos: sin esto cada visita
// pega directo a la API externa y consume su cuota. Las librerías devuelven
// una colección vacía cuando la fuente falla — eso tampoco se cachea.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" };
const NO_STORE = { "Cache-Control": "no-store" };
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchLiveAirQuality();
    return NextResponse.json(data, { headers: data.features.length ? CACHE_HEADERS : NO_STORE });
  } catch (error: unknown) {
    console.error("[api/air-quality]", error);
    return NextResponse.json({ success: false, error: "Upstream fetch failed" }, { status: 500, headers: NO_STORE });
  }
}
