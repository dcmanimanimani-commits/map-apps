import type { Feature, Geometry, GeoJsonProperties, Position } from 'geojson';
import type { GeoPath } from 'd3-geo';
import { geoCentroid } from 'd3-geo';

type Point = [number, number];

const MIN_INTERIOR_FONT_SIZE = 8;
const MIN_COMFORTABLE_INTERIOR_FONT_SIZE = 10;
const MIN_SEA_FONT_SIZE = 5;

export const PREFER_INTERIOR_KANJI = new Set(['和歌山県', '鹿児島県']);

function ringArea(ring: Point[]): number {
  let sum = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    sum += (xj + xi) * (yj - yi);
  }
  return Math.abs(sum / 2);
}

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToRing(x: number, y: number, ring: Point[]): number {
  let min = Infinity;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    min = Math.min(min, pointToSegmentDist(x, y, ax, ay, bx, by));
  }
  return min;
}

function createCell(x: number, y: number, h: number, ring: Point[]) {
  const inside = pointInPolygon(x, y, ring);
  return { x, y, h, d: inside ? distToRing(x, y, ring) : -distToRing(x, y, ring) };
}

/** ポリゴン内で境界から最も遠い点（ラベル用） */
export function polylabel(ring: Point[], precision = 0.5): Point {
  if (ring.length < 3) return ring[0] ?? [0, 0];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) return [(minX + maxX) / 2, (minY + maxY) / 2];

  let h = cellSize / 2;
  const queue: ReturnType<typeof createCell>[] = [];

  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      queue.push(createCell(x + h, y + h, h, ring));
    }
  }

  let best = createCell(minX + width / 2, minY + height / 2, 0, ring);
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of ring) {
    sumX += x;
    sumY += y;
  }
  const centroidCell = createCell(sumX / ring.length, sumY / ring.length, 0, ring);
  if (centroidCell.d > best.d) best = centroidCell;

  while (queue.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].d > queue[maxIdx].d) maxIdx = i;
    }
    const cell = queue.splice(maxIdx, 1)[0];
    if (cell.d > best.d) best = cell;
    if (cell.d - best.d <= precision) continue;

    h = cell.h / 2;
    queue.push(createCell(cell.x - h, cell.y - h, h, ring));
    queue.push(createCell(cell.x + h, cell.y - h, h, ring));
    queue.push(createCell(cell.x - h, cell.y + h, h, ring));
    queue.push(createCell(cell.x + h, cell.y + h, h, ring));
  }

  return [best.x, best.y];
}

function projectRing(ring: Position[], project: (coords: [number, number]) => [number, number] | null): Point[] {
  const out: Point[] = [];
  for (const coord of ring) {
    const p = project([coord[0], coord[1]]);
    if (p) out.push(p);
  }
  return out;
}

function geometryToRings(geometry: Geometry, project: (coords: [number, number]) => [number, number] | null): Point[][] {
  if (geometry.type === 'Polygon') {
    const ring = projectRing(geometry.coordinates[0], project);
    return ring.length >= 3 ? [ring] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((poly) => projectRing(poly[0], project))
      .filter((ring) => ring.length >= 3);
  }
  return [];
}

function largestRing(rings: Point[][]): Point[] | null {
  let best: Point[] | null = null;
  let bestArea = -1;
  for (const ring of rings) {
    const area = ringArea(ring);
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  return best;
}

function pickLabelRing(rings: Point[][], capitalPoint: Point | null): Point[] | null {
  if (capitalPoint) {
    for (const ring of rings) {
      if (pointInPolygon(capitalPoint[0], capitalPoint[1], ring)) {
        return ring;
      }
    }
  }
  return largestRing(rings);
}

function ownRingCentroid(ring: Point[]): Point {
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of ring) {
    sumX += x;
    sumY += y;
  }
  return [sumX / ring.length, sumY / ring.length];
}

function simplifyRing(ring: Point[], maxPoints = 120): Point[] {
  if (ring.length <= maxPoints) return ring;
  const step = Math.ceil(ring.length / maxPoints);
  const simplified: Point[] = [];
  for (let i = 0; i < ring.length; i += step) simplified.push(ring[i]);
  if (simplified.length < 3) return ring.slice(0, 3);
  return simplified;
}

