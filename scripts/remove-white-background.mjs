/**
 * キャラ画像の背景を透過に変換（四隅の色を基準にエッジからフラッドフィル）
 * 使い方: node scripts/remove-white-background.mjs
 */
import { execSync } from 'node:child_process';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHAR_DIR = path.join(ROOT, 'public', 'characters');
const SPRITE_DIR = path.join(CHAR_DIR, 'sprites');

const AVATAR_BG_TOLERANCE = 52;
const AVATAR_EDGE_SOFTNESS = 14;
/** 鬼大王は外周の暗い背景だけ軽く透過（旗・本体は残す） */
const BOSS_BG_TOLERANCE = 28;
const BOSS_EDGE_SOFTNESS = 18;

function colorDist(r, g, b, br, bg, bb) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function sampleBackgroundColor(data, width, height) {
  const rs = [];
  const gs = [];
  const bs = [];
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [(width / 2) | 0, 0],
    [0, (height / 2) | 0],
    [width - 1, (height / 2) | 0],
    [(width / 2) | 0, height - 1],
  ];
  for (const [x, y] of points) {
    const pi = (y * width + x) * 4;
    rs.push(data[pi]);
    gs.push(data[pi + 1]);
    bs.push(data[pi + 2]);
  }
  return [median(rs), median(gs), median(bs)];
}

function isNearBackground(r, g, b, bg, tolerance) {
  return colorDist(r, g, b, bg[0], bg[1], bg[2]) <= tolerance;
}

function floodFillBackground(data, width, height, tolerance, edgeSoftness) {
  const bg = sampleBackgroundColor(data, width, height);
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

    if (!isNearBackground(r, g, b, bg, tolerance)) continue;

    visited[idx] = 1;
    data[pi + 3] = 0;

    queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  // 背景以外は不透明に（キャラ内部のベージュ系も半透明にしない）
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;
      data[idx * 4 + 3] = 255;
    }
  }

  // 輪郭の1pxだけアンチエイリアス（背景に接する画素のみ）
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;

      let touchesBg = false;
      if (x > 0 && visited[idx - 1]) touchesBg = true;
      else if (x < width - 1 && visited[idx + 1]) touchesBg = true;
      else if (y > 0 && visited[idx - width]) touchesBg = true;
      else if (y < height - 1 && visited[idx + width]) touchesBg = true;
      if (!touchesBg) continue;

      const pi = idx * 4;
      const r = data[pi];
      const g = data[pi + 1];
      const b = data[pi + 2];
      const dist = colorDist(r, g, b, bg[0], bg[1], bg[2]);

      if (dist <= tolerance + edgeSoftness) {
        const fade = (tolerance + edgeSoftness - dist) / edgeSoftness;
        data[pi + 3] = Math.round(255 * (1 - Math.min(1, Math.max(0, fade))));
      }
    }
  }

  return bg;
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
    } else if (entry.name.endsWith('.webp') && !entry.name.startsWith('_') && !entry.name.includes('-original')) {
      files.push(full);
    }
  }
  return files;
}

function isBossImage(filePath) {
  return path.basename(filePath) === 'boss-daiou.webp';
}

async function processFile(filePath) {
  const boss = isBossImage(filePath);
  if (boss) {
    console.log(`  skip ${path.relative(ROOT, filePath)} (boss unchanged)`);
    return;
  }

  const tolerance = AVATAR_BG_TOLERANCE;
  const edgeSoftness = AVATAR_EDGE_SOFTNESS;

  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = floodFillBackground(data, info.width, info.height, tolerance, edgeSoftness);

  const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 4 })
    .toBuffer();

  const rel = path.relative(CHAR_DIR, filePath);
  const staged = path.join(CHAR_DIR, '_processed', rel);
  await mkdir(path.dirname(staged), { recursive: true });
  await writeFile(staged, out);
  console.log(
    `  staged ${path.relative(ROOT, staged)} (${info.width}x${info.height}, bg rgb(${bg.join(',')}))`,
  );
}

function syncStagedFiles(files) {
  for (const filePath of files) {
    if (isBossImage(filePath)) continue;
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
    } catch {
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
