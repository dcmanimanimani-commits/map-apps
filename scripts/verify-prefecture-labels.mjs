import { readFileSync } from 'node:fs';
import {
  getPrefectureLabelLayout,
  getProjectedLargestRing,
  labelOverlapsRing,
  PREFER_INTERIOR_KANJI,
} from '../src/utils/mapLabels.ts';
import { getShortKanji, getShortHiragana, prefectureByKanji, prefectures } from '../src/data/prefectures.ts';
import { splitMainlandAndOkinawa, trimForRegionFocus, OKINAWA_KANJI } from '../src/utils/geoTransform.ts';
import { createRegionFocusPathGenerator, getFeatureKanji } from '../src/utils/geo.ts';
import { getRegionMapTuning, studyRegions } from '../src/data/regions.ts';
import { prefectureCapitalByKanji } from '../src/data/prefectureCapitals.ts';

const geo = JSON.parse(readFileSync('public/japan.geojson', 'utf8'));
const { mainland, okinawa } = splitMainlandAndOkinawa(geo);
const width = 400;
const height = 300;
const maxFontSize = 14;

const REGION_BY_PREF = {
  北海道: 'hokkaido',
  東北: 'tohoku',
  関東: 'kanto',
  中部: 'chubu',
  近畿: 'kinki',
  中国: 'chugoku',
  四国: 'shikoku',
  九州: 'kyushu',
};

function ringArea(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return (maxX - minX) * (maxY - minY);
}

function resolveRegionLabels(region) {
  const regionPrefs = prefectures.filter((p) => REGION_BY_PREF[p.region] === region.id);
  const focusSet = new Set(regionPrefs.map((p) => p.kanji));
  const focused = {
    type: 'FeatureCollection',
    features: mainland.features.filter((f) => focusSet.has(getFeatureKanji(f))),
  };
  const trimmed = trimForRegionFocus(focused);
  const tuning = getRegionMapTuning(region.id);
  const pathGen = createRegionFocusPathGenerator(
    trimmed,
    width,
    height,
    tuning.padding,
    Boolean(tuning.reserveOkinawaInset),
    undefined,
    tuning.landFill,
    tuning.okinawaInsetWidthRatio,
    tuning.okinawaInsetHeightRatio,
  );

  const entries = trimmed.features.map((feature) => {
    const kanji = getFeatureKanji(feature);
    const pref = prefectureByKanji.get(kanji);
    return {
      kanji,
      feature,
      pathGen,
      name: getShortKanji(kanji),
      hiragana: pref ? getShortHiragana(kanji, pref.hiragana) : '',
      capital: prefectureCapitalByKanji.get(kanji),
      ring: getProjectedLargestRing(feature, pathGen),
    };
  }).filter((entry) => entry.ring);

  entries.sort((a, b) => ringArea(b.ring) - ringArea(a.ring));

  const placed = [];
  const layouts = [];
  const labeled = new Set();

  for (const entry of entries) {
    const otherRings = entries
      .filter((other) => other.kanji !== entry.kanji)
      .map((other) => other.ring);
    const layout = getPrefectureLabelLayout(entry.feature, entry.pathGen, entry.name, entry.hiragana, maxFontSize, {
      capital: entry.capital ? { lon: entry.capital.lon, lat: entry.capital.lat } : undefined,
      otherRings,
      placedLabels: placed,
      mode: 'interior-only',
      relaxPlacedCollision: PREFER_INTERIOR_KANJI.has(entry.kanji),
      looseInteriorFit: PREFER_INTERIOR_KANJI.has(entry.kanji),
      minInteriorFontSize: PREFER_INTERIOR_KANJI.has(entry.kanji) ? 5 : undefined,
    });
    if (!layout) continue;
    layouts.push({ region: region.id, kanji: entry.kanji, status: layout.placement, ...layout });
    labeled.add(entry.kanji);
    placed.push({
      x: layout.x,
      y: layout.y,
      name: entry.name,
      hiragana: entry.hiragana,
      fontSize: layout.fontSize,
    });
  }

  for (const entry of [...entries].reverse()) {
    if (labeled.has(entry.kanji)) continue;
    const otherRings = entries
      .filter((other) => other.kanji !== entry.kanji)
      .map((other) => other.ring);
    const layout = getPrefectureLabelLayout(entry.feature, entry.pathGen, entry.name, entry.hiragana, maxFontSize, {
      capital: entry.capital ? { lon: entry.capital.lon, lat: entry.capital.lat } : undefined,
      otherRings,
      placedLabels: placed,
      mode: 'sea-only',
    });
    if (!layout) continue;
    layouts.push({ region: region.id, kanji: entry.kanji, status: layout.placement, ...layout });
    labeled.add(entry.kanji);
    placed.push({
      x: layout.x,
      y: layout.y,
      name: entry.name,
      hiragana: entry.hiragana,
      fontSize: layout.fontSize,
    });
  }

  for (const entry of entries) {
    if (labeled.has(entry.kanji)) continue;
    const otherRings = entries
      .filter((other) => other.kanji !== entry.kanji)
      .map((other) => other.ring);
    const layout = getPrefectureLabelLayout(entry.feature, entry.pathGen, entry.name, entry.hiragana, maxFontSize, {
      capital: entry.capital ? { lon: entry.capital.lon, lat: entry.capital.lat } : undefined,
      otherRings,
      placedLabels: placed,
      mode: 'auto',
    });
    if (!layout) {
      layouts.push({ region: region.id, kanji: entry.kanji, status: 'missing' });
      continue;
    }
    layouts.push({ region: region.id, kanji: entry.kanji, status: layout.placement, ...layout });
    placed.push({
      x: layout.x,
      y: layout.y,
      name: entry.name,
      hiragana: entry.hiragana,
      fontSize: layout.fontSize,
    });
  }

  const upgradedLayouts = [];
  const upgradedPlaced = [];
  for (const layout of layouts) {
    if (layout.status === 'missing' || layout.placement === 'interior') {
      upgradedLayouts.push(layout);
      if (layout.status !== 'missing') {
        upgradedPlaced.push({
          x: layout.x,
          y: layout.y,
          name: getShortKanji(layout.kanji),
          hiragana: getShortHiragana(layout.kanji, prefectureByKanji.get(layout.kanji).hiragana),
          fontSize: layout.fontSize,
        });
      }
      continue;
    }

    const entry = entries.find((item) => item.kanji === layout.kanji);
    if (!entry) {
      upgradedLayouts.push(layout);
      continue;
    }

    const otherRings = entries
      .filter((other) => other.kanji !== entry.kanji)
      .map((other) => other.ring);
    const interior = getPrefectureLabelLayout(entry.feature, entry.pathGen, entry.name, entry.hiragana, maxFontSize, {
      capital: entry.capital ? { lon: entry.capital.lon, lat: entry.capital.lat } : undefined,
      otherRings,
      placedLabels: upgradedPlaced,
      mode: 'interior-only',
      relaxPlacedCollision: true,
      looseInteriorFit: PREFER_INTERIOR_KANJI.has(entry.kanji),
      minInteriorFontSize: PREFER_INTERIOR_KANJI.has(entry.kanji) ? 5 : undefined,
    });

    if (interior) {
      upgradedLayouts.push({ region: region.id, kanji: entry.kanji, status: interior.placement, ...interior });
      upgradedPlaced.push({
        x: interior.x,
        y: interior.y,
        name: entry.name,
        hiragana: entry.hiragana,
        fontSize: interior.fontSize,
      });
    } else {
      upgradedLayouts.push(layout);
      upgradedPlaced.push({
        x: layout.x,
        y: layout.y,
        name: entry.name,
        hiragana: entry.hiragana,
        fontSize: layout.fontSize,
      });
    }
  }

  return { layouts: upgradedLayouts, ringByKanji: new Map(entries.map((entry) => [entry.kanji, entry.ring])) };
}

