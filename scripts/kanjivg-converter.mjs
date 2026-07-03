/**
 * 漢字データの手修正ユーティリティ
 */

export async function loadSubAnimJOverrides() {
  const text = await fetch('https://raw.githubusercontent.com/k1LoW/subAnimJ/main/graphicsJa.txt').then((r) => r.text());
  const overrides = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      overrides.set(data.character, {
        strokes: data.strokes,
        medians: data.medians,
      });
    } catch {
      // skip
    }
  }
  return overrides;
}

export async function loadAnimCjkEntry(char) {
  const text = await fetch('https://raw.githubusercontent.com/parsimonhi/animCJK/master/graphicsJa.txt').then((r) => r.text());
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      if (data.character === char) {
        return { strokes: data.strokes, medians: data.medians };
      }
    } catch {
      // skip
    }
  }
  return null;
}

/** 縄: 中国式いとへんを subAnimJ「組」の日本式いとへんに差し替え */
export async function fixNawaStrokeData(subAnimJ) {
  const kumi = subAnimJ.get('組');
  const nawa = await loadAnimCjkEntry('縄');
  if (!kumi || !nawa || kumi.strokes.length < 6 || nawa.strokes.length < 7) {
    throw new Error('縄 fix: missing 組 or 縄 source data');
  }
  return {
    strokes: [...kumi.strokes.slice(0, 6), ...nawa.strokes.slice(6)],
    medians: [...kumi.medians.slice(0, 6), ...nawa.medians.slice(6)],
  };
}
