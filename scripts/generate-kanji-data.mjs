/**
 * @k1low/hanzi-writer-data-jp から全都道府県漢字データを取得
 * （日本の書き順・HanziWriter 正式フォーマット）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const JP_BASE = 'https://unpkg.com/@k1low/hanzi-writer-data-jp@0.8.0';

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

  for (const char of PREFECTURE_KANJI) {
    const url = `${JP_BASE}/${encodeURIComponent(char)}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed ${char}: ${res.status}`);
    const data = await res.json();
    fs.writeFileSync(path.join(outDir, `${char}.json`), JSON.stringify(data));
    console.log(`${char}: ${data.strokes.length} strokes`);
  }

  console.log(`Downloaded ${PREFECTURE_KANJI.length} kanji files.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
