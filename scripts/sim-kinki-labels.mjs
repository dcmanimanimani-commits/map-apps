import { readFileSync } from 'node:fs';
import { getPrefectureLabelLayout, getProjectedLargestRing } from '../src/utils/mapLabels.ts';
import { getShortKanji, getShortHiragana, prefectureByKanji, prefectures } from '../src/data/prefectures.ts';
import { splitMainlandAndOkinawa, trimForRegionFocus } from '../src/utils/geoTransform.ts';
import { createRegionFocusPathGenerator, getFeatureKanji } from '../src/utils/geo.ts';
import { getRegionMapTuning } from '../src/data/regions.ts';
import { prefectureCapitalByKanji } from '../src/data/prefectureCapitals.ts';

const geo = JSON.parse(readFileSync('public/japan.geojson', 'utf8'));
const { mainland } = splitMainlandAndOkinawa(geo);
const regionPrefs = prefectures.filter((p) => p.region === '近畿');
const focusSet = new Set(regionPrefs.map((p) => p.kanji));
const trimmed = trimForRegionFocus({
  type: 'FeatureCollection',
  features: mainland.features.filter((f) => focusSet.has(getFeatureKanji(f))),
});
const pathGen = createRegionFocusPathGenerator(trimmed, 400, 300, getRegionMapTuning('kinki').padding, false);
const entries = trimmed.features.map((feature) => {
  const kanji = getFeatureKanji(feature);
  const pref = prefectureByKanji.get(kanji);
  return {
    kanji,
    feature,
    pathGen,
    name: getShortKanji(kanji),
    hiragana: getShortHiragana(kanji, pref.hiragana),
    capital: prefectureCapitalByKanji.get(kanji),
    ring: getProjectedLargestRing(feature, pathGen),
  };
}).filter((entry) => entry.ring);

function ringArea(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return (maxX - minX) * (maxY - minY);
}

function layoutFor(entry, otherRings, placed, mode, relax = false) {
  return getPrefectureLabelLayout(entry.feature, entry.pathGen, entry.name, entry.hiragana, 12, {
    capital: entry.capital ? { lon: entry.capital.lon, lat: entry.capital.lat } : undefined,
    otherRings,
    placedLabels: placed,
    mode,
    relaxPlacedCollision: relax,
  });
}

entries.sort((a, b) => ringArea(b.ring) - ringArea(a.ring));
const placed = [];
const items = [];
const labeled = new Set();

for (const entry of entries) {
  const otherRings = entries.filter((e) => e.kanji !== entry.kanji).map((e) => e.ring);
  const layout = layoutFor(entry, otherRings, placed, 'interior-only');
  if (!layout) continue;
  items.push({ kanji: entry.kanji, ...layout });
  labeled.add(entry.kanji);
  placed.push({ x: layout.x, y: layout.y, name: entry.name, hiragana: entry.hiragana, fontSize: layout.fontSize });
}

for (const entry of [...entries].reverse()) {
  if (labeled.has(entry.kanji)) continue;
  const otherRings = entries.filter((e) => e.kanji !== entry.kanji).map((e) => e.ring);
  const layout = layoutFor(entry, otherRings, placed, 'sea-only');
  if (!layout) continue;
  items.push({ kanji: entry.kanji, ...layout });
  labeled.add(entry.kanji);
  placed.push({ x: layout.x, y: layout.y, name: entry.name, hiragana: entry.hiragana, fontSize: layout.fontSize });
}

const upgraded = [];
const upgradedPlaced = [];
for (const label of items) {
  if (label.placement === 'interior') {
    upgraded.push(label);
    upgradedPlaced.push({ x: label.x, y: label.y, name: label.name, hiragana: label.hiragana, fontSize: label.fontSize });
    continue;
  }
  const entry = entries.find((e) => e.kanji === label.kanji);
  const otherRings = entries.filter((e) => e.kanji !== entry.kanji).map((e) => e.ring);
  const interior = layoutFor(entry, otherRings, upgradedPlaced, 'interior-only', true);
  upgraded.push(interior ? { kanji: entry.kanji, ...interior } : label);
  const finalLabel = interior ?? label;
  upgradedPlaced.push({ x: finalLabel.x, y: finalLabel.y, name: entry.name, hiragana: entry.hiragana, fontSize: finalLabel.fontSize });
}

console.log('before', items.find((l) => l.kanji === '和歌山県'));
console.log('after', upgraded.find((l) => l.kanji === '和歌山県'));
