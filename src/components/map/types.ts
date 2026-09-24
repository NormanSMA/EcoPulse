import type {
  EarthquakeGeoJSON,
  AirQualityGeoJSON,
  FireGeoJSON,
  DisasterGeoJSON,
  IssGeoJSON,
  VolcanoGeoJSON,
  ActiveVolcanoGeoJSON,
  CycloneGeoJSON,
} from "@/lib/types";
import type { LayerKey } from "@/design-system/tokens";
import type { MapView } from "@/lib/mapView";
import type { Selection } from "@/lib/selection";

export type LayerVisibility = Record<LayerKey, boolean>;

export interface MapData {
  earthquakes: EarthquakeGeoJSON;
  fires: FireGeoJSON;
  disasters: DisasterGeoJSON;
  cyclones: CycloneGeoJSON;
  volcanoes: ActiveVolcanoGeoJSON;
  volcanoCatalog: VolcanoGeoJSON | null;
  airQuality: AirQualityGeoJSON;
  iss: IssGeoJSON;
}

/** Props comunes del mapa 2D y del globo 3D: misma entrada, misma salida. */
export interface MapViewProps {
  data: MapData;
  visibility: LayerVisibility;
  /** Instante de referencia (ahora o cursor de reproducción). */
  refTime: number;
  /** Plantilla XYZ del cuadro de radar a mostrar (o null). */
  radarTiles: string | null;
  /** Punto del elemento seleccionado (para el anillo de selección). */
  selectedPoint: [number, number] | null;
  onSelect: (selection: Selection) => void;
  focus?: { lng: number; lat: number; key: number } | null;
  initialView?: MapView;
  onViewChange?: (view: MapView) => void;
}
