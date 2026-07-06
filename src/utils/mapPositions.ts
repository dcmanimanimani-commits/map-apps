import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { PREFECTURE_CAPITALS } from '../data/prefectureCapitals';
import {
  createMainlandProjection,
  createMainlandPathGenerator,
  createOkinawaInsetPathGenerator,
  createOkinawaFullPathGenerator,
  getFeatureKanji,
  getOkinawaInsetLayout,
  getProjectedCentroid,
  OKINAWA_INSET_SCALE_FULL,
} from './geo';
import { OKINAWA_KANJI, simplifyOkinawaForInset, splitMainlandAndOkinawa } from './geoTransform';
import { geometryToProjectedRings, pointInPolygon } from './mapLabels';

export interface MapPoint {
  x: number;
  y: number;
}

/** たんけんモードのズーム（1=初期。大きいほどワールド拡大＝画面上の地図が大きく見える） */
const ADVENTURE_ZOOM = 1.5 * 2;
export const ADVENTURE_WORLD_SCALE_W = 6.5 * ADVENTURE_ZOOM;
export const ADVENTURE_WORLD_SCALE_H = 5.5 * ADVENTURE_ZOOM;

/** 画面に約1地方が入るようワールドを拡大 */
export function buildWorldSize(viewportW: number, viewportH: number): { width: number; height: number } {
  return {
    width: Math.round(viewportW * ADVENTURE_WORLD_SCALE_W),
    height: Math.round(viewportH * ADVENTURE_WORLD_SCALE_H),
  };
}

export function getCamera(
  player: MapPoint,
  viewportW: number,
  viewportH: number,
  worldW: number,
  worldH: number,
): MapPoint {
  return {
    x: Math.max(0, Math.min(worldW - viewportW, player.x - viewportW / 2)),
    y: Math.max(0, Math.min(worldH - viewportH, player.y - viewportH / 2)),
  };
}

