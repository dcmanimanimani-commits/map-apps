import { PREFECTURE_KANJI, fetchKanjiSvg, kanjiSvgToWriterData } from './generate-kanji-data.mjs';

const CDN = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1';

const mismatches = [];

for (const char of PREFECTURE_KANJI) {
  const svg = await fetchKanjiSvg(char);
  const kvg = kanjiSvgToWriterData(svg).strokes.length;
  const cdnRes = await fetch(`${CDN}/${encodeURIComponent(char)}.json`);
  const cdn = cdnRes.ok ? (await cdnRes.json()).strokes.length : null;

  if (cdn !== null && cdn !== kvg) {
    mismatches.push({ char, cdn, kvg });
  }
}

console.log('CDN vs KanjiVG stroke count differences:', mismatches.length);
for (const m of mismatches) {
  console.log(`  ${m.char}: CDN=${m.cdn} KanjiVG=${m.kvg}`);
}
