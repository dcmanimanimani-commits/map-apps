import { getProgressKey } from './regions';

export interface PlayerProgress {
  level: number;
  xp: number;
  masteredRegions: string[];
  title: string;
}

const STORAGE_KEY = 'nihon-chizu-progress';

export const TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 1, title: '見習い探検家' },
  { minLevel: 2, title: '地図好きの旅人' },
  { minLevel: 3, title: '地方マスター見習い' },
  { minLevel: 4, title: '日本地図の勇者' },
  { minLevel: 5, title: '都道府県博士' },
  { minLevel: 6, title: '伝説の地図マスター' },
  { minLevel: 7, title: 'にほんちずの神' },
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
    if (raw) return JSON.parse(raw) as PlayerProgress;
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
    'hokkaido', 'tohoku', 'kanto',
    'chubu:hokuriku', 'chubu:koshinetsu', 'chubu:tokai',
    'kinki', 'chugoku', 'shikoku', 'kyushu', 'okinawa',
  ];
  return requiredKeys.every((k) => progress.masteredRegions.includes(k));
}
