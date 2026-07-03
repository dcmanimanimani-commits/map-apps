/**
 * KanjiVG SVG → HanziWriter JSON
 * Moritz72/KanjiVGToHanziWriterConverter の Node 移植
 */
import parseSVGModule from 'svg-path-parser';

const parseSVG = parseSVGModule;
const makeAbsolute = parseSVGModule.makeAbsolute;

const SHIFT_X = 0;
const SHIFT_Y = 900;
const SCALE_X = 1024 / 109;
const SCALE_Y = -1024 / 109;

function transformCoord(x, y) {
  return [
    Math.round(x * SCALE_X + SHIFT_X),
    Math.round(y * SCALE_Y + SHIFT_Y),
  ];
}

function serializeCommands(commands) {
  let out = '';
  for (const cmd of commands) {
    switch (cmd.code) {
      case 'M':
        out += `M ${cmd.x} ${cmd.y}`;
        break;
      case 'L':
        out += `L ${cmd.x} ${cmd.y}`;
        break;
      case 'C':
        out += `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`;
        break;
      case 'Q':
        out += `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`;
        break;
      case 'Z':
        out += 'Z';
        break;
      default:
        break;
    }
  }
  return out.replace(/\.0\b/g, '');
}

function transformPath(d) {
  const absolute = makeAbsolute(parseSVG(d));
  const transformed = absolute.map((cmd) => {
    const next = { ...cmd };
    if ('x' in next && next.x != null) {
      [next.x, next.y] = transformCoord(next.x, next.y);
    }
    if ('x1' in next && next.x1 != null) {
      [next.x1, next.y1] = transformCoord(next.x1, next.y1);
    }
    if ('x2' in next && next.x2 != null) {
      [next.x2, next.y2] = transformCoord(next.x2, next.y2);
    }
    return next;
  });
  return serializeCommands(transformed);
}

function estimateMedian(d, resolution = 8) {
  const absolute = makeAbsolute(parseSVG(d));
  const points = [];

  for (const cmd of absolute) {
    if (cmd.code === 'M' || cmd.code === 'L') {
      points.push(transformCoord(cmd.x, cmd.y));
    } else if (cmd.code === 'C') {
      points.push(transformCoord(cmd.x, cmd.y));
    } else if (cmd.code === 'Q') {
      points.push(transformCoord(cmd.x, cmd.y));
    }
  }

  if (points.length === 0) return [[512, 512]];
  if (points.length <= 3) return points;

  const median = [points[0]];
  const mid = points[Math.floor(points.length / 2)];
  if (mid[0] !== median[0][0] || mid[1] !== median[0][1]) median.push(mid);
  const last = points[points.length - 1];
  if (last[0] !== median[median.length - 1][0] || last[1] !== median[median.length - 1][1]) {
    median.push(last);
  }
  return median;
}

export function parseKanjiVgStrokes(svg) {
  const re = /<path[^>]*id="kvg:[^"]*-s(\d+)"[^>]*d="([^"]+)"/g;
  const strokes = [];
  let match;
  while ((match = re.exec(svg)) !== null) {
    strokes.push({ num: Number(match[1]), d: match[2] });
  }
  strokes.sort((a, b) => a.num - b.num);
  return strokes;
}

export async function fetchKanjiVgSvg(char) {
  const code = char.codePointAt(0).toString(16).padStart(5, '0');
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${code}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`KanjiVG not found: ${char}`);
  return res.text();
}

export function kanjiVgSvgToWriterData(svg) {
  const parsed = parseKanjiVgStrokes(svg);
  return {
    strokes: parsed.map((s) => transformPath(s.d)),
    medians: parsed.map((s) => estimateMedian(s.d)),
  };
}

export async function loadSubAnimJOverrides() {
  const text = await fetch('https://raw.githubusercontent.com/k1LoW/subAnimJ/main/graphicsJa.txt').then((r) => r.text());
  const overrides = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      overrides.set(data.character, {
        strokes: data.strokes,
        medians: data.medians,
      });
    } catch {
      // skip
    }
  }
  return overrides;
}

export async function loadAnimCjkEntry(char) {
  const text = await fetch('https://raw.githubusercontent.com/parsimonhi/animCJK/master/graphicsJa.txt').then((r) => r.text());
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      if (data.character === char) {
        return { strokes: data.strokes, medians: data.medians };
      }
    } catch {
      // skip
    }
  }
  return null;
}

/** 縄: animCJK の中国式いとへんを subAnimJ「組」の日本式いとへんに差し替え */
export async function fixNawaStrokeData(subAnimJ) {
  const kumi = subAnimJ.get('組');
  const nawa = await loadAnimCjkEntry('縄');
  if (!kumi || !nawa || kumi.strokes.length < 6 || nawa.strokes.length < 7) {
    throw new Error('縄 fix: missing 組 or 縄 source data');
  }
  return {
    strokes: [...kumi.strokes.slice(0, 6), ...nawa.strokes.slice(6)],
    medians: [...kumi.medians.slice(0, 6), ...nawa.medians.slice(6)],
  };
}
