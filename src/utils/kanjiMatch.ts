import type { KanjiCharacterJson } from './kanjiWriterLoader';

const GRID = 64;
const MATCH_SIZE = 256;
/** ペンを離してから自動判定まで（画数の多い字向け） */
export const AUTO_IDLE_MS = 2200;

/** 手動「打とう！」— 全部満たす必要あり */
const MANUAL_IOU_MIN = 0.17;
const MANUAL_RECALL_MIN = 0.34;
const MANUAL_PRECISION_MIN = 0.42;
const MANUAL_INK_RATIO_MIN = 0.18;
const MANUAL_INK_RATIO_MAX = 2.2;

/** 自動認識（書き途中防止のため手動より厳しめ） */
const AUTO_IOU_MIN = 0.2;
const AUTO_RECALL_MIN = 0.4;
const AUTO_PRECISION_MIN = 0.45;
const AUTO_INK_RATIO_MIN = 0.32;

const refCache = new Map<string, ImageData>();
const charDataCache = new Map<string, KanjiCharacterJson>();

async function loadCharData(char: string): Promise<KanjiCharacterJson> {
  const cached = charDataCache.get(char);
  if (cached) return cached;
  const res = await fetch(`/kanji-data/${encodeURIComponent(char)}.json`);
  if (!res.ok) throw new Error(`Failed to load ${char}`);
  const data = (await res.json()) as KanjiCharacterJson;
  charDataCache.set(char, data);
  return data;
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

interface MatchMetrics {
  iou: number;
  recall: number;
  precision: number;
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
  return {
    iou: union === 0 ? 0 : inter / union,
    recall: refInk === 0 ? 0 : inter / refInk,
    precision: userInk === 0 ? 0 : inter / userInk,
    userInk,
    refInk,
    inkRatio: refInk === 0 ? 0 : userInk / refInk,
  };
}

function passesManual(m: MatchMetrics): boolean {
  if (m.userInk < 18) return false;
  if (m.inkRatio < MANUAL_INK_RATIO_MIN || m.inkRatio > MANUAL_INK_RATIO_MAX) return false;
  return (
    m.iou >= MANUAL_IOU_MIN &&
    m.recall >= MANUAL_RECALL_MIN &&
    m.precision >= MANUAL_PRECISION_MIN
  );
}

function passesAuto(m: MatchMetrics): boolean {
  if (m.userInk < 22) return false;
  if (m.inkRatio < AUTO_INK_RATIO_MIN || m.inkRatio > MANUAL_INK_RATIO_MAX) return false;
  return (
    m.iou >= AUTO_IOU_MIN &&
    m.recall >= AUTO_RECALL_MIN &&
    m.precision >= AUTO_PRECISION_MIN
  );
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
  const cached = refCache.get(key);
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
  refCache.set(key, imageData);
  return imageData;
}

export async function matchFreehandKanji(
  canvas: HTMLCanvasElement,
  expectedChar: string,
  options?: { auto?: boolean },
): Promise<{ ok: boolean; score: number; recall: number }> {
  if (!canvasHasInk(canvas)) {
    return { ok: false, score: 0, recall: 0 };
  }

  const userData = rasterizeCanvas(canvas);
  const refData = await renderReference(expectedChar);

  const userRaw = normalizeMask(binarize(userData));
  const refMask = normalizeMask(binarize(refData));
  const userDilated = dilate(userRaw, 2);

  const shape = computeMetrics(userDilated, refMask);
  const placement = computeMetrics(userRaw, refMask);
  const metrics: MatchMetrics = {
    iou: shape.iou,
    recall: shape.recall,
    precision: placement.precision,
    userInk: placement.userInk,
    refInk: placement.refInk,
    inkRatio: placement.inkRatio,
  };

  const score = metrics.iou * 0.4 + metrics.recall * 0.35 + metrics.precision * 0.25;
  const ok = options?.auto ? passesAuto(metrics) : passesManual(metrics);

  return { ok, score, recall: metrics.recall };
}

export function clearReferenceCache() {
  refCache.clear();
}
