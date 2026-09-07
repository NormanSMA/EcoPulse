import { SupabaseClient } from "@supabase/supabase-js";
import { EarthquakeFeature, AirQualityFeature } from "./types";

const EARTHQUAKE_MAGNITUDE_THRESHOLD = 6.0;
const DEDUP_WINDOW_HOURS = 1;

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline: boolean }[];
  url: string;
}

type AlertSourceType = "earthquake" | "air_quality";

export function shouldAlertEarthquake(feature: EarthquakeFeature): boolean {
  return (feature.properties.mag ?? 0) > EARTHQUAKE_MAGNITUDE_THRESHOLD;
}

export function shouldAlertAirQuality(feature: AirQualityFeature): boolean {
  return feature.properties.category === "hazardous";
}

export function buildEarthquakeEmbed(feature: EarthquakeFeature, appUrl: string): DiscordEmbed {
  const [lon, lat] = feature.geometry.coordinates;
  return {
    title: "🚨 ALERTA DE SISMO FUERTE",
    description: `Se ha detectado un sismo de magnitud ${feature.properties.mag} en ${feature.properties.place}.`,
    color: 0x8b0000,
    fields: [
      { name: "Coordenadas", value: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, inline: true },
      { name: "Hora", value: new Date(feature.properties.time).toISOString(), inline: true },
    ],
    url: appUrl,
  };
}

export function buildAirQualityEmbed(feature: AirQualityFeature, appUrl: string): DiscordEmbed {
  const [lon, lat] = feature.geometry.coordinates;
  return {
    title: "⚠️ CALIDAD DE AIRE PELIGROSA",
    description: `${feature.properties.station} reporta PM2.5 de ${feature.properties.pm25} µg/m³ (categoría: hazardous).`,
    color: 0xff8c00,
    fields: [
      { name: "Coordenadas", value: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, inline: true },
      { name: "Medido", value: feature.properties.updated, inline: true },
    ],
    url: appUrl,
  };
}

export async function sendDiscordAlert(webhookUrl: string, embed: DiscordEmbed): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook respondio HTTP ${res.status}`);
  }
}

async function wasRecentlyNotified(
  supabaseAdmin: SupabaseClient,
  sourceType: AlertSourceType,
  sourceId: string
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("sent_alerts")
    .select("id")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .gte("sent_at", since)
    .limit(1);

  if (error) throw new Error(`sent_alerts lookup: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

async function recordAlertSent(
  supabaseAdmin: SupabaseClient,
  sourceType: AlertSourceType,
  sourceId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("sent_alerts")
    .insert({ source_type: sourceType, source_id: sourceId });
  if (error) throw new Error(`sent_alerts insert: ${error.message}`);
}

interface AlertDeps {
  supabaseAdmin: SupabaseClient;
  webhookUrl: string;
  appUrl: string;
}

export async function processEarthquakeAlerts(
  deps: AlertDeps,
  features: EarthquakeFeature[]
): Promise<number> {
  let sent = 0;
  for (const feature of features.filter(shouldAlertEarthquake)) {
    const sourceId = String(feature.id);
    if (await wasRecentlyNotified(deps.supabaseAdmin, "earthquake", sourceId)) continue;
    await sendDiscordAlert(deps.webhookUrl, buildEarthquakeEmbed(feature, deps.appUrl));
    await recordAlertSent(deps.supabaseAdmin, "earthquake", sourceId);
    sent++;
  }
  return sent;
}

export async function processAirQualityAlerts(
  deps: AlertDeps,
  features: AirQualityFeature[]
): Promise<number> {
  let sent = 0;
  for (const feature of features.filter(shouldAlertAirQuality)) {
    const sourceId = String(feature.id);
    if (await wasRecentlyNotified(deps.supabaseAdmin, "air_quality", sourceId)) continue;
    await sendDiscordAlert(deps.webhookUrl, buildAirQualityEmbed(feature, deps.appUrl));
    await recordAlertSent(deps.supabaseAdmin, "air_quality", sourceId);
    sent++;
  }
  return sent;
}
