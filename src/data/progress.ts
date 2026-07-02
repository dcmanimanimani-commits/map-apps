import { getProgressKey } from './regions';

export interface PlayerProgress {
  level: number;
  xp: number;
  masteredRegions: string[];
  title: string;
}

const STORAGE_KEY = 'nihon-chizu-progress';

export const TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 1, title: 'うんぴくんレベル' },
  { minLevel: 2, title: 'だんごむしレベル' },
  { minLevel: 3, title: 'てんとうむしちゃんレベル' },
  { minLevel: 4, title: '赤ちゃんカタツムリレベル' },
  { minLevel: 5, title: 'ケガしたハムスターレベル' },
  { minLevel: 6, title: 'おばあちゃん猫レベル' },
  { minLevel: 7, title: 'むし歯だらけのライオンレベル' },
  { minLevel: 8, title: 'マッチョの象レベル' },
];

const XP_PER_REGION = 100;
const XP_PER_LEVEL = 100;

export function getTitleForLevel(level: number): string {
  const sorted = [...TITLES].sort((a, b) => b.minLevel - a.minLevel);
  return sorted.find((t) => level >= t.minLevel)?.title ?? TITLES[0].title;
}

export function loadProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      let progress = JSON.parse(raw) as PlayerProgress;
      let changed = false;

      if (progress.masteredRegions.includes('okinawa') && !progress.masteredRegions.includes('kyushu')) {
        progress = {
          ...progress,
          masteredRegions: [
            ...progress.masteredRegions.filter((k) => k !== 'okinawa'),
            'kyushu',
          ],
        };
        changed = true;
      }

      const chubuSubs = ['chubu:hokuriku', 'chubu:koshinetsu', 'chubu:tokai'];
      const hasAllChubuSubs = chubuSubs.every((k) => progress.masteredRegions.includes(k));
      const hasChubuSubs = progress.masteredRegions.some((k) => chubuSubs.includes(k));

      if (hasChubuSubs || hasAllChubuSubs) {
        let masteredRegions = progress.masteredRegions.filter((k) => !chubuSubs.includes(k));
        if (hasAllChubuSubs && !masteredRegions.includes('chubu')) {
          masteredRegions = [...masteredRegions, 'chubu'];
        }
        progress = { ...progress, masteredRegions };
        changed = true;
      }

      if (changed) {
        saveProgress(progress);
      }

      const title = getTitleForLevel(progress.level);
      if (progress.title !== title) {
        progress = { ...progress, title };
        saveProgress(progress);
      }

      return progress;
    }
  } catch {
    /* ignore */
  }
  return { level: 1, xp: 0, masteredRegions: [], title: TITLES[0].title };
}

export function saveProgress(progress: PlayerProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function isRegionMastered(regionId: string, subRegionId?: string): boolean {
  const key = getProgressKey(regionId, subRegionId);
  return loadProgress().masteredRegions.includes(key);
}

export function getMasteredCount(): number {
  return loadProgress().masteredRegions.length;
}

export function masterRegion(regionId: string, subRegionId?: string): PlayerProgress {
  const key = getProgressKey(regionId, subRegionId);
  const progress = loadProgress();
  if (progress.masteredRegions.includes(key)) return progress;

  const masteredRegions = [...progress.masteredRegions, key];
  const xp = progress.xp + XP_PER_REGION;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const title = getTitleForLevel(level);

  const updated: PlayerProgress = { level, xp, masteredRegions, title };
  saveProgress(updated);
  return updated;
}

export function areAllRegionsMastered(): boolean {
  const progress = loadProgress();
  const requiredKeys = [
    'hokkaido', 'tohoku', 'kanto', 'chubu',
    'kinki', 'chugoku', 'shikoku', 'kyushu',
  ];
  return requiredKeys.every((k) => progress.masteredRegions.includes(k));
}
