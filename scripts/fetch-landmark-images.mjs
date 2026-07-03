/**
 * Wikimedia Commons から名物・名所サムネイルを取得
 * npm run fetch:landmark-images
 */
import fs from 'fs';
import path from 'path';
import { landmarkSpotsByKanji } from '../src/data/landmarkDetails.ts';
import { prefectures } from '../src/data/prefectures.ts';
import { curatedCommonsFiles } from './landmark-image-curated.mjs';

const OUT_DIR = path.join('public', 'landmarks');
const MANIFEST_PATH = path.join('src', 'data', 'landmarkImages.ts');
const WIDTH = 480;
const DELAY_MS = 250;
const UA = 'NihonChizuTanken/1.0 (Japanese map learning app; educational)';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function prefShort(kanji) {
  if (kanji === '北海道') return '北海道';
  return kanji.replace(/[都道府県]/g, '');
}

function spotLabel(name) {
  return name.replace(/（[^）]+）/g, '').trim();
}

function searchQueries(prefKanji, spot) {
  const pref = prefShort(prefKanji);
  const label = spotLabel(spot.name);
  return [
    `${label} ${pref}`,
    label,
    `${pref} ${label}`,
    `${label} Japan`,
  ];
}

async function fetchFromFileTitle(fileTitle) {
  const title = fileTitle.startsWith('File:') ? fileTitle : `File:${fileTitle}`;
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: String(WIDTH),
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (page?.missing !== undefined) return null;
  const info = page?.imageinfo?.[0];
  return info?.thumburl ?? info?.url ?? null;
}

async function fetchThumbUrl(queries) {
  for (const query of queries) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: query,
      gsrlimit: '3',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: String(WIDTH),
      format: 'json',
      origin: '*',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) continue;
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) continue;
    for (const page of Object.values(pages)) {
      const info = page?.imageinfo?.[0];
      const url = info?.thumburl ?? info?.url;
      if (url) return url;
    }
  }
  return null;
}

function extFromUrl(url) {
  const m = url.match(/\.(jpe?g|png|webp)(\?|$)/i);
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg';
}

async function resolveImageUrl(key, prefKanji, spot) {
  const curated = curatedCommonsFiles[key];
  if (curated) {
    const url = await fetchFromFileTitle(curated);
    if (url) return url;
  }
  return fetchThumbUrl(searchQueries(prefKanji, spot));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const mapping = {};
  const missing = [];

  for (const pref of prefectures) {
    const spots = landmarkSpotsByKanji[pref.kanji] ?? [];
    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i];
      const key = `${pref.kanji}:${i}`;
      const fileBase = `${String(pref.id).padStart(2, '0')}-${i}`;

      process.stdout.write(`${fileBase} ${spotLabel(spot.name)} ... `);

      try {
        const thumbUrl = await resolveImageUrl(key, pref.kanji, spot);
        if (!thumbUrl) {
          console.log('SKIP');
          missing.push(key);
          await sleep(DELAY_MS);
          continue;
        }

        const ext = extFromUrl(thumbUrl);
        const fileName = `${fileBase}${ext}`;
        const outPath = path.join(OUT_DIR, fileName);
        const imgRes = await fetch(thumbUrl, { headers: { 'User-Agent': UA } });
        if (!imgRes.ok) {
          console.log('SKIP (download)');
          missing.push(key);
          await sleep(DELAY_MS);
          continue;
        }

        const buf = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(outPath, buf);
        mapping[key] = `/landmarks/${fileName}`;
        console.log('OK');
      } catch (err) {
        console.log(`ERR (${err.message})`);
        missing.push(key);
      }

      await sleep(DELAY_MS);
    }
  }

  const tsContent = `/** 自動生成: npm run fetch:landmark-images */\nexport const landmarkImages: Record<string, string> = ${JSON.stringify(mapping, null, 2)};\n\nexport function getLandmarkImage(kanji: string, index: number): string | undefined {\n  return landmarkImages[\`\${kanji}:\${index}\`];\n}\n`;
  fs.writeFileSync(MANIFEST_PATH, tsContent);

  console.log(`\nDone: ${Object.keys(mapping).length} images, ${missing.length} missing`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
