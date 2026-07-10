import { readFileSync } from 'node:fs';
import {
  getPrefectureLabelLayout,
  allowsSeaPrefectureLabel,
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

function projectCapitalLabel(kanji, name, hiragana, pathGen) {
  const capital = prefectureCapitalByKanji.get(kanji);
  const projection = pathGen.projection();
  if (!capital || !projection || typeof projection !== 'function') return null;
  const projected = projection([capital.lon, capital.lat]);
  if (!projected) return null;
  return {
    x: projected[0],
    y: projected[1],
    fontSize: Math.max(6, Math.min(maxFontSize, 12)),
    clip: false,
    name,
    hiragana,
  };
}

function evaluateLabel(kanji, feature, pathGen) {
  const pref = prefectureByKanji.get(kanji);
  const name = getShortKanji(kanji);
  const hiragana = pref ? getShortHiragana(kanji, pref.hiragana) : '';
  const seaLabel = allowsSeaPrefectureLabel(kanji);

  if (seaLabel && kanji !== OKINAWA_KANJI) {
    const capital = projectCapitalLabel(kanji, name, hiragana, pathGen);
    if (capital) return { status: 'capital-first', ...capital };
  }

  const layout = getPrefectureLabelLayout(feature, pathGen, name, hiragana, maxFontSize, {
    allowOutside: seaLabel,
  });

  if (layout && !(layout.clip && layout.fontSize < 8)) {
    return { status: 'polylabel', ...layout, name, hiragana };
  }

  const capital = projectCapitalLabel(kanji, name, hiragana, pathGen);
  if (capital) return { status: 'capital-fallback', ...capital };
  if (layout) return { status: 'small-clipped', ...layout, name, hiragana };
  return { status: 'missing', name, hiragana };
}

const missing = [];
const fallback = [];
const small = [];

for (const region of studyRegions) {
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
  );

  for (const feature of trimmed.features) {
    const kanji = getFeatureKanji(feature);
    const result = evaluateLabel(kanji, feature, pathGen);
    if (result.status === 'missing') missing.push({ region: region.id, kanji, ...result });
    if (result.status === 'capital-fallback') fallback.push({ region: region.id, kanji, ...result });
    if (result.status === 'small-clipped') small.push({ region: region.id, kanji, ...result });
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
  const result = evaluateLabel(OKINAWA_KANJI, okinawa, pathGen);
  if (result.status === 'missing') missing.push({ region: 'okinawa-only', kanji: OKINAWA_KANJI, ...result });
  if (result.status === 'capital-fallback') fallback.push({ region: 'okinawa-only', kanji: OKINAWA_KANJI, ...result });
  if (result.status === 'small-clipped') small.push({ region: 'okinawa-only', kanji: OKINAWA_KANJI, ...result });
}

console.log('Missing labels:', missing.length ? missing : 'none');
console.log('Capital fallback needed:', fallback.length ? fallback : 'none');
console.log('Small clipped labels:', small.length ? small : 'none');

if (missing.length > 0) process.exit(1);
