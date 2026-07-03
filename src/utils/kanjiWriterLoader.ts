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

/** 日本の書き順（KanjiVG）データを常に使用 */
export function createKanjiCharDataLoader() {
  return (char: string, onLoad: LoaderCallback, onError: ErrorCallback) => {
    fetchJson(`/kanji-data/${encodeURIComponent(char)}.json`)
      .then(onLoad)
      .catch(onError);
  };
}
