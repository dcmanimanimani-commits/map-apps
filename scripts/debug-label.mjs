import { readFileSync } from 'node:fs';
import {
  getPrefectureLabelLayout,
  getProjectedLargestRing,
  labelFitsInside,
  labelOverlapsRing,
} from '../src/utils/mapLabels.ts';
import { getShortKanji, getShortHiragana, prefectureByKanji, prefectures } from '../src/data/prefectures.ts';
import { splitMainlandAndOkinawa, trimForRegionFocus } from '../src/utils/geoTransform.ts';
import { createRegionFocusPathGenerator, getFeatureKanji } from '../src/utils/geo.ts';
import { getRegionMapTuning } from '../src/data/regions.ts';
import { prefectureCapitalByKanji } from '../src/data/prefectureCapitals.ts';

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

const target = process.argv[2] ?? '東京都';
const pref = prefectureByKanji.get(target);
const regionId = REGION_BY_PREF[pref.region];
const geo = JSON.parse(readFileSync('public/japan.geojson', 'utf8'));
const { mainland } = splitMainlandAndOkinawa(geo);
const regionPrefs = prefectures.filter((p) => REGION_BY_PREF[p.region] === regionId);
const focusSet = new Set(regionPrefs.map((p) => p.kanji));
const trimmed = trimForRegionFocus({
  type: 'FeatureCollection',
  features: mainland.features.filter((f) => focusSet.has(getFeatureKanji(f))),
});
const pathGen = createRegionFocusPathGenerator(
  trimmed,
  400,
  300,
  getRegionMapTuning(regionId).padding,
  Boolean(getRegionMapTuning(regionId).reserveOkinawaInset),
);
const entries = trimmed.features.map((feature) => {
  const kanji = getFeatureKanji(feature);
  const p = prefectureByKanji.get(kanji);
  return {
    kanji,
    feature,
    name: getShortKanji(kanji),
    hiragana: getShortHiragana(kanji, p.hiragana),
    capital: prefectureCapitalByKanji.get(kanji),
    ring: getProjectedLargestRing(feature, pathGen),
  };
}).filter((entry) => entry.ring);

const entry = entries.find((e) => e.kanji === target);
const others = entries.filter((e) => e.kanji !== target);

for (const mode of ['interior-only', 'sea-only', 'auto']) {
  const layout = getPrefectureLabelLayout(entry.feature, pathGen, entry.name, entry.hiragana, 14, {
    capital: entry.capital ? { lon: entry.capital.lon, lat: entry.capital.lat } : undefined,
    otherRings: others.map((o) => o.ring),
    placedLabels: [],
    mode,
    minSeaFontSize: 5,
  });
  console.log(mode, layout);
}

const name = entry.name;
const hira = entry.hiragana;
for (const fs of [10, 8, 6, 5]) {
  let interiorHits = 0;
  let seaHits = 0;
  for (const y of Array.from({ length: 30 }, (_, i) => i * 10)) {
    for (const x of Array.from({ length: 40 }, (_, i) => i * 10)) {
      if (labelFitsInside(entry.ring, x, y, name, hira, fs)) {
        const inv = others.some((o) => labelOverlapsRing(o.ring, x, y, name, hira, fs));
        if (!inv) interiorHits++;
      }
      if (!labelOverlapsRing(entry.ring, x, y, name, hira, fs)) {
        const inv = others.some((o) => labelOverlapsRing(o.ring, x, y, name, hira, fs));
        if (!inv) seaHits++;
      }
    }
  }
  console.log(`fs=${fs} interior=${interiorHits} sea=${seaHits}`);
}
