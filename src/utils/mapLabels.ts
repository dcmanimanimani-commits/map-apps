import type { Feature, Geometry, GeoJsonProperties, Position } from 'geojson';
import type { GeoPath } from 'd3-geo';
import { geoCentroid } from 'd3-geo';

type Point = [number, number];

const MIN_INTERIOR_FONT_SIZE = 8;
const MIN_SEA_FONT_SIZE = 6;

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
    queue.sort((a, b) => b.d - a.d);
    const cell = queue.shift()!;
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

/** 漢字・ひらがな2行が陸地内に完全に収まるか */
export function labelFitsInside(
  ring: Point[],
  x: number,
  y: number,
  name: string,
  hiragana: string,
  fontSize: number,
): boolean {
  const { width } = estimateLabelBox(name, hiragana, fontSize);
  const halfW = width / 2;
  const kanjiY = y - fontSize * 0.55;
  const hiraY = y + fontSize * 0.6;
  const top = Math.min(kanjiY, hiraY) - fontSize * 0.15;
  const bottom = Math.max(kanjiY, hiraY) + fontSize * 0.15;

  const samples: Point[] = [
    [x, y],
    [x - halfW, kanjiY],
    [x + halfW, kanjiY],
    [x - halfW, hiraY],
    [x + halfW, hiraY],
    [x, top],
    [x, bottom],
    [x - halfW, y],
    [x + halfW, y],
  ];

  return samples.every(([px, py]) => pointInPolygon(px, py, ring));
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
): PrefectureLabelLayout | null {
  const bounds = ringBounds(ring);
  const startFontSize = Math.floor(computeMaxFontSize(bounds, name, hiragana, maxFontSize));

  for (const [x, y] of candidates) {
    if (!pointInPolygon(x, y, ring)) continue;
    for (let fontSize = startFontSize; fontSize >= minInteriorFontSize; fontSize--) {
      if (labelFitsInside(ring, x, y, name, hiragana, fontSize)) {
        return { x, y, fontSize, clip: true, placement: 'interior' };
      }
    }
  }

  return null;
}

function buildSeaLayout(
  project: (coords: [number, number]) => [number, number] | null,
  capital: { lon: number; lat: number },
  maxFontSize: number,
  minSeaFontSize: number,
): PrefectureLabelLayout | null {
  const projected = project([capital.lon, capital.lat]);
  if (!projected) return null;

  const fontSize = Math.max(minSeaFontSize, Math.min(maxFontSize, 12));
  return {
    x: projected[0],
    y: projected[1],
    fontSize,
    clip: false,
    placement: 'sea',
  };
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
  const ring = largestRing(rings);
  if (!ring) return null;

  const minInteriorFontSize = options?.minInteriorFontSize ?? MIN_INTERIOR_FONT_SIZE;
  const minSeaFontSize = options?.minSeaFontSize ?? MIN_SEA_FONT_SIZE;
  const bounds = ringBounds(ring);
  const precision = Math.max(0.25, Math.min(bounds.width, bounds.height) * 0.02);

  const candidates: Point[] = [polylabel(ring, precision)];
  const centroid = project(geoCentroid(feature) as [number, number]);
  if (centroid) candidates.push(centroid);
  if (options?.capital) {
    const capitalPoint = project([options.capital.lon, options.capital.lat]);
    if (capitalPoint) candidates.push(capitalPoint);
  }

  const interior = findInteriorLayout(
    ring,
    candidates,
    name,
    hiragana,
    maxFontSize,
    minInteriorFontSize,
  );
  if (interior) return interior;

  if (options?.capital) {
    return buildSeaLayout(project, options.capital, maxFontSize, minSeaFontSize);
  }

  return null;
}
