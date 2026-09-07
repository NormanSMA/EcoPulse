import { DisasterEventType, AlertLevel, DisasterFeature, DisasterGeoJSON } from "./types";

const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";

// EQ (sismos) y WF (incendios) ya se cubren con USGS y NASA FIRMS - se excluyen
// para no duplicar capas. Solo se agregan categorias nuevas.
const INCLUDED_TYPES: DisasterEventType[] = ["FL", "TC", "DR", "VO"];

const EVENT_TYPE_LABELS: Record<DisasterEventType, string> = {
  FL: "Inundación",
  TC: "Ciclón tropical",
  DR: "Sequía",
  VO: "Erupción volcánica",
};

function isDisasterEventType(value: string): value is DisasterEventType {
  return (INCLUDED_TYPES as string[]).includes(value);
}

function isAlertLevel(value: string): value is AlertLevel {
  return value === "Green" || value === "Orange" || value === "Red";
}

interface GdacsRawFeature {
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    eventid: number;
    eventtype: string;
    name: string;
    country: string;
    alertlevel: string;
    fromdate: string;
    todate: string;
    url: { report: string };
  };
}

interface GdacsResponse {
  features: GdacsRawFeature[];
}

export function toDisasterFeature(raw: GdacsRawFeature): DisasterFeature | null {
  const { properties, geometry } = raw;
  if (geometry.type !== "Point") return null;
  if (!isDisasterEventType(properties.eventtype)) return null;
  if (!isAlertLevel(properties.alertlevel)) return null;

  const eventId = `${properties.eventtype}-${properties.eventid}`;
  return {
    type: "Feature",
    id: eventId,
    properties: {
      eventId,
      eventType: properties.eventtype,
      eventTypeLabel: EVENT_TYPE_LABELS[properties.eventtype],
      name: properties.name,
      country: properties.country,
      alertLevel: properties.alertlevel,
      fromDate: properties.fromdate ? new Date(properties.fromdate).toISOString() : null,
      toDate: properties.todate ? new Date(properties.todate).toISOString() : null,
      reportUrl: properties.url.report,
    },
    geometry: {
      type: "Point",
      coordinates: geometry.coordinates,
    },
  };
}

export async function fetchLiveDisasters(signal?: AbortSignal): Promise<DisasterGeoJSON> {
  try {
    const res = await fetch(GDACS_URL, { headers: { Accept: "application/json" }, signal });
    if (!res.ok) {
      throw new Error(`GDACS HTTP ${res.status}`);
    }
    const data: GdacsResponse = await res.json();
    const features = data.features
      .map(toDisasterFeature)
      .filter((f): f is DisasterFeature => f !== null);

    return { type: "FeatureCollection", features };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("Error obteniendo desastres de GDACS:", error);
    return { type: "FeatureCollection", features: [] };
  }
}