function ringBounds(ring: Point[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export interface PrefectureLabelLayout {
  x: number;
  y: number;
  fontSize: number;
  clip: boolean;
  placement: 'interior' | 'sea';
}

export interface PrefectureLabelOptions {
  capital?: { lon: number; lat: number };
  minInteriorFontSize?: number;
  minSeaFontSize?: number;
  /** interior=陸地のみ / sea=海のみ / auto=従来 */
  mode?: 'auto' | 'interior-only' | 'sea-only';
  /** 陸地内に収まる場合は近接ラベルとの距離チェックを緩める */
  relaxPlacedCollision?: boolean;
  /** 細長い県向けに陸地内判定をやや緩める */
  looseInteriorFit?: boolean;
  /** 近隣県の陸地（海ラベルが重ならないよう除外） */
  otherRings?: Point[][];
  /** 先に配置済みのラベル（重なり回避） */
  placedLabels?: PlacedPrefectureLabel[];
}

export interface PlacedPrefectureLabel {
  x: number;
  y: number;
  name: string;
  hiragana: string;
  fontSize: number;
}

export function getProjectedLargestRing(
  feature: Feature<Geometry, GeoJsonProperties>,
  pathGen: GeoPath,
  simplify = true,
): Point[] | null {
  const projection = pathGen.projection();
  if (!projection || typeof projection !== 'function') return null;
  const project = projection as (coords: [number, number]) => [number, number] | null;
  const ring = largestRing(geometryToRings(feature.geometry, project));
  if (!ring) return null;
  return simplify ? simplifyRing(ring) : ring;
}

export function geometryToProjectedRings(
  geometry: Geometry,
  project: (coords: [number, number]) => [number, number] | null,
): Point[][] {
  return geometryToRings(geometry, project);
}

function estimateLabelBox(name: string, hiragana: string, fontSize: number) {
  const longest = Math.max(name.length, hiragana.length);
  return {
    width: longest * fontSize * 0.92,
    height: fontSize * 1.75,
  };
}

/** 漢字・ひらがな2行のサンプル点 */
function collectLabelSamples(
  x: number,
  y: number,
  name: string,
  hiragana: string,
  fontSize: number,
): Point[] {
  const { width } = estimateLabelBox(name, hiragana, fontSize);
  const halfW = width / 2 + fontSize * 0.3;
  const strokePad = fontSize * 0.32;
  const kanjiMidY = y - fontSize * 0.55;
  const hiraMidY = y + fontSize * 0.6;
  const kanjiTop = kanjiMidY - fontSize * 0.62 - strokePad;
  const kanjiBottom = kanjiMidY + fontSize * 0.5 + strokePad;
  const hiraTop = hiraMidY - fontSize * 0.55 - strokePad;
  const hiraBottom = hiraMidY + fontSize * 0.55 + strokePad;

  const points: Point[] = [];
  for (const lineY of [kanjiTop, kanjiMidY, kanjiBottom, hiraTop, hiraMidY, hiraBottom]) {
    for (const lineX of [x - halfW, x, x + halfW]) {
      points.push([lineX, lineY]);
    }
  }
  return points;
}

function collectLabelSamplesLoose(
  x: number,
  y: number,
  name: string,
  hiragana: string,
  fontSize: number,
): Point[] {
  const { width, height } = estimateLabelBox(name, hiragana, fontSize);
  const halfW = width / 2 + fontSize * 0.12;
  const halfH = height / 2 + fontSize * 0.12;
  return [
    [x, y],
    [x, y - fontSize * 0.55],
    [x, y + fontSize * 0.6],
    [x - halfW, y - halfH],
    [x + halfW, y - halfH],
    [x - halfW, y + halfH],
    [x + halfW, y + halfH],
  ];
}

function labelFitsInsideLoose(
  ring: Point[],
  x: number,
  y: number,
  name: string,
  hiragana: string,
  fontSize: number,
): boolean {
  return collectLabelSamplesLoose(x, y, name, hiragana, fontSize).every(([px, py]) =>
    pointInPolygon(px, py, ring),
  );
}

/** ラベルが指定した陸地と重なるか */
export function labelOverlapsRing(
  ring: Point[],
  x: number,
  y: number,
  name: string,
  hiragana: string,
  fontSize: number,
): boolean {
  return collectLabelSamples(x, y, name, hiragana, fontSize).some(([px, py]) =>
    pointInPolygon(px, py, ring),
  );
}
/** 漢字・ひらがな2行が陸地内に完全に収まるか */
export function labelFitsInside(
  ring: Point[],
  x: number,
  y: number,
  name: string,
  hiragana: string,
  fontSize: number,
): boolean {
  return collectLabelSamples(x, y, name, hiragana, fontSize).every(([px, py]) =>
    pointInPolygon(px, py, ring),
  );
}

function labelFitsOutside(
  ring: Point[],
  x: number,
  y: number,
  name: string,
  hiragana: string,
  fontSize: number,
): boolean {
  return collectLabelSamples(x, y, name, hiragana, fontSize).every(
    ([px, py]) => !pointInPolygon(px, py, ring),
  );
}

function labelClearOfRings(
  x: number,
  y: number,
  name: string,
  hiragana: string,
  fontSize: number,
  rings: Point[][],
): boolean {
  const samples = collectLabelSamples(x, y, name, hiragana, fontSize);
  return rings.every((ring) =>
    samples.every(([px, py]) => !pointInPolygon(px, py, ring)),
  );
}

function labelTooCloseToPlaced(
  x: number,
  y: number,
  name: string,
  hiragana: string,
  fontSize: number,
  placed: PlacedPrefectureLabel[],
): boolean {
  const { width, height } = estimateLabelBox(name, hiragana, fontSize);
  const ownRadius = Math.max(width, height) * 0.38;
  for (const other of placed) {
    const otherBox = estimateLabelBox(other.name, other.hiragana, other.fontSize);
    const otherRadius = Math.max(otherBox.width, otherBox.height) * 0.38;
    if (Math.hypot(x - other.x, y - other.y) < ownRadius + otherRadius) {
      return true;
    }
  }
  return false;
}

function nearestCoastPoint(ring: Point[], target: Point): Point {
  let best: Point = target;
  let bestDist = Infinity;

  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((target[0] - ax) * dx + (target[1] - ay) * dy) / lenSq));
    const px = ax + dx * t;
    const py = ay + dy * t;
    const dist = Math.hypot(px - target[0], py - target[1]);
    if (dist < bestDist) {
      bestDist = dist;
      best = [px, py];
    }
  }

  return best;
}

