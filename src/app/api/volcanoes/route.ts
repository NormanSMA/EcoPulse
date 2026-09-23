import { NextResponse } from "next/server";
import { fetchVolcanoes } from "@/lib/gvp";

// Caché de CDN solo para respuestas OK y con datos: sin esto cada visita
// pega directo a la API externa y consume su cuota. Las librerías devuelven
// una colección vacía cuando la fuente falla — eso tampoco se cachea.
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=518400" };
const NO_STORE = { "Cache-Control": "no-store" };
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchVolcanoes();
    return NextResponse.json(data, { headers: data.features.length ? CACHE_HEADERS : NO_STORE });
  } catch (error: unknown) {
    console.error("[api/volcanoes]", error);
    return NextResponse.json({ success: false, error: "Upstream fetch failed" }, { status: 500, headers: NO_STORE });
  }
}
