import type { Feature, Geometry, GeoJsonProperties, Position } from 'geojson';
import type { GeoPath } from 'd3-geo';
import { geoCentroid } from 'd3-geo';

type Point = [number, number];

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
}

/** 沖縄・長崎は海側表示を許可 */
export const SEA_LABEL_PREFECTURES = new Set(['沖縄県', '長崎県']);

export function allowsSeaPrefectureLabel(kanji: string): boolean {
  return SEA_LABEL_PREFECTURES.has(kanji);
}

export function geometryToProjectedRings(
  geometry: Geometry,
  project: (coords: [number, number]) => [number, number] | null,
): Point[][] {
  return geometryToRings(geometry, project);
}

export function getPrefectureLabelLayout(
  feature: Feature<Geometry, GeoJsonProperties>,
  pathGen: GeoPath,
  name: string,
  hiragana: string,
  maxFontSize: number,
  options?: { allowOutside?: boolean; precision?: number },
): PrefectureLabelLayout | null {
  const projection = pathGen.projection();
  if (!projection || typeof projection !== 'function') return null;

  const project = projection as (coords: [number, number]) => [number, number] | null;
  const rings = geometryToRings(feature.geometry, project);
  const ring = largestRing(rings);
  if (!ring) return null;

  const bounds = ringBounds(ring);
  const precision = options?.precision ?? Math.max(0.25, Math.min(bounds.width, bounds.height) * 0.02);
  const [x, y] = polylabel(ring, precision);

  const longest = Math.max(name.length, hiragana.length);
  const byHeight = Math.min(bounds.width, bounds.height) / 2.6;
  const byWidth = Math.min(bounds.width, bounds.height) / Math.max(1.1, longest * 0.72);
  const fontSize = Math.max(5, Math.min(maxFontSize, byHeight, byWidth));

  if (!options?.allowOutside && !pointInPolygon(x, y, ring)) {
    const centroid = project(geoCentroid(feature) as [number, number]);
    if (centroid && pointInPolygon(centroid[0], centroid[1], ring)) {
      return { x: centroid[0], y: centroid[1], fontSize, clip: true };
    }
    return null;
  }

  return { x, y, fontSize, clip: !options?.allowOutside };
}