function isValidSeaPlacement(
  ownRing: Point[],
  otherRings: Point[][],
  placed: PlacedPrefectureLabel[],
  x: number,
  y: number,
  name: string,
  hiragana: string,
  fontSize: number,
): boolean {
  if (!labelFitsOutside(ownRing, x, y, name, hiragana, fontSize)) return false;
  if (!labelClearOfRings(x, y, name, hiragana, fontSize, otherRings)) return false;
  if (labelTooCloseToPlaced(x, y, name, hiragana, fontSize, placed)) return false;
  return true;
}

function computeMaxFontSize(
  bounds: ReturnType<typeof ringBounds>,
  name: string,
  hiragana: string,
  maxFontSize: number,
): number {
  const longest = Math.max(name.length, hiragana.length);
  const byHeight = Math.min(bounds.width, bounds.height) / 2.6;
  const byWidth = Math.min(bounds.width, bounds.height) / Math.max(1.1, longest * 0.72);
  return Math.max(5, Math.min(maxFontSize, byHeight, byWidth));
}

function findInteriorLayout(
  ring: Point[],
  candidates: Point[],
  name: string,
  hiragana: string,
  maxFontSize: number,
  minInteriorFontSize: number,
  collisionRings: Point[][] = [],
  placedLabels: PlacedPrefectureLabel[] = [],
  relaxPlacedCollision = false,
  looseInteriorFit = false,
): PrefectureLabelLayout | null {
  const bounds = ringBounds(ring);
  const startFontSize = Math.floor(computeMaxFontSize(bounds, name, hiragana, maxFontSize));
  const state: { best: PrefectureLabelLayout | null; depth: number } = { best: null, depth: -1 };

  const consider = (x: number, y: number, fontSize: number) => {
    if (!pointInPolygon(x, y, ring)) return;
    const fits = looseInteriorFit
      ? labelFitsInsideLoose(ring, x, y, name, hiragana, fontSize)
      : labelFitsInside(ring, x, y, name, hiragana, fontSize);
    if (!fits) return;
    if (!labelClearOfRings(x, y, name, hiragana, fontSize, collisionRings)) return;
    if (
      !relaxPlacedCollision &&
      labelTooCloseToPlaced(x, y, name, hiragana, fontSize, placedLabels)
    ) {
      return;
    }
    const depth = distToRing(x, y, ring);
    if (depth > state.depth) {
      state.depth = depth;
      state.best = { x, y, fontSize, clip: true, placement: 'interior' };
    }
  };

  for (let fontSize = startFontSize; fontSize >= minInteriorFontSize; fontSize--) {
    const maxShift = fontSize * 2.2;
    const gridStep = Math.max(fontSize * 0.55, 3);
    for (const [x, y] of candidates) {
      for (let yShift = 0; yShift <= maxShift; yShift += fontSize * 0.1) {
        consider(x, y + yShift, fontSize);
      }
      for (let ox = -fontSize * 1.2; ox <= fontSize * 1.2; ox += gridStep) {
        for (let oy = -fontSize * 1.2; oy <= fontSize * 2.2; oy += gridStep) {
          consider(x + ox, y + oy, fontSize);
        }
      }
    }
    if (state.best) return state.best;
  }

  return state.best;
}

