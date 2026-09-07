import { NextResponse } from "next/server";
import { fetchLiveEarthquakes } from "@/lib/usgs";
import { fetchLiveAirQuality } from "@/lib/openaq";
import { fetchLiveFires } from "@/lib/firms";
import { fetchLiveWeather } from "@/lib/weather";
import { fetchLiveDisasters } from "@/lib/gdacs";
import { fetchLiveIssPosition } from "@/lib/iss";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { toEarthquakeRow, toAirQualityRow, toFireRow, toWeatherRow, toDisasterRow, toIssRow, dedupeByKey, isIngestAuthorized } from "@/lib/ingest";
import { processEarthquakeAlerts, processAirQualityAlerts } from "@/lib/discordAlerts";

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

    const fires = await fetchLiveFires();
    const fireRows = dedupeByKey(fires.features.map(toFireRow), "fire_key");
    const fireResult = fireRows.length
      ? await supabaseAdmin.from("fires").upsert(fireRows, { onConflict: "fire_key" })
      : { error: null };
    if (fireResult.error) throw new Error(`fires upsert: ${fireResult.error.message}`);

    const weather = await fetchLiveWeather();
    const weatherRows = weather.features.map(toWeatherRow);
    const weatherResult = weatherRows.length
      ? await supabaseAdmin.from("weather").upsert(weatherRows, { onConflict: "city" })
      : { error: null };
    if (weatherResult.error) throw new Error(`weather upsert: ${weatherResult.error.message}`);

    const disasters = await fetchLiveDisasters();
    const disasterRows = disasters.features.map(toDisasterRow);
    const disasterResult = disasterRows.length
      ? await supabaseAdmin.from("disasters").upsert(disasterRows, { onConflict: "event_id" })
      : { error: null };
    if (disasterResult.error) throw new Error(`disasters upsert: ${disasterResult.error.message}`);

    const iss = await fetchLiveIssPosition();
    const issRows = iss.features.map(toIssRow);
    const issResult = issRows.length
      ? await supabaseAdmin.from("iss_position").upsert(issRows, { onConflict: "id" })
      : { error: null };
    if (issResult.error) throw new Error(`iss_position upsert: ${issResult.error.message}`);

    let earthquakeAlertsSent = 0;
    let airQualityAlertsSent = 0;
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      const appUrl = process.env.APP_URL || "https://ecopulse-app.example.com";
      const deps = { supabaseAdmin, webhookUrl, appUrl };
      earthquakeAlertsSent = await processEarthquakeAlerts(deps, earthquakes.features);
      airQualityAlertsSent = await processAirQualityAlerts(deps, airQuality.features);
    }

    return NextResponse.json({
      success: true,
      earthquakesUpserted: earthquakeRows.length,
      airQualityUpserted: airQualityRows.length,
      firesUpserted: fireRows.length,
      weatherUpserted: weatherRows.length,
      disastersUpserted: disasterRows.length,
      issUpserted: issRows.length,
      earthquakeAlertsSent,
      airQualityAlertsSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
