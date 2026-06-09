import { geoPath, geoMercator } from 'd3-geo';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { trimMainlandForProjection, type PrefectureFeature } from './geoTransform';

export const OCEAN_GRADIENT_ID = 'ocean-gradient';
export const MAINLAND_CLIP_ID = 'mainland-clip';

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
) {
  const innerLeft = layout.cornerX + layout.innerPad;
  const innerTop = layout.cornerY + layout.innerPad;
  const innerRight = width - layout.innerPad;
  const innerBottom = height - layout.innerPad;

  return geoPath(
    geoMercator().fitExtent(
      [[innerLeft, innerTop], [innerRight, innerBottom]],
      okinawa,
    ),
  );
}

export function getFeatureKanji(feature: Feature<Geometry, GeoJsonProperties & { nam_ja?: string }>): string {
  return feature.properties?.nam_ja ?? '';
}
