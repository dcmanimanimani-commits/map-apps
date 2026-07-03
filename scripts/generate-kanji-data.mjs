/**
 * 全都道府県漢字を日本の書き順データで生成
 * - 基本: KanjiVG（Moritz72 変換）
 * - 上書き: subAnimJ（小学校向け修正）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  fetchKanjiVgSvg,
  kanjiVgSvgToWriterData,
  loadSubAnimJOverrides,
  fixNawaStrokeData,
} from './kanjivg-converter.mjs';

const PREFS = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

export const PREFECTURE_KANJI = [...new Set(PREFS.flatMap((p) => [...p]))].sort();

async function main() {
  const outDir = path.join('public', 'kanji-data');
  fs.mkdirSync(outDir, { recursive: true });

  const subAnimJ = await loadSubAnimJOverrides();
  const usedOverride = [];
  const usedFix = [];

  for (const char of PREFECTURE_KANJI) {
    let data;
    let tag = '';

    if (char === '縄') {
      data = await fixNawaStrokeData(subAnimJ);
      tag = ' (糸偏修正)';
      usedFix.push(char);
    } else if (subAnimJ.has(char)) {
      data = subAnimJ.get(char);
      tag = ' (subAnimJ)';
      usedOverride.push(char);
    } else {
      const svg = await fetchKanjiVgSvg(char);
      data = kanjiVgSvgToWriterData(svg);
    }

    fs.writeFileSync(path.join(outDir, `${char}.json`), JSON.stringify(data));
    console.log(`${char}: ${data.strokes.length} strokes${tag}`);
  }

  console.log(`Generated ${PREFECTURE_KANJI.length} kanji files.`);
  if (usedOverride.length) {
    console.log('subAnimJ overrides:', usedOverride.join(''));
  }
  if (usedFix.length) {
    console.log('manual fixes:', usedFix.join(''));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
