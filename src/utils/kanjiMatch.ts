import type { KanjiCharacterJson } from './kanjiWriterLoader';

const GRID = 64;
const MATCH_THRESHOLD = 0.28;

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

function iou(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) union++;
    if (a[i] && b[i]) inter++;
  }
  return union === 0 ? 0 : inter / union;
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

async function renderReference(char: string, size: number): Promise<ImageData> {
  const key = `${char}:${size}`;
  const cached = refCache.get(key);
  if (cached) return cached;

  const data = await loadCharData(char);
  const paths = data.strokes.map((stroke) => `<path d="${stroke}" fill="#111827"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}">
    <g transform="scale(1,-1) translate(0,-900)">${paths}</g>
  </svg>`;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });

  const imageData = ctx.getImageData(0, 0, size, size);
  refCache.set(key, imageData);
  return imageData;
}

export async function matchFreehandKanji(
  canvas: HTMLCanvasElement,
  expectedChar: string,
): Promise<{ ok: boolean; score: number }> {
  if (!canvasHasInk(canvas)) {
    return { ok: false, score: 0 };
  }

  const size = canvas.width;
  const ctx = canvas.getContext('2d')!;
  const userData = ctx.getImageData(0, 0, size, size);
  const refData = await renderReference(expectedChar, size);

  const userMask = normalizeMask(binarize(userData));
  const refMask = normalizeMask(binarize(refData));
  const score = iou(userMask, refMask);

  return { ok: score >= MATCH_THRESHOLD, score };
}

export function clearReferenceCache() {
  refCache.clear();
}