function coastOutwardNormals(ring: Point[], coast: Point): Point[] {
  let bestDist = Infinity;
  let bestSeg: [Point, Point] | null = null;

  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    const a: Point = ring[j];
    const b: Point = ring[i];
    const d = pointToSegmentDist(coast[0], coast[1], a[0], a[1], b[0], b[1]);
    if (d < bestDist) {
      bestDist = d;
      bestSeg = [a, b];
    }
  }

  if (!bestSeg) return [];
  const [a, b] = bestSeg;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return [];
  return [[-dy / len, dx / len], [dy / len, -dx / len]];
}

function buildSeaLayout(
  ownRing: Point[],
  otherRings: Point[][],
  placed: PlacedPrefectureLabel[],
  capital: { lon: number; lat: number },
  name: string,
  hiragana: string,
  maxFontSize: number,
  minSeaFontSize: number,
  _interiorAnchor: Point,
  project: (coords: [number, number]) => [number, number] | null,
): PrefectureLabelLayout | null {
  const projected = project([capital.lon, capital.lat]);
  if (!projected) return null;

  const ringCx = ownRing.reduce((sum, [x]) => sum + x, 0) / ownRing.length;
  const ringCy = ownRing.reduce((sum, [, y]) => sum + y, 0) / ownRing.length;
  const bounds = ringBounds(ownRing);
  const maxPush = Math.max(bounds.width, bounds.height) * 1.15;
  const coast = nearestCoastPoint(ownRing, projected);

  const directions: Point[] = [];
  const addDirection = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    if (len > 0.01) directions.push([dx / len, dy / len]);
  };

  addDirection(coast[0] - ringCx, coast[1] - ringCy);
  addDirection(projected[0] - ringCx, projected[1] - ringCy);
  for (const normal of coastOutwardNormals(ownRing, coast)) addDirection(normal[0], normal[1]);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    addDirection(Math.cos(angle), Math.sin(angle));
  }

  const origins: Point[] = [coast, projected];
  type SeaCandidate = { x: number; y: number; fontSize: number; score: number };
  const state: { best: SeaCandidate | null } = { best: null };

  const tryCandidate = (x: number, y: number, fontSize: number, score: number) => {
    if (!isValidSeaPlacement(ownRing, otherRings, placed, x, y, name, hiragana, fontSize)) return;
    if (!state.best || score < state.best.score) {
      state.best = { x, y, fontSize, score };
    }
  };

  const fontSizes = [Math.min(maxFontSize, 11), 9, 8, 7, minSeaFontSize]
    .filter((value, index, list) => list.indexOf(value) === index)
    .sort((a, b) => b - a);

  for (const fontSize of fontSizes) {
    const step = Math.max(fontSize * 0.4, 2.5);
    const distSteps = Math.min(12, Math.ceil(maxPush / step));
    for (const [ox, oy] of origins) {
      for (const [dx, dy] of directions) {
        for (let di = 1; di <= distSteps; di++) {
          const dist = di * step;
          tryCandidate(
            ox + dx * dist,
            oy + dy * dist,
            fontSize,
            Math.hypot(ox + dx * dist - projected[0], oy + dy * dist - projected[1]) + dist * 0.1,
          );
        }
      }
    }
    if (state.best) break;
  }

  if (!state.best) {
    const searchRadius = Math.max(bounds.width, bounds.height) * 1.1;
    for (const fontSize of fontSizes) {
      const step = Math.max(fontSize * 0.75, 4);
      for (let gx = projected[0] - searchRadius; gx <= projected[0] + searchRadius; gx += step) {
        for (let gy = projected[1] - searchRadius; gy <= projected[1] + searchRadius; gy += step) {
          tryCandidate(
            gx,
            gy,
            fontSize,
            Math.hypot(gx - projected[0], gy - projected[1]),
          );
        }
      }
      if (state.best) break;
    }
  }

  if (state.best) {
    return { x: state.best.x, y: state.best.y, fontSize: state.best.fontSize, clip: false, placement: 'sea' };
  }

  return null;
}

