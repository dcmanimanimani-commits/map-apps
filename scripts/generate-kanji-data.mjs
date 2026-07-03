/**
 * KanjiVG SVG → hanzi-writer JSON（日本語専用漢字用）
 */
import fs from 'fs';
import path from 'path';

const SCALE = 1024 / 109;
const CHARS = [
  { char: '児', code: '05150' },
  { char: '広', code: '05e83' },
  { char: '徳', code: '05fb3' },
  { char: '栃', code: '06803' },
  { char: '縄', code: '07e04' },
];

function scale(n) {
  return Math.round(Number(n) * SCALE);
}

function tokenizePath(d) {
  return d.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g) ?? [];
}

function scalePath(d) {
  const tokens = tokenizePath(d);
  return tokens
    .map((t) => (/^[a-zA-Z]$/.test(t) ? t : String(scale(t))))
    .join(' ');
}

function pathToPoints(d) {
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
    const px = scale(x);
    const py = scale(y);
    points.push([px, py]);
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
      case 'q': {
        i += 2;
        addPoint(cx + readNum(), cy + readNum());
        break;
      }
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

function buildMedian(points) {
  if (points.length === 0) return [[512, 512]];
  if (points.length === 1) return points;
  if (points.length === 2) return points;

  const median = [points[0]];
  const mid = points[Math.floor(points.length / 2)];
  if (mid !== points[0]) median.push(mid);
  const last = points[points.length - 1];
  if (last !== median[median.length - 1]) median.push(last);
  return median;
}

async function fetchSvg(code) {
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${code}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${code}: ${res.status}`);
  return res.text();
}

function parseStrokes(svg) {
  const re = /<path[^>]*id="kvg:[^"]*-s(\d+)"[^>]*d="([^"]+)"/g;
  const strokes = [];
  let match;
  while ((match = re.exec(svg)) !== null) {
    strokes.push({ num: Number(match[1]), d: match[2] });
  }
  strokes.sort((a, b) => a.num - b.num);
  return strokes;
}

async function main() {
  const outDir = path.join('public', 'kanji-data');
  fs.mkdirSync(outDir, { recursive: true });

  for (const { char, code } of CHARS) {
    const svg = await fetchSvg(code);
    const parsed = parseStrokes(svg);
    const data = {
      strokes: parsed.map((s) => scalePath(s.d)),
      medians: parsed.map((s) => buildMedian(pathToPoints(s.d))),
    };
    const file = path.join(outDir, `${char}.json`);
    fs.writeFileSync(file, JSON.stringify(data));
    console.log(`${char}: ${parsed.length} strokes -> ${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
