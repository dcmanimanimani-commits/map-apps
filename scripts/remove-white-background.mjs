/**
 * キャラ画像の白背景を透過に変換（エッジからのフラッドフィル）
 * 使い方: node scripts/remove-white-background.mjs
 */
import { execSync } from 'node:child_process';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHAR_DIR = path.join(ROOT, 'public', 'characters');
const SPRITE_DIR = path.join(CHAR_DIR, 'sprites');

const WHITE_THRESHOLD = 238;
const EDGE_SOFTNESS = 28;

function isNearWhite(r, g, b, threshold = WHITE_THRESHOLD) {
  return r >= threshold && g >= threshold && b >= threshold;
}

function whiteScore(r, g, b) {
  return (r + g + b) / 3;
}

function floodFillBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push(x, 0, x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(0, y, width - 1, y);
  }

  while (queue.length > 0) {
    const y = queue.pop();
    const x = queue.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const idx = y * width + x;
    if (visited[idx]) continue;

    const pi = idx * 4;
    const r = data[pi];
    const g = data[pi + 1];
    const b = data[pi + 2];

    if (!isNearWhite(r, g, b)) continue;

    visited[idx] = 1;
    data[pi + 3] = 0;

    queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;

      const pi = idx * 4;
      const r = data[pi];
      const g = data[pi + 1];
      const b = data[pi + 2];
      const score = whiteScore(r, g, b);

      if (score >= WHITE_THRESHOLD - EDGE_SOFTNESS) {
        const fade = (score - (WHITE_THRESHOLD - EDGE_SOFTNESS)) / EDGE_SOFTNESS;
        data[pi + 3] = Math.round(data[pi + 3] * (1 - Math.min(1, fade)));
      }
    }
  }
}

async function collectWebpFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue;
      files.push(...(await collectWebpFiles(full)));
    } else if (entry.name.endsWith('.webp')) {
      files.push(full);
    }
  }
  return files;
}

async function processFile(filePath) {
  const img = sharp(filePath);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  floodFillBackground(data, info.width, info.height);

  const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 4 })
    .toBuffer();

  const rel = path.relative(CHAR_DIR, filePath);
  const staged = path.join(CHAR_DIR, '_processed', rel);
  await mkdir(path.dirname(staged), { recursive: true });
  await writeFile(staged, out);
  console.log(`  staged ${path.relative(ROOT, staged)} (${info.width}x${info.height})`);
}

function syncStagedFiles(files) {
  for (const filePath of files) {
    const rel = path.relative(CHAR_DIR, filePath);
    const staged = path.join(CHAR_DIR, '_processed', rel);
    const from = staged.replace(/'/g, "''");
    const to = filePath.replace(/'/g, "''");
    try {
      if (process.platform === 'win32') {
        execSync(
          `powershell -NoProfile -Command "Copy-Item -LiteralPath '${from}' -Destination '${to}' -Force"`,
          { stdio: 'pipe' },
        );
      } else {
        execSync(`cp -f '${from}' '${to}'`, { stdio: 'pipe' });
      }
      console.log(`OK ${path.relative(ROOT, filePath)}`);
    } catch (err) {
      console.warn(`WARN could not overwrite ${path.relative(ROOT, filePath)} (use staged copy)`);
    }
  }
}

async function main() {
  const files = [
    ...(await collectWebpFiles(CHAR_DIR)),
    ...(await collectWebpFiles(SPRITE_DIR)),
  ].filter((f, i, arr) => arr.indexOf(f) === i);

  if (files.length === 0) {
    console.log('No webp files found.');
    return;
  }

  for (const file of files) {
    const info = await stat(file);
    if (!info.isFile()) continue;
    await processFile(file);
  }

  syncStagedFiles(files);

  console.log(`Done: ${files.length} file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
