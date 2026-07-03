/** 不足分だけ再取得 */
import fs from 'fs';
import path from 'path';
import { prefectures } from '../src/data/prefectures.ts';
import { curatedCommonsFiles } from './landmark-image-curated.mjs';

const UA = 'NihonChizuTanken/1.0 (educational app)';
const OUT_DIR = path.join('public', 'landmarks');
const MANIFEST_PATH = path.join('src', 'data', 'landmarkImages.ts');

const prefByKanji = Object.fromEntries(prefectures.map((p) => [p.kanji, p.id]));

function loadMapping() {
  const text = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const json = text.match(/= (\{[\s\S]*?\});/)?.[1];
  return json ? JSON.parse(json) : {};
}

async function getThumb(file) {
  const title = file.startsWith('File:') ? file : `File:${file}`;
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '480',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': UA },
  });
  const data = await res.json();
  const page = Object.values(data.query?.pages ?? {})[0];
  return page?.imageinfo?.[0]?.thumburl ?? null;
}

async function main() {
  const mapping = loadMapping();
  for (const [key, file] of Object.entries(curatedCommonsFiles)) {
    if (mapping[key]) continue;
    const [kanji, index] = key.split(':');
    const prefId = prefByKanji[kanji];
    if (!prefId) continue;
    const url = await getThumb(file);
    if (!url) {
      console.log('skip', key, file);
      continue;
    }
    const ext = url.match(/\.(jpe?g|png|webp)/i)?.[0] ?? '.jpg';
    const fileName = `${String(prefId).padStart(2, '0')}-${index}${ext.replace('jpeg', 'jpg')}`;
    const imgRes = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!imgRes.ok) {
      console.log('dl fail', key);
      continue;
    }
    fs.writeFileSync(path.join(OUT_DIR, fileName), Buffer.from(await imgRes.arrayBuffer()));
    mapping[key] = `/landmarks/${fileName}`;
    console.log('ok', key);
    await new Promise((r) => setTimeout(r, 400));
  }
  const ts = `/** 自動生成: npm run fetch:landmark-images */\nexport const landmarkImages: Record<string, string> = ${JSON.stringify(mapping, null, 2)};\n\nexport function getLandmarkImage(kanji: string, index: number): string | undefined {\n  return landmarkImages[\`\${kanji}:\${index}\`];\n}\n`;
  fs.writeFileSync(MANIFEST_PATH, ts);
  console.log('total', Object.keys(mapping).length);
}

main();
