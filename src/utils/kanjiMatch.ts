import { prefectures } from '../data/prefectures';
import type { KanjiCharacterJson } from './kanjiWriterLoader';

const GRID = 64;
const MATCH_SIZE = 256;
export const AUTO_IDLE_MS = 2200;

/** 別の字が正解よりこれ以上上回ったら「別の字を書いた」とみなす */
const WRONG_CHAR_MARGIN = 0.07;

const refImageCache = new Map<string, ImageData>();
const refMaskCache = new Map<string, Uint8Array>();
const strokeCountCache = new Map<string, number>();
const charDataCache = new Map<string, KanjiCharacterJson>();

const GAME_KANJI: string[] = (() => {
  const set = new Set<string>();
  for (const p of prefectures) {
    for (const c of p.kanji) set.add(c);
  }
  return [...set];
})();

async function loadCharData(char: string): Promise<KanjiCharacterJson> {
  const cached = charDataCache.get(char);
  if (cached) return cached;
  const res = await fetch(`/kanji-data/${encodeURIComponent(char)}.json`);
  if (!res.ok) throw new Error(`Failed to load ${char}`);
  const data = (await res.json()) as KanjiCharacterJson;
  charDataCache.set(char, data);
  strokeCountCache.set(char, data.strokes.length);
  return data;
}

async function getStrokeCount(char: string): Promise<number> {
  const cached = strokeCountCache.get(char);
  if (cached !== undefined) return cached;
  const data = await loadCharData(char);
  return data.strokes.length;
}

function binarize(data: ImageData, darkThreshold = 210): Uint8Array {
  const out = new Uint8Array(GRID * GRID);
  const { width, height, data: px } = data;
  const scaleX = width / GRID;
  const scaleY = height / GRID;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const sx = Math.floor(gx * scaleX);
      const sy = Math.floor(gy * scaleY);
      const i = (sy * width + sx) * 4;
      const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      out[gy * GRID + gx] = lum < darkThreshold ? 1 : 0;
    }
  }
  return out;
}

function dilate(mask: Uint8Array, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!mask[y * GRID + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
            out[ny * GRID + nx] = 1;
          }
        }
      }
    }
  }
  return out;
}

function inkBounds(mask: Uint8Array): { minX: number; maxX: number; minY: number; maxY: number } | null {
  let minX = GRID;
  let minY = GRID;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!mask[y * GRID + x]) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

function normalizeMask(mask: Uint8Array): Uint8Array {
  const bounds = inkBounds(mask);
  if (!bounds) return mask;
  const { minX, minY, maxX, maxY } = bounds;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const size = Math.max(w, h, 8);
  const out = new Uint8Array(GRID * GRID);
  const padX = Math.floor((GRID - (w / size) * GRID) / 2);
  const padY = Math.floor((GRID - (h / size) * GRID) / 2);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!mask[y * GRID + x]) continue;
      const nx = Math.round(padX + ((x - minX) / size) * (GRID - padX * 2));
      const ny = Math.round(padY + ((y - minY) / size) * (GRID - padY * 2));
      if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
        out[ny * GRID + nx] = 1;
      }
    }
  }
  return out;
}

export interface MatchMetrics {
  iou: number;
  recall: number;
  precision: number;
  combined: number;
  userInk: number;
  refInk: number;
  inkRatio: number;
}

function computeMetrics(userMask: Uint8Array, refMask: Uint8Array): MatchMetrics {
  let inter = 0;
  let userInk = 0;
  let refInk = 0;
  for (let i = 0; i < userMask.length; i++) {
    if (userMask[i]) userInk++;
    if (refMask[i]) refInk++;
    if (userMask[i] && refMask[i]) inter++;
  }
  const union = userInk + refInk - inter;
  const iou = union === 0 ? 0 : inter / union;
  const recall = refInk === 0 ? 0 : inter / refInk;
  const precision = userInk === 0 ? 0 : inter / userInk;
  // 手書きは recall（形をどれだけカバーしたか）を重視
  const combined = iou * 0.22 + recall * 0.43 + precision * 0.35;
  return {
    iou,
    recall,
    precision,
    combined,
    userInk,
    refInk,
    inkRatio: refInk === 0 ? 0 : userInk / refInk,
  };
}

/** 「打とう！」— 画数に応じてゆるさを調整（大=簡単、茨=複雑） */
function passesManual(m: MatchMetrics, strokeCount: number): boolean {
  if (m.userInk < 8) return false;
  if (m.inkRatio < 0.03 || m.inkRatio > 3.5) return false;

  const shapeOk =
    m.combined >= 0.09 ||
    m.recall >= 0.08 ||
    m.precision >= 0.28 ||
    (m.iou >= 0.04 && m.precision >= 0.16);

  if (!shapeOk) return false;

  // 1〜3画（大・広など）: 線が細く recall が出にくい
  if (strokeCount <= 3) {
    return m.combined >= 0.06 || m.recall >= 0.05 || m.iou >= 0.04 || m.precision >= 0.22;
  }
  // 8画以上（茨など）: 全部書けなくても形が近ければ OK
  if (strokeCount >= 8) {
    return m.combined >= 0.07 || m.recall >= 0.06 || m.precision >= 0.24;
  }
  return true;
}

