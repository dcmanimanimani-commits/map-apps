import { geoCentroid, geoPath, geoMercator } from 'd3-geo';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import {
  simplifyOkinawaForInset,
  trimForRegionFocus,
  trimMainlandForProjection,
  type PrefectureFeature,
} from './geoTransform';

/** 地方ズーム時に陸地が枠の何割を占めるか（大きいほど海が少ない） */
export const REGION_LAND_FILL = 0.97;

export const OCEAN_GRADIENT_ID = 'ocean-gradient';
export const MAINLAND_CLIP_ID = 'mainland-clip';
export const OKINAWA_CLIP_ID = 'okinawa-clip';

type GeoPath = ReturnType<typeof geoPath>;
type GeoProjection = ReturnType<typeof geoMercator>;

function getFitBox(
  width: number,
  height: number,
  padding: number,
  reserveOkinawaInset: boolean,
): { x1: number; y1: number; x2: number; y2: number } {
  let x1 = padding;
  let y1 = padding;
  let x2 = width - padding;
  let y2 = height - padding;

  if (reserveOkinawaInset) {
    const corner = getOkinawaCorner(width, height);
    x2 = Math.max(x1 + 56, corner.x - padding);
    y2 = Math.max(y1 + 56, corner.y - padding);
  }

  return { x1, y1, x2, y2 };
}

function measureLandBounds(path: GeoPath, fitGeo: JapanGeoJSON): [[number, number], [number, number]] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const feature of fitGeo.features) {
    const bounds = path.bounds(feature as Feature<Geometry, GeoJsonProperties>);
    minX = Math.min(minX, bounds[0][0]);
    minY = Math.min(minY, bounds[0][1]);
    maxX = Math.max(maxX, bounds[1][0]);
    maxY = Math.max(maxY, bounds[1][1]);
  }

  if (!isFinite(minX)) return null;
  return [[minX, minY], [maxX, maxY]];
}

/** 陸地の描画範囲をそろえ、枠内に収まるよう拡大・縮小する */
function normalizeRegionLandFit(
  projection: GeoProjection,
  fitGeo: JapanGeoJSON,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fill = REGION_LAND_FILL,
): GeoPath {
  const targetX = (x1 + x2) / 2;
  const targetY = (y1 + y2) / 2;
  const boxW = x2 - x1;
  const boxH = y2 - y1;

  let path = geoPath(projection);
  let bounds = measureLandBounds(path, fitGeo);
  if (!bounds) return path;

  let [[minX, minY], [maxX, maxY]] = bounds;
  let cx = (minX + maxX) / 2;
  let cy = (minY + maxY) / 2;
  let [tx, ty] = projection.translate();
  projection.translate([tx + targetX - cx, ty + targetY - cy]);

  path = geoPath(projection);
  bounds = measureLandBounds(path, fitGeo);
  if (!bounds) return path;

  [[minX, minY], [maxX, maxY]] = bounds;
  const landW = Math.max(1, maxX - minX);
  const landH = Math.max(1, maxY - minY);
  const scaleFactor = Math.min((boxW * fill) / landW, (boxH * fill) / landH);
  if (!isFinite(scaleFactor) || scaleFactor <= 0 || Math.abs(scaleFactor - 1) < 0.005) {
    return path;
  }

  [tx, ty] = projection.translate();
  const scale = projection.scale();
  projection.scale(scale * scaleFactor);
  projection.translate([
    targetX + scaleFactor * (tx - targetX),
    targetY + scaleFactor * (ty - targetY),
  ]);

  return geoPath(projection);
}

/** L字区切りの角（画面右下の沖縄エリア） */
export function getOkinawaCorner(width: number, height: number) {
  const insetW = Math.max(width * 0.36, 150);
  const insetH = Math.max(height * 0.32, 120);
  return {
    x: width - insetW,
    y: height - insetH,
  };
}

export function createMainlandProjection(mainland: JapanGeoJSON, width: number, height: number) {
  const pad = 1;
  const fitGeo = trimMainlandForProjection(mainland);

  const projection = geoMercator().fitExtent(
    [[pad, pad], [width - pad, height - pad]],
    fitGeo,
  );

  const [tx, ty] = projection.translate();
  projection.translate([tx, ty + height * 0.015]);

  return projection;
}

export function createMainlandPathGenerator(mainland: JapanGeoJSON, width: number, height: number) {
  return geoPath(createMainlandProjection(mainland, width, height));
}

/** 選択地方のみ表示：その地方にフィットする投影 */
export function createRegionFocusPathGenerator(
  regionGeo: JapanGeoJSON,
  width: number,
  height: number,
  padding = 20,
  reserveOkinawaInset = false,
): GeoPath {
  const fitGeo = trimForRegionFocus(regionGeo);
  const { x1, y1, x2, y2 } = getFitBox(width, height, padding, reserveOkinawaInset);

  const projection = geoMercator().fitExtent(
    [[x1, y1], [x2, y2]],
    fitGeo,
  );

  return normalizeRegionLandFit(projection, fitGeo, x1, y1, x2, y2, REGION_LAND_FILL);
}

/** 沖縄のみ表示：画面いっぱいにフィット */
export function createOkinawaFullPathGenerator(
  okinawa: PrefectureFeature,
  width: number,
  height: number,
): GeoPath {
  const simplified = simplifyOkinawaForInset(okinawa);
  const pad = 24;

  return geoPath(
    geoMercator().fitExtent(
      [[pad, pad], [width - pad, height - pad]],
      simplified,
    ),
  );
}

export function getProjectedCentroid(
  feature: Feature<Geometry, GeoJsonProperties>,
  pathGen: GeoPath,
): [number, number] | null {
  const projection = pathGen.projection();
  if (!projection || typeof projection !== 'function') return null;
  const point = (projection as (coords: [number, number]) => [number, number] | null)(geoCentroid(feature));
  return point ?? null;
}

export interface OkinawaInsetLayout {
  cornerX: number;
  cornerY: number;
  innerPad: number;
}

export function getOkinawaInsetLayout(width: number, height: number): OkinawaInsetLayout {
  const corner = getOkinawaCorner(width, height);
  return {
    cornerX: corner.x,
    cornerY: corner.y,
    innerPad: 5,
  };
}

export function createOkinawaInsetPathGenerator(
  okinawa: PrefectureFeature,
  layout: OkinawaInsetLayout,
  width: number,
  height: number,
  scale = 0.25,
) {
  const simplified = simplifyOkinawaForInset(okinawa);
  const innerLeft = layout.cornerX + layout.innerPad;
  const innerTop = layout.cornerY + layout.innerPad;
  const innerRight = width - layout.innerPad;
  const innerBottom = height - layout.innerPad;
  const centerX = (innerLeft + innerRight) / 2;
  const centerY = (innerTop + innerBottom) / 2;

  const projection = geoMercator().fitExtent(
    [[innerLeft, innerTop], [innerRight, innerBottom]],
    simplified,
  );

  projection.scale(projection.scale() * scale);

  const centroid = geoCentroid(simplified);
  const projected = projection(centroid);
  if (projected) {
    const [tx, ty] = projection.translate();
    projection.translate([tx + (centerX - projected[0]), ty + (centerY - projected[1])]);
  }

  return geoPath(projection);
}

/** 地方学習時の沖縄インセット（本島＋沖縄） */
export const OKINAWA_INSET_SCALE_FULL = 0.25;
export const OKINAWA_INSET_SCALE_REGION = 0.78;

export function getFeatureKanji(feature: Feature<Geometry, GeoJsonProperties & { nam_ja?: string }>): string {
  return feature.properties?.nam_ja ?? '';
}
