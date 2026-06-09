import type {
  Feature,
  Geometry,
  GeoJsonProperties,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';

export const OKINAWA_KANJI = '沖縄県';

export type PrefectureFeature = Feature<
  Geometry,
  GeoJsonProperties & { nam?: string; nam_ja?: string; id?: number }
>;

type CoordInput = Position | Position[] | Position[][] | Position[][][];

function maxLatitude(coords: CoordInput): number {
  if (coords.length >= 2 && typeof coords[0] === 'number') {
    return (coords as Position)[1];
  }
  return Math.max(...(coords as CoordInput[]).map(maxLatitude));
}

function filterGeometryByMinLat(
  geometry: Polygon | MultiPolygon,
  minLat: number,
): Polygon | MultiPolygon | null {
  if (geometry.type === 'Polygon') {
    return maxLatitude(geometry.coordinates) >= minLat ? geometry : null;
  }

  const kept = geometry.coordinates.filter((polygon) => maxLatitude(polygon) >= minLat);
  if (kept.length === 0) return null;
  if (kept.length === 1) {
    return { type: 'Polygon', coordinates: kept[0] };
  }
  return { type: 'MultiPolygon', coordinates: kept };
}

/** 投影の縮尺計算用：遠い離島を除いて本土を大きく表示 */
const TRIM_RULES: Record<string, number> = {
  東京都: 34.3,
  鹿児島県: 30.2,
};

function trimFeatureForFit(feature: PrefectureFeature): PrefectureFeature | null {
  const kanji = feature.properties?.nam_ja;
  const minLat = kanji ? TRIM_RULES[kanji] : undefined;
  if (!minLat) return feature;
  if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
    return feature;
  }

  const trimmed = filterGeometryByMinLat(feature.geometry, minLat);
  if (!trimmed) return null;

  return { ...feature, geometry: trimmed };
}

export function trimMainlandForProjection(mainland: JapanGeoJSON): JapanGeoJSON {
  return {
    type: 'FeatureCollection',
    features: mainland.features
      .map((f) => trimFeatureForFit(f as PrefectureFeature))
      .filter((f): f is PrefectureFeature => f !== null),
  };
}

export function splitMainlandAndOkinawa(geo: JapanGeoJSON): {
  mainland: JapanGeoJSON;
  okinawa: PrefectureFeature | null;
} {
  const okinawa =
    (geo.features.find((f) => f.properties?.nam_ja === OKINAWA_KANJI) as PrefectureFeature) ?? null;

  return {
    mainland: {
      type: 'FeatureCollection',
      features: geo.features.filter((f) => f.properties?.nam_ja !== OKINAWA_KANJI),
    },
    okinawa,
  };
}