export function clientToWorld(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  camera: MapPoint,
): MapPoint {
  return {
    x: clientX - rect.left + camera.x,
    y: clientY - rect.top + camera.y,
  };
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

/** 全県の県庁所在地を地図座標に変換 */
export function buildPrefectureCapitalPositions(
  geo: JapanGeoJSON,
  width: number,
  height: number,
): Map<string, MapPoint> {
  const positions = new Map<string, MapPoint>();
  const { mainland, okinawa } = splitMainlandAndOkinawa(geo);
  const mainlandProjection = createMainlandProjection(mainland, width, height);

  for (const capital of PREFECTURE_CAPITALS) {
    if (capital.kanji === OKINAWA_KANJI) continue;
    const projected = mainlandProjection([capital.lon, capital.lat]);
    if (projected) {
      positions.set(capital.kanji, { x: projected[0], y: projected[1] });
    }
  }

  if (okinawa) {
    const okinawaCapital = PREFECTURE_CAPITALS.find((c) => c.kanji === OKINAWA_KANJI);
    if (okinawaCapital) {
      const layout = getOkinawaInsetLayout(width, height);
      const insetPathGen = createOkinawaInsetPathGenerator(
        okinawa,
        layout,
        width,
        height,
        OKINAWA_INSET_SCALE_FULL,
      );
      const insetProjection = insetPathGen.projection();
      if (insetProjection && typeof insetProjection === 'function') {
        const projected = (insetProjection as (coords: [number, number]) => [number, number] | null)(
          [okinawaCapital.lon, okinawaCapital.lat],
        );
        if (projected) {
          positions.set(OKINAWA_KANJI, { x: projected[0], y: projected[1] });
        }
      }
    }
  }

  return positions;
}

function pointInPrefectureRings(point: MapPoint, rings: [number, number][][]): boolean {
  for (const ring of rings) {
    if (ring.length >= 3 && pointInPolygon(point.x, point.y, ring)) return true;
  }
  return false;
}

/** 地図座標からその地点の都道府県（漢字名）を返す */
export function findPrefectureAtPoint(
  point: MapPoint,
  geo: JapanGeoJSON,
  width: number,
  height: number,
): string | null {
  const { mainland, okinawa } = splitMainlandAndOkinawa(geo);

  if (okinawa) {
    const layout = getOkinawaInsetLayout(width, height);
    if (point.x >= layout.cornerX && point.y >= layout.cornerY) {
      const insetPathGen = createOkinawaInsetPathGenerator(
        okinawa,
        layout,
        width,
        height,
        OKINAWA_INSET_SCALE_FULL,
      );
      const insetProjection = insetPathGen.projection();
      if (insetProjection && typeof insetProjection === 'function') {
        const project = insetProjection as (coords: [number, number]) => [number, number] | null;
        const rings = geometryToProjectedRings(simplifyOkinawaForInset(okinawa).geometry, project);
        if (pointInPrefectureRings(point, rings)) return OKINAWA_KANJI;
      }
    }
  }

  const mainlandPathGen = createMainlandPathGenerator(mainland, width, height);
  const projection = mainlandPathGen.projection();
  if (!projection || typeof projection !== 'function') return null;
  const project = projection as (coords: [number, number]) => [number, number] | null;

  for (const feature of mainland.features) {
    const kanji = getFeatureKanji(feature as Feature<Geometry, GeoJsonProperties & { nam_ja?: string }>);
    const rings = geometryToProjectedRings(
      (feature as Feature<Geometry, GeoJsonProperties>).geometry,
      project,
    );
    if (pointInPrefectureRings(point, rings)) return kanji;
  }

  return null;
}

/** 地点に対応する県がないとき、最も近い県庁所在地の県を返す */
export function findNearestPrefectureByCapital(
  point: MapPoint,
  capitals: Map<string, MapPoint>,
): string | null {
  let bestKanji: string | null = null;
  let bestDist = Infinity;
  for (const [kanji, pos] of capitals) {
    const d = mapDistance(point, pos);
    if (d < bestDist) {
      bestDist = d;
      bestKanji = kanji;
    }
  }
  return bestKanji;
}

function isOutsideViewport(
  pos: MapPoint,
  camera: MapPoint,
  viewW: number,
  viewH: number,
): boolean {
  const relX = pos.x - camera.x;
  const relY = pos.y - camera.y;
  return relX < 0 || relX > viewW || relY < 0 || relY > viewH;
}

function isNearViewportEdgeBand(
  pos: MapPoint,
  camera: MapPoint,
  viewW: number,
  viewH: number,
  bandRatio: number,
): boolean {
  const relX = pos.x - camera.x;
  const relY = pos.y - camera.y;
  if (relX < 0 || relX > viewW || relY < 0 || relY > viewH) return false;
  const bandX = viewW * bandRatio;
  const bandY = viewH * bandRatio;
  return relX < bandX || relX > viewW - bandX || relY < bandY || relY > viewH - bandY;
}

/**
 * 画面外（または端付近）の別県の県庁所在地から鬼を出現させる。
 */
export function pickOniSpawnAtEdgeCapital(
  player: MapPoint,
  geo: JapanGeoJSON,
  worldW: number,
  worldH: number,
  viewW: number,
  viewH: number,
  capitals: Map<string, MapPoint>,
): MapPoint {
  const camera = getCamera(player, viewW, viewH, worldW, worldH);
  const playerPref =
    findPrefectureAtPoint(player, geo, worldW, worldH) ??
    findNearestPrefectureByCapital(player, capitals);

  const minDist = Math.min(viewW, viewH) * 0.5;
  const edgeBand = 0.14;
  const outsideCandidates: { pos: MapPoint; dist: number }[] = [];
  const bandCandidates: { pos: MapPoint; dist: number }[] = [];

  for (const [kanji, pos] of capitals) {
    if (kanji === playerPref) continue;
    const dist = mapDistance(player, pos);
    if (dist < minDist) continue;

    if (isOutsideViewport(pos, camera, viewW, viewH)) {
      outsideCandidates.push({ pos, dist });
    } else if (isNearViewportEdgeBand(pos, camera, viewW, viewH, edgeBand)) {
      bandCandidates.push({ pos, dist });
    }
  }

  const pool = outsideCandidates.length > 0 ? outsideCandidates : bandCandidates;

  if (pool.length > 0) {
    pool.sort((a, b) => b.dist - a.dist);
    const top = pool.slice(0, Math.min(6, pool.length));
    return top[Math.floor(Math.random() * top.length)].pos;
  }

  let fallback: MapPoint | null = null;
  let fallbackDist = -1;
  for (const [kanji, pos] of capitals) {
    if (kanji === playerPref) continue;
    const dist = mapDistance(player, pos);
    if (dist > fallbackDist) {
      fallbackDist = dist;
      fallback = pos;
    }
  }

  return fallback ?? capitals.values().next().value ?? player;
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