function passesAuto(m: MatchMetrics, strokeCount: number): boolean {
  if (m.userInk < 14) return false;
  if (m.inkRatio < 0.15 || m.inkRatio > 3.0) return false;
  const base = m.combined >= 0.15 && m.recall >= 0.12 && m.precision >= 0.24;
  if (strokeCount <= 3) return base || (m.combined >= 0.1 && m.precision >= 0.3);
  if (strokeCount >= 8) return base || (m.combined >= 0.08 && m.precision >= 0.26);
  return base;
}

function isClearlyWrongChar(
  expectedChar: string,
  expected: MatchMetrics,
  ranked: { char: string; metrics: MatchMetrics }[],
): boolean {
  const top = ranked[0];
  if (top.char === expectedChar) return false;

  const expectedRank = ranked.findIndex((r) => r.char === expectedChar);
  const margin = top.metrics.combined - expected.combined;

  // 2〜3位でも差が小さければ正解扱い
  if (expectedRank > 0 && expectedRank <= 2 && margin < 0.09) {
    return false;
  }

  if (margin < WRONG_CHAR_MARGIN) return false;
  if (top.metrics.combined < 0.13) return false;
  if (top.metrics.precision < 0.28) return false;

  if (expected.combined >= 0.14 && margin < WRONG_CHAR_MARGIN + 0.03) {
    return false;
  }

  return true;
}

function canvasHasInk(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (lum < 220 && data[i + 3] > 20) return true;
  }
  return false;
}

function rasterizeCanvas(canvas: HTMLCanvasElement): ImageData {
  const tmp = document.createElement('canvas');
  tmp.width = MATCH_SIZE;
  tmp.height = MATCH_SIZE;
  const ctx = tmp.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, MATCH_SIZE, MATCH_SIZE);
  ctx.drawImage(canvas, 0, 0, MATCH_SIZE, MATCH_SIZE);
  return ctx.getImageData(0, 0, MATCH_SIZE, MATCH_SIZE);
}

async function renderReference(char: string): Promise<ImageData> {
  const key = char;
  const cached = refImageCache.get(key);
  if (cached) return cached;

  const data = await loadCharData(char);
  const paths = data.strokes.map((stroke) => `<path d="${stroke}" fill="#111827"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${MATCH_SIZE}" height="${MATCH_SIZE}">
    <g transform="scale(1,-1) translate(0,-900)">${paths}</g>
  </svg>`;

  const canvas = document.createElement('canvas');
  canvas.width = MATCH_SIZE;
  canvas.height = MATCH_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, MATCH_SIZE, MATCH_SIZE);

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, MATCH_SIZE, MATCH_SIZE);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });

  const imageData = ctx.getImageData(0, 0, MATCH_SIZE, MATCH_SIZE);
  refImageCache.set(key, imageData);
  return imageData;
}

async function getRefMask(char: string): Promise<Uint8Array> {
  const cached = refMaskCache.get(char);
  if (cached) return cached;
  const refData = await renderReference(char);
  const mask = dilate(normalizeMask(binarize(refData)), 3);
  refMaskCache.set(char, mask);
  return mask;
}

function buildUserMasks(userData: ImageData): Uint8Array[] {
  const norm = normalizeMask(binarize(userData));
  return [2, 3, 4, 5, 6].map((r) => dilate(norm, r));
}

function bestMetricsForChar(userMasks: Uint8Array[], refMask: Uint8Array): MatchMetrics {
  let best = computeMetrics(userMasks[0], refMask);
  for (let i = 1; i < userMasks.length; i++) {
    const m = computeMetrics(userMasks[i], refMask);
    if (m.combined > best.combined) best = m;
  }
  return best;
}

async function scoreExpectedAndRank(
  userMasks: Uint8Array[],
  expectedChar: string,
): Promise<{ expected: MatchMetrics; ranked: { char: string; metrics: MatchMetrics }[] }> {
  const ranked: { char: string; metrics: MatchMetrics }[] = [];
  let expected: MatchMetrics | null = null;

  for (const char of GAME_KANJI) {
    const refMask = await getRefMask(char);
    const metrics = bestMetricsForChar(userMasks, refMask);
    if (char === expectedChar) expected = metrics;
    ranked.push({ char, metrics });
  }

  ranked.sort((a, b) => b.metrics.combined - a.metrics.combined);
  return { expected: expected!, ranked };
}

export async function matchFreehandKanji(
  canvas: HTMLCanvasElement,
  expectedChar: string,
  options?: { auto?: boolean },
): Promise<{ ok: boolean; score: number; recall: number }> {
  if (!canvasHasInk(canvas)) {
    return { ok: false, score: 0, recall: 0 };
  }

  const strokeCount = await getStrokeCount(expectedChar);
  const userMasks = buildUserMasks(rasterizeCanvas(canvas));
  const { expected, ranked } = await scoreExpectedAndRank(userMasks, expectedChar);

  if (!expected) {
    return { ok: false, score: 0, recall: 0 };
  }

  const passGate = options?.auto ? passesAuto : passesManual;
  if (!passGate(expected, strokeCount)) {
    return { ok: false, score: expected.combined, recall: expected.recall };
  }

  if (isClearlyWrongChar(expectedChar, expected, ranked)) {
    return { ok: false, score: expected.combined, recall: expected.recall };
  }

  return { ok: true, score: expected.combined, recall: expected.recall };
}

export function clearReferenceCache() {
  refImageCache.clear();
  refMaskCache.clear();
  strokeCountCache.clear();
}

export function preloadBossKanjiMasks(): void {
  void Promise.all(GAME_KANJI.map((char) => getRefMask(char)));
}
