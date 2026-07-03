/**
 * 全都道府県の漢字を KanjiVG（日本の書き順）から hanzi-writer 用 JSON を生成
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SCALE = 1024 / 109;

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

function toCode(char) {
  return char.codePointAt(0).toString(16).padStart(5, '0');
}

function scale(n) {
  return Math.round(Number(n) * SCALE);
}

function tokenizePath(d) {
  return d.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g) ?? [];
}

export function scalePath(d) {
  const tokens = tokenizePath(d);
  return tokens
    .map((t) => (/^[a-zA-Z]$/.test(t) ? t : String(scale(t))))
    .join(' ');
}

export function pathToPoints(d) {
  const tokens = tokenizePath(d);
  const points = [];
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const readNum = () => Number(tokens[i++]);

  const addPoint = (x, y) => {
    points.push([scale(x), scale(y)]);
    cx = x;
    cy = y;
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      i++;
      continue;
    }

    switch (cmd) {
      case 'M':
        sx = readNum(); sy = readNum();
        addPoint(sx, sy);
        cmd = 'L';
        break;
      case 'm':
        sx = cx + readNum(); sy = cy + readNum();
        addPoint(sx, sy);
        cmd = 'l';
        break;
      case 'L':
        addPoint(readNum(), readNum());
        break;
      case 'l':
        addPoint(cx + readNum(), cy + readNum());
        break;
      case 'C':
        addPoint(readNum(), readNum());
        i += 2;
        addPoint(readNum(), readNum());
        break;
      case 'c': {
        const x1 = cx + readNum();
        const y1 = cy + readNum();
        const x2 = cx + readNum();
        const y2 = cy + readNum();
        const x = cx + readNum();
        const y = cy + readNum();
        addPoint(x1, y1);
        addPoint(x2, y2);
        addPoint(x, y);
        break;
      }
      case 'Q':
        i += 2;
        addPoint(readNum(), readNum());
        break;
      case 'q':
        i += 2;
        addPoint(cx + readNum(), cy + readNum());
        break;
      case 'H':
        addPoint(readNum(), cy);
        break;
      case 'h':
        addPoint(cx + readNum(), cy);
        break;
      case 'V':
        addPoint(cx, readNum());
        break;
      case 'v':
        addPoint(cx, cy + readNum());
        break;
      case 'Z':
      case 'z':
        addPoint(sx, sy);
        break;
      default:
        i++;
        break;
    }
  }

  return points;
}

export function buildMedian(points) {
  if (points.length === 0) return [[512, 512]];
  if (points.length <= 2) return points;

  const median = [points[0]];
  const mid = points[Math.floor(points.length / 2)];
  if (mid !== points[0]) median.push(mid);
  const last = points[points.length - 1];
  if (last !== median[median.length - 1]) median.push(last);
  return median;
}

export async function fetchKanjiSvg(char) {
  const code = toCode(char);
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${code}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`KanjiVG not found: ${char} (${code})`);
  return res.text();
}

export function parseStrokes(svg) {
  const re = /<path[^>]*id="kvg:[^"]*-s(\d+)"[^>]*d="([^"]+)"/g;
  const strokes = [];
  let match;
  while ((match = re.exec(svg)) !== null) {
    strokes.push({ num: Number(match[1]), d: match[2] });
  }
  strokes.sort((a, b) => a.num - b.num);
  return strokes;
}

export function kanjiSvgToWriterData(svg) {
  const parsed = parseStrokes(svg);
  return {
    strokes: parsed.map((s) => scalePath(s.d)),
    medians: parsed.map((s) => buildMedian(pathToPoints(s.d))),
  };
}

async function main() {
  const outDir = path.join('public', 'kanji-data');
  fs.mkdirSync(outDir, { recursive: true });

  const failures = [];
  for (const char of PREFECTURE_KANJI) {
    try {
      const svg = await fetchKanjiSvg(char);
      const data = kanjiSvgToWriterData(svg);
      const file = path.join(outDir, `${char}.json`);
      fs.writeFileSync(file, JSON.stringify(data));
      console.log(`${char}: ${data.strokes.length} strokes`);
    } catch (err) {
      failures.push({ char, err: err.message });
      console.error(`${char}: FAILED - ${err.message}`);
    }
  }

  if (failures.length) {
    process.exit(1);
  }
  console.log(`Generated ${PREFECTURE_KANJI.length} kanji files.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
