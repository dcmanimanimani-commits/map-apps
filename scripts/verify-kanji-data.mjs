import { PREFECTURE_KANJI } from './generate-kanji-data.mjs';
import fs from 'fs';
import path from 'path';

const outDir = path.join('public', 'kanji-data');
const missing = PREFECTURE_KANJI.filter((char) => !fs.existsSync(path.join(outDir, `${char}.json`)));

if (missing.length) {
  console.error('MISSING:', missing.join(''));
  process.exit(1);
}

// 最低限の形式チェック
const broken = [];
for (const char of PREFECTURE_KANJI) {
  const data = JSON.parse(fs.readFileSync(path.join(outDir, `${char}.json`), 'utf8'));
  if (!data.strokes?.length || !data.medians?.length) {
    broken.push(char);
  }
}

if (broken.length) {
  console.error('BROKEN:', broken.join(''));
  process.exit(1);
}

console.log(`OK: all ${PREFECTURE_KANJI.length} kanji data files valid`);
