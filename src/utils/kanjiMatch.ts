import { prefectures } from '../data/prefectures';
import type { KanjiCharacterJson } from './kanjiWriterLoader';

const GRID = 64;
const MATCH_SIZE = 256;
export const AUTO_IDLE_MS = 2200;
/** 2位との差がこれ未満なら曖昧判定（別の字と紛らわしい） */
const WIN_MARGIN = 0.022;

const refImageCache = new Map<string, ImageData>();
const refMaskCache = new Map<string, Uint8Array>();
const charDataCache = new Map<string, KanjiCharacterJson>();

/** 都道府県名に出てくる漢字（道・県・府・都 など） */
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
  const combined = iou * 0.35 + recall * 0.3 + precision * 0.35;
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

function passesManual(m: MatchMetrics): boolean {
  if (m.userInk < 14) return false;
  if (m.inkRatio < 0.08 || m.inkRatio > 2.6) return false;
  if (m.precision < 0.27) return false;

  const shapeOk =
    m.combined >= 0.19 ||
    (m.iou >= 0.1 && m.precision >= 0.32) ||
    (m.recall >= 0.15 && m.precision >= 0.3);

  return shapeOk;
}

function passesAuto(m: MatchMetrics): boolean {
  if (m.userInk < 18) return false;
  if (m.inkRatio < 0.22 || m.inkRatio > 2.4) return false;
  return m.precision >= 0.34 && m.recall >= 0.22 && m.combined >= 0.24;
}

function isBestMatch(expected: MatchMetrics, runnerUp: MatchMetrics | null): boolean {
  if (!runnerUp) return true;
  const margin = expected.combined - runnerUp.combined;
  if (margin >= WIN_MARGIN) return true;
  return margin >= 0 && expected.precision >= 0.34;
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
  const mask = dilate(normalizeMask(binarize(refData)), 1);
  refMaskCache.set(char, mask);
  return mask;
}

interface CharScore {
  char: string;
  metrics: MatchMetrics;
}

async function rankAllCandidates(userMask: Uint8Array): Promise<CharScore[]> {
  const scores: CharScore[] = [];
  for (const char of GAME_KANJI) {
    const refMask = await getRefMask(char);
    scores.push({ char, metrics: computeMetrics(userMask, refMask) });
  }
  scores.sort((a, b) => b.metrics.combined - a.metrics.combined);
  return scores;
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
  const userMask = dilate(normalizeMask(binarize(userData)), 3);

  const ranked = await rankAllCandidates(userMask);
  const top = ranked[0];
  const expectedEntry = ranked.find((r) => r.char === expectedChar);

  if (!expectedEntry) {
    return { ok: false, score: 0, recall: 0 };
  }

  const runnerUp = ranked.find((r) => r.char !== expectedChar) ?? null;

  // 書いた形が「正解の字」より別の字に近い → 不正解（例: 答えが県なのに道と書く）
  if (top.char !== expectedChar) {
    return { ok: false, score: expectedEntry.metrics.combined, recall: expectedEntry.metrics.recall };
  }

  const passGate = options?.auto ? passesAuto : passesManual;
  if (!passGate(expectedEntry.metrics)) {
    return { ok: false, score: expectedEntry.metrics.combined, recall: expectedEntry.metrics.recall };
  }

  if (!isBestMatch(expectedEntry.metrics, runnerUp?.metrics ?? null)) {
    return { ok: false, score: expectedEntry.metrics.combined, recall: expectedEntry.metrics.recall };
  }

  return {
    ok: true,
    score: expectedEntry.metrics.combined,
    recall: expectedEntry.metrics.recall,
  };
}

export function clearReferenceCache() {
  refImageCache.clear();
  refMaskCache.clear();
}

/** ボス開始時に漢字マスクを先読み（初回判定を速く） */
export function preloadBossKanjiMasks(): void {
  void Promise.all(GAME_KANJI.map((char) => getRefMask(char)));
}
