import { landmarkSpotsByKanji } from './landmarkDetails';
import { prefectures } from './prefectures';

export interface KanjiBossQuestion {
  id: string;
  question: string;
  emoji: string;
  hint: string;
  answerKanji: string;
}

function spotLabel(name: string) {
  return name.replace(/（[^）]+）/g, '').trim();
}

function buildQuestion(prefKanji: string, spot: { name: string; emoji: string; description: string }): KanjiBossQuestion {
  const pref = prefectures.find((p) => p.kanji === prefKanji)!;
  const label = spotLabel(spot.name);
  const isProductionNo1 =
    spot.description.includes('でいちばん') ||
    spot.description.includes('日本（にほん）でいちばん');

  const question = isProductionNo1
    ? `${label}の生産量（せいさんりょう）が日本一（にほんいち）の県（けん）は？`
    : `${label}${spot.emoji} がある県（けん）は？`;

  return {
    id: `${prefKanji}:${label}`,
    question,
    emoji: spot.emoji,
    hint: pref.hiragana,
    answerKanji: pref.kanji,
  };
}

export function buildAllBossQuestions(): KanjiBossQuestion[] {
  const list: KanjiBossQuestion[] = [];
  for (const pref of prefectures) {
    for (const spot of landmarkSpotsByKanji[pref.kanji] ?? []) {
      list.push(buildQuestion(pref.kanji, spot));
    }
  }
  return list;
}

export function pickBossQuestions(count = 8): KanjiBossQuestion[] {
  const list = [...buildAllBossQuestions()];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, count);
}
