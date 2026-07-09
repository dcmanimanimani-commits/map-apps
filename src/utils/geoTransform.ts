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

/** 九州地方ズーム時に残す離島（対馬・五島・種子島・屋久島） */
const KYUSHU_MAINLAND_BOX = { minLon: 129.8, maxLon: 131.7, minLat: 31.2, maxLat: 33.2 };
const KYUSHU_KEEP_ISLANDS = [
  { minLon: 129.0, maxLon: 130.0, minLat: 33.95, maxLat: 34.8 }, // 対馬
  { minLon: 128.5, maxLon: 129.25, minLat: 32.2, maxLat: 33.45 }, // 五島
  { minLon: 130.7, maxLon: 131.25, minLat: 30.2, maxLat: 30.75 }, // 種子島
  { minLon: 130.2, maxLon: 130.75, minLat: 30.15, maxLat: 30.55 }, // 屋久島
] as const;

function polygonBoundingBox(polygon: Position[][]): {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
} {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const ring of polygon) {
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  return { minLon, maxLon, minLat, maxLat };
}

function centroidInBox(
  centroid: [number, number],
  box: { minLon: number; maxLon: number; minLat: number; maxLat: number },
): boolean {
  const [lon, lat] = centroid;
  return lon >= box.minLon && lon <= box.maxLon && lat >= box.minLat && lat <= box.maxLat;
}

function overlapsKyushuMainland(box: ReturnType<typeof polygonBoundingBox>): boolean {
  return (
    box.minLat < KYUSHU_MAINLAND_BOX.maxLat
    && box.maxLat > KYUSHU_MAINLAND_BOX.minLat
    && box.minLon < KYUSHU_MAINLAND_BOX.maxLon
    && box.maxLon > KYUSHU_MAINLAND_BOX.minLon
  );
}

function shouldKeepKyushuPolygon(polygon: Position[][]): boolean {
  const box = polygonBoundingBox(polygon);
  if (overlapsKyushuMainland(box)) return true;
  const centroid = polygonCentroid(polygon);
  return KYUSHU_KEEP_ISLANDS.some((zone) => centroidInBox(centroid, zone));
}

function filterGeometryForKyushuDisplay(
  geometry: Polygon | MultiPolygon,
): Polygon | MultiPolygon | null {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates;
  const kept = polygons.filter(shouldKeepKyushuPolygon);
  if (kept.length === 0) return null;
  if (kept.length === 1) return { type: 'Polygon', coordinates: kept[0] };
  return { type: 'MultiPolygon', coordinates: kept };
}

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

function trimFeatureForRegionFocus(feature: PrefectureFeature): PrefectureFeature | null {
  const kanji = feature.properties?.nam_ja;
  if (kanji === '長崎県' || kanji === '鹿児島県') {
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
      return feature;
    }
    const filtered = filterGeometryForKyushuDisplay(feature.geometry);
    if (!filtered) return null;
    return { ...feature, geometry: filtered };
  }
  return trimFeatureForFit(feature);
}

export function trimMainlandForProjection(mainland: JapanGeoJSON): JapanGeoJSON {
  return {
    type: 'FeatureCollection',
    features: mainland.features
      .map((f) => trimFeatureForFit(f as PrefectureFeature))
      .filter((f): f is PrefectureFeature => f !== null),
  };
}

/** 地方ズーム用：陸地を大きく見せるため離島を整理してから投影・描画する */
export function trimForRegionFocus(mainland: JapanGeoJSON): JapanGeoJSON {
  return {
    type: 'FeatureCollection',
    features: mainland.features
      .map((f) => trimFeatureForRegionFocus(f as PrefectureFeature))
      .filter((f): f is PrefectureFeature => f !== null),
  };
}

function polygonBoundingArea(polygon: Position[][]): number {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const ring of polygon) {
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  return (maxLon - minLon) * (maxLat - minLat);
}

function polygonCentroid(polygon: Position[][]): [number, number] {
  const ring = polygon[0];
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of ring) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / ring.length, sumLat / ring.length];
}

/** インセット用：右上に見える大きな島1つだけ（沖縄本島）を枠中央で表示 */
export function simplifyOkinawaForInset(feature: PrefectureFeature): PrefectureFeature {
  if (feature.geometry.type !== 'MultiPolygon') return feature;

  const candidates = [...feature.geometry.coordinates]
    .map((polygon) => ({
      polygon,
      area: polygonBoundingArea(polygon),
      centroid: polygonCentroid(polygon),
    }))
    .sort((a, b) => b.area - a.area)
    .slice(0, 2);

  if (candidates.length === 0) return feature;

  // 2島表示時の右上側（北東）の島を採用
  const chosen = [...candidates].sort(
    (a, b) => (b.centroid[0] + b.centroid[1]) - (a.centroid[0] + a.centroid[1]),
  )[0];

  return {
    ...feature,
    geometry: { type: 'Polygon', coordinates: chosen.polygon },
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
