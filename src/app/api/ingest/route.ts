import { NextResponse } from "next/server";
import { fetchLiveEarthquakes } from "@/lib/usgs";
import { fetchLiveAirQuality } from "@/lib/openaq";
import { fetchLiveFires } from "@/lib/firms";
import { fetchLiveWeather } from "@/lib/weather";
import { fetchLiveDisasters } from "@/lib/gdacs";
import { fetchLiveIssPosition } from "@/lib/iss";
import { fetchVolcanoes } from "@/lib/gvp";
import { fetchModeledAirQuality } from "@/lib/openMeteoAirQuality";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { toEarthquakeRow, toAirQualityRow, toFireRow, toWeatherRow, toDisasterRow, toIssRow, toVolcanoRow, toAirQualityModelRow, dedupeByKey, isIngestAuthorized } from "@/lib/ingest";
import { processEarthquakeAlerts, processAirQualityAlerts } from "@/lib/discordAlerts";

// Con 8 fuentes externas y ~3500 filas totales (sobre todo incendios y
// volcanes), la ingesta secuencial tardaba ~40s. Vercel corta funciones
// serverless a los 10s por defecto.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isIngestAuthorized(request, process.env.INGEST_SECRET)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Las 8 fuentes externas son independientes entre si: se piden en
    // paralelo en vez de una por una.
    const [earthquakes, airQuality, fires, weather, disasters, iss, volcanoes, airQualityModel] =
      await Promise.all([
        fetchLiveEarthquakes(),
        fetchLiveAirQuality(),
        fetchLiveFires(),
        fetchLiveWeather(),
        fetchLiveDisasters(),
        fetchLiveIssPosition(),
        fetchVolcanoes(),
        fetchModeledAirQuality(),
      ]);

    const earthquakeRows = earthquakes.features.map(toEarthquakeRow);
    const airQualityRows = airQuality.features.map(toAirQualityRow);
    const fireRows = dedupeByKey(fires.features.map(toFireRow), "fire_key");
    const weatherRows = weather.features.map(toWeatherRow);
    const disasterRows = disasters.features.map(toDisasterRow);
    const issRows = iss.features.map(toIssRow);
    const volcanoRows = volcanoes.features.map(toVolcanoRow);
    const airQualityModelRows = airQualityModel.features.map(toAirQualityModelRow);

    // Cada upsert va a una tabla distinta - tambien se corren en paralelo.
    const [
      eqResult,
      aqResult,
      fireResult,
      weatherResult,
      disasterResult,
      issResult,
      volcanoResult,
      airQualityModelResult,
    ] = await Promise.all([
      earthquakeRows.length
        ? supabaseAdmin.from("earthquakes").upsert(earthquakeRows, { onConflict: "usgs_id" })
        : { error: null },
      airQualityRows.length
        ? supabaseAdmin.from("air_quality").upsert(airQualityRows, { onConflict: "station_id" })
        : { error: null },
      fireRows.length
        ? supabaseAdmin.from("fires").upsert(fireRows, { onConflict: "fire_key" })
        : { error: null },
      weatherRows.length
        ? supabaseAdmin.from("weather").upsert(weatherRows, { onConflict: "city" })
        : { error: null },
      disasterRows.length
        ? supabaseAdmin.from("disasters").upsert(disasterRows, { onConflict: "event_id" })
        : { error: null },
      issRows.length
        ? supabaseAdmin.from("iss_position").upsert(issRows, { onConflict: "id" })
        : { error: null },
      volcanoRows.length
        ? supabaseAdmin.from("volcanoes").upsert(volcanoRows, { onConflict: "volcano_number" })
        : { error: null },
      airQualityModelRows.length
        ? supabaseAdmin.from("air_quality_model").upsert(airQualityModelRows, { onConflict: "city" })
        : { error: null },
    ]);

    if (eqResult.error) throw new Error(`earthquakes upsert: ${eqResult.error.message}`);
    if (aqResult.error) throw new Error(`air_quality upsert: ${aqResult.error.message}`);
    if (fireResult.error) throw new Error(`fires upsert: ${fireResult.error.message}`);
    if (weatherResult.error) throw new Error(`weather upsert: ${weatherResult.error.message}`);
    if (disasterResult.error) throw new Error(`disasters upsert: ${disasterResult.error.message}`);
    if (issResult.error) throw new Error(`iss_position upsert: ${issResult.error.message}`);
    if (volcanoResult.error) throw new Error(`volcanoes upsert: ${volcanoResult.error.message}`);
    if (airQualityModelResult.error) {
      throw new Error(`air_quality_model upsert: ${airQualityModelResult.error.message}`);
    }

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
      volcanoesUpserted: volcanoRows.length,
      airQualityModelUpserted: airQualityModelRows.length,
      earthquakeAlertsSent,
      airQualityAlertsSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
