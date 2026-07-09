import { geoCentroid, geoPath, geoMercator } from 'd3-geo';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { simplifyOkinawaForInset, trimMainlandForProjection, type PrefectureFeature } from './geoTransform';

export const OCEAN_GRADIENT_ID = 'ocean-gradient';
export const MAINLAND_CLIP_ID = 'mainland-clip';
export const OKINAWA_CLIP_ID = 'okinawa-clip';

type GeoPath = ReturnType<typeof geoPath>;

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
): GeoPath {
  const fitGeo = trimMainlandForProjection(regionGeo);

  return geoPath(
    geoMercator().fitExtent(
      [[padding, padding], [width - padding, height - padding]],
      fitGeo,
    ),
  );
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
