import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import {
  createMainlandPathGenerator,
  createOkinawaInsetPathGenerator,
  createOkinawaFullPathGenerator,
  getFeatureKanji,
  getOkinawaInsetLayout,
  getProjectedCentroid,
  OKINAWA_INSET_SCALE_FULL,
} from './geo';
import { OKINAWA_KANJI, simplifyOkinawaForInset, splitMainlandAndOkinawa } from './geoTransform';

export interface MapPoint {
  x: number;
  y: number;
}

/** 全県の地図上座標（重心）を構築 */
export function buildPrefectureCentroids(
  geo: JapanGeoJSON,
  width: number,
  height: number,
): Map<string, MapPoint> {
  const positions = new Map<string, MapPoint>();
  const { mainland, okinawa } = splitMainlandAndOkinawa(geo);
  const mainlandPathGen = createMainlandPathGenerator(mainland, width, height);

  for (const feature of mainland.features) {
    const kanji = getFeatureKanji(feature as Feature<Geometry, GeoJsonProperties & { nam_ja?: string }>);
    const point = getProjectedCentroid(feature as Feature<Geometry, GeoJsonProperties>, mainlandPathGen);
    if (point) positions.set(kanji, { x: point[0], y: point[1] });
  }

  if (okinawa) {
    const layout = getOkinawaInsetLayout(width, height);
    const simplified = simplifyOkinawaForInset(okinawa);
    const insetPathGen = createOkinawaInsetPathGenerator(
      okinawa,
      layout,
      width,
      height,
      OKINAWA_INSET_SCALE_FULL,
    );
    const insetPoint = getProjectedCentroid(simplified, insetPathGen);
    if (insetPoint) positions.set(OKINAWA_KANJI, { x: insetPoint[0], y: insetPoint[1] });

    const fullPathGen = createOkinawaFullPathGenerator(okinawa, width, height);
    const fullPoint = getProjectedCentroid(simplified, fullPathGen);
    if (fullPoint && !positions.has(OKINAWA_KANJI)) {
      positions.set(OKINAWA_KANJI, { x: fullPoint[0], y: fullPoint[1] });
    }
  }

  return positions;
}

export function mapDistance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clampToMap(point: MapPoint, width: number, height: number, margin = 16): MapPoint {
  return {
    x: Math.min(width - margin, Math.max(margin, point.x)),
    y: Math.min(height - margin, Math.max(margin, point.y)),
  };
}

export function moveToward(from: MapPoint, to: MapPoint, speed: number): MapPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= speed || dist === 0) return { x: to.x, y: to.y };
  return {
    x: from.x + (dx / dist) * speed,
    y: from.y + (dy / dist) * speed,
  };
}
