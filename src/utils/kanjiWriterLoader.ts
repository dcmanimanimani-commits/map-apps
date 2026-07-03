const HANZI_DATA_VERSION = '2.0.1';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@${HANZI_DATA_VERSION}`;

/** hanzi-writer CDN に無い日本語用漢字 */
export const LOCAL_KANJI_CHARS = new Set(['児', '広', '徳', '栃', '縄']);

export interface KanjiCharacterJson {
  strokes: string[];
  medians: number[][][];
}

type LoaderCallback = (data: KanjiCharacterJson) => void;
type ErrorCallback = (err?: unknown) => void;

async function fetchJson(url: string): Promise<KanjiCharacterJson> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json() as Promise<KanjiCharacterJson>;
}

export function createKanjiCharDataLoader() {
  return (char: string, onLoad: LoaderCallback, onError: ErrorCallback) => {
    const url = LOCAL_KANJI_CHARS.has(char)
      ? `/kanji-data/${encodeURIComponent(char)}.json`
      : `${CDN_BASE}/${encodeURIComponent(char)}.json`;

    fetchJson(url)
      .then(onLoad)
      .catch(onError);
  };
}
