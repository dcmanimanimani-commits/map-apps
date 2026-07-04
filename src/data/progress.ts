import type { AvatarLevel } from './characterAssets';
import { getProgressKey } from './regions';
import { getActiveProgress, saveActiveProgress } from './players';

export interface PlayerProgress {
  level: number;
  xp: number;
  masteredRegions: string[];
  title: string;
  /** 表示中のアバター（獲得済み称号の範囲内で自由選択） */
  avatarLevel?: AvatarLevel;
}

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

export function getTitleLevel(title: string): number {
  return TITLES.find((t) => t.title === title)?.minLevel ?? 1;
}

export function getMaxUnlockedAvatarLevel(level: number): AvatarLevel {
  return Math.min(Math.max(1, level), 8) as AvatarLevel;
}

export function resolveAvatarLevel(progress: PlayerProgress): AvatarLevel {
  const maxUnlocked = getMaxUnlockedAvatarLevel(progress.level);
  const fallback = getTitleLevel(progress.title) as AvatarLevel;
  const selected = progress.avatarLevel ?? fallback;
  return Math.min(Math.max(1, selected), maxUnlocked) as AvatarLevel;
}

export function setSelectedAvatar(avatarLevel: AvatarLevel): PlayerProgress {
  const progress = loadProgress();
  const maxUnlocked = getMaxUnlockedAvatarLevel(progress.level);
  if (avatarLevel > maxUnlocked) return progress;

  const updated: PlayerProgress = { ...progress, avatarLevel };
  saveActiveProgress(updated);
  return updated;
}

/** 旧データ形式のマイグレーション（純粋関数） */
export function migrateProgress(progress: PlayerProgress): PlayerProgress {
  let migrated = { ...progress };

  if (migrated.masteredRegions.includes('okinawa') && !migrated.masteredRegions.includes('kyushu')) {
    migrated = {
      ...migrated,
      masteredRegions: [
        ...migrated.masteredRegions.filter((k) => k !== 'okinawa'),
        'kyushu',
      ],
    };
  }

  const chubuSubs = ['chubu:hokuriku', 'chubu:koshinetsu', 'chubu:tokai'];
  const hasAllChubuSubs = chubuSubs.every((k) => migrated.masteredRegions.includes(k));
  const hasChubuSubs = migrated.masteredRegions.some((k) => chubuSubs.includes(k));

  if (hasChubuSubs || hasAllChubuSubs) {
    let masteredRegions = migrated.masteredRegions.filter((k) => !chubuSubs.includes(k));
    if (hasAllChubuSubs && !masteredRegions.includes('chubu')) {
      masteredRegions = [...masteredRegions, 'chubu'];
    }
    migrated = { ...migrated, masteredRegions };
  }

  const maxUnlocked = getMaxUnlockedAvatarLevel(migrated.level);
  let avatarLevel = migrated.avatarLevel ?? (getTitleLevel(migrated.title) as AvatarLevel);
  avatarLevel = Math.min(Math.max(1, avatarLevel), maxUnlocked) as AvatarLevel;

  return { ...migrated, avatarLevel };
}

export function loadProgress(): PlayerProgress {
  const progress = migrateProgress(getActiveProgress());
  const title = getTitleForLevel(progress.level);
  if (progress.title !== title) {
    const updated = { ...progress, title };
    saveActiveProgress(updated);
    return updated;
  }
  return progress;
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

  const avatarLevel = resolveAvatarLevel({ ...progress, level, xp, masteredRegions, title });
  const updated: PlayerProgress = { level, xp, masteredRegions, title, avatarLevel };
  saveActiveProgress(updated);
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