function invadesOther(layout, kanji, ringByKanji) {
  const pref = prefectureByKanji.get(kanji);
  const name = getShortKanji(kanji);
  const hiragana = pref ? getShortHiragana(kanji, pref.hiragana) : '';
  for (const [otherKanji, otherRing] of ringByKanji.entries()) {
    if (otherKanji === kanji) continue;
    if (labelOverlapsRing(otherRing, layout.x, layout.y, name, hiragana, layout.fontSize)) {
      return otherKanji;
    }
  }
  return null;
}

const missing = [];
const invasions = [];
const watch = ['青森県', '石川県', '東京都', '大阪府', '京都府', '和歌山県', '鹿児島県', '福岡県', '長崎県', '熊本県'];
const regionCache = new Map();

for (const region of studyRegions) {
  const resolved = resolveRegionLabels(region);
  regionCache.set(region.id, resolved);
  const { layouts, ringByKanji } = resolved;
  for (const layout of layouts) {
    if (layout.status === 'missing') {
      missing.push(layout);
      continue;
    }
    const invaded = invadesOther(layout, layout.kanji, ringByKanji);
    if (invaded) {
      invasions.push({ ...layout, invaded });
    }
  }
}

if (okinawa) {
  const pathGen = createRegionFocusPathGenerator(
    { type: 'FeatureCollection', features: [okinawa] },
    width,
    height,
    1,
    false,
  );
  const pref = prefectureByKanji.get(OKINAWA_KANJI);
  const layout = getPrefectureLabelLayout(
    okinawa,
    pathGen,
    getShortKanji(OKINAWA_KANJI),
    getShortHiragana(OKINAWA_KANJI, pref.hiragana),
    maxFontSize,
    { capital: prefectureCapitalByKanji.get(OKINAWA_KANJI) },
  );
  if (!layout) missing.push({ region: 'okinawa-only', kanji: OKINAWA_KANJI, status: 'missing' });
}

const watchResults = watch.map((kanji) => {
  for (const resolved of regionCache.values()) {
    const hit = resolved.layouts.find((layout) => layout.kanji === kanji);
    if (hit) return hit;
  }
  return null;
}).filter(Boolean);

console.log('Missing labels:', missing.length ? missing : 'none');
console.log('Invasions:', invasions.length ? invasions : 'none');
console.log('Watched prefectures:', watchResults);

if (missing.length > 0 || invasions.length > 0) process.exit(1);