export function getPrefectureLabelLayout(
  feature: Feature<Geometry, GeoJsonProperties>,
  pathGen: GeoPath,
  name: string,
  hiragana: string,
  maxFontSize: number,
  options?: PrefectureLabelOptions,
): PrefectureLabelLayout | null {
  const projection = pathGen.projection();
  if (!projection || typeof projection !== 'function') return null;

  const project = projection as (coords: [number, number]) => [number, number] | null;
  const rings = geometryToRings(feature.geometry, project);
  const capitalPoint = options?.capital
    ? project([options.capital.lon, options.capital.lat])
    : null;
  const ring = pickLabelRing(rings, capitalPoint);
  if (!ring) return null;

  const minInteriorFontSize = options?.minInteriorFontSize ?? MIN_INTERIOR_FONT_SIZE;
  const minSeaFontSize = options?.minSeaFontSize ?? MIN_SEA_FONT_SIZE;
  const bounds = ringBounds(ring);
  const otherRings = options?.otherRings ?? [];
  const collisionRings = otherRings.map((otherRing) => simplifyRing(otherRing));
  const placedLabels = options?.placedLabels ?? [];
  const mode = options?.mode ?? 'auto';

  if (mode === 'sea-only' && options?.capital) {
    const interiorAnchor: Point = capitalPoint ?? ownRingCentroid(ring);
    return buildSeaLayout(
      ring,
      collisionRings,
      placedLabels,
      options.capital,
      name,
      hiragana,
      maxFontSize,
      minSeaFontSize,
      interiorAnchor,
      project,
    );
  }

  const precision = Math.max(0.25, Math.min(bounds.width, bounds.height) * 0.02);
  const [interiorAnchorX, interiorAnchorY] = polylabel(ring, precision);

  const candidates: Point[] = [[interiorAnchorX, interiorAnchorY]];
  const centroid = project(geoCentroid(feature) as [number, number]);
  if (centroid) candidates.push(centroid);
  if (capitalPoint) candidates.push(capitalPoint);

  const interior = mode === 'interior-only' || mode === 'auto'
    ? findInteriorLayout(
      ring,
      candidates,
      name,
      hiragana,
      maxFontSize,
      minInteriorFontSize,
      collisionRings,
      placedLabels,
      options?.relaxPlacedCollision ?? false,
      options?.looseInteriorFit ?? false,
    )
    : null;

  const interiorIsValid = (layout: PrefectureLabelLayout) =>
    labelClearOfRings(layout.x, layout.y, name, hiragana, layout.fontSize, collisionRings) &&
    (options?.relaxPlacedCollision ||
      !labelTooCloseToPlaced(layout.x, layout.y, name, hiragana, layout.fontSize, placedLabels));

  if (mode !== 'sea-only' && interior && interiorIsValid(interior)) {
    if (
      mode === 'interior-only' ||
      options?.relaxPlacedCollision ||
      interior.fontSize >= MIN_COMFORTABLE_INTERIOR_FONT_SIZE
    ) {
      return interior;
    }
  }

  if (mode !== 'interior-only' && options?.capital) {
    const sea = buildSeaLayout(
      ring,
      collisionRings,
      placedLabels,
      options.capital,
      name,
      hiragana,
      maxFontSize,
      minSeaFontSize,
      [interiorAnchorX, interiorAnchorY],
      project,
    );
    if (sea) return sea;
  }

  if (mode !== 'sea-only' && interior && interiorIsValid(interior)) {
    return interior;
  }

  if (mode !== 'interior-only' && options?.capital) {
    const desperateSea = buildSeaLayout(
      ring,
      collisionRings,
      [],
      options.capital,
      name,
      hiragana,
      maxFontSize,
      minSeaFontSize,
      capitalPoint ?? ownRingCentroid(ring),
      project,
    );
    if (desperateSea) return desperateSea;
  }

  return null;
}
