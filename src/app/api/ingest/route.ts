import { NextResponse } from "next/server";
import { fetchLiveEarthquakes } from "@/lib/usgs";
import { fetchLiveAirQuality } from "@/lib/openaq";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { toEarthquakeRow, toAirQualityRow, isIngestAuthorized } from "@/lib/ingest";

export async function GET(request: Request) {
  if (!isIngestAuthorized(request, process.env.INGEST_SECRET)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const earthquakes = await fetchLiveEarthquakes();
    const earthquakeRows = earthquakes.features.map(toEarthquakeRow);
    const eqResult = earthquakeRows.length
      ? await supabaseAdmin.from("earthquakes").upsert(earthquakeRows, { onConflict: "usgs_id" })
      : { error: null };
    if (eqResult.error) throw new Error(`earthquakes upsert: ${eqResult.error.message}`);

    const airQuality = await fetchLiveAirQuality();
    const airQualityRows = airQuality.features.map(toAirQualityRow);
    const aqResult = airQualityRows.length
      ? await supabaseAdmin.from("air_quality").upsert(airQualityRows, { onConflict: "station_id" })
      : { error: null };
    if (aqResult.error) throw new Error(`air_quality upsert: ${aqResult.error.message}`);

    return NextResponse.json({
      success: true,
      earthquakesUpserted: earthquakeRows.length,
      airQualityUpserted: airQualityRows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
