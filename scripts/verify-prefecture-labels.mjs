import { readFileSync } from 'node:fs';
import { getPrefectureLabelLayout } from '../src/utils/mapLabels.ts';
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

function evaluateLabel(kanji, feature, pathGen) {
  const pref = prefectureByKanji.get(kanji);
  const name = getShortKanji(kanji);
  const hiragana = pref ? getShortHiragana(kanji, pref.hiragana) : '';
  const capital = prefectureCapitalByKanji.get(kanji);
  const layout = getPrefectureLabelLayout(feature, pathGen, name, hiragana, maxFontSize, {
    capital: capital ? { lon: capital.lon, lat: capital.lat } : undefined,
  });
  if (!layout) return { status: 'missing', name, hiragana };
  return { status: layout.placement, ...layout, name, hiragana };
}

const missing = [];
const sea = [];
const interior = [];

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
    const entry = { region: region.id, kanji, ...result };
    if (result.status === 'missing') missing.push(entry);
    if (result.status === 'sea') sea.push(entry);
    if (result.status === 'interior') interior.push(entry);
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
  const entry = { region: 'okinawa-only', kanji: OKINAWA_KANJI, ...result };
  if (result.status === 'missing') missing.push(entry);
  if (result.status === 'sea') sea.push(entry);
  if (result.status === 'interior') interior.push(entry);
}

const watch = ['青森県', '福井県', '石川県', '高知県', '長崎県'];
const watchResults = [...interior, ...sea].filter((e) => watch.includes(e.kanji));

console.log('Missing labels:', missing.length ? missing : 'none');
console.log('Sea placement:', sea.length ? sea.map(({ region, kanji, fontSize }) => `${kanji}@${region}(${fontSize}px)`) : 'none');
console.log('Watched prefectures:', watchResults.length ? watchResults : 'none found in scan');

if (missing.length > 0) process.exit(1);
