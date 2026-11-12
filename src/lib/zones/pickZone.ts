import { bboxContains, expandBbox } from "../geo";
import { countryZone, metroZone, tacticalZone } from "./grid";
import { NICARAGUA_BBOX } from "./nicaragua";
import type { ZoneSpec } from "./types";

// Malla que alimenta las capas de clima según lo que se ve en pantalla:
// de lejos el país, a media distancia la zona metropolitana y de cerca la
// táctica. Los ids salen ajustados a la retícula, así mover un poco el mapa
// no cambia de zona ni dispara otra petición.

export const ZONE_ZOOM = { metro: 6.5, tactical: 9.5 } as const;
const COUNTRY_MARGIN_KM = 150;

export function pickZone(lon: number, lat: number, zoom: number): ZoneSpec {
  if (zoom >= ZONE_ZOOM.tactical) return tacticalZone(lon, lat);
  if (zoom >= ZONE_ZOOM.metro) return metroZone(lon, lat);
  return bboxContains(expandBbox(NICARAGUA_BBOX, COUNTRY_MARGIN_KM), lon, lat) ? countryZone() : metroZone(lon, lat);
}
