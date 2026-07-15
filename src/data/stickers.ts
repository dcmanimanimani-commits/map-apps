export type StickerStyle = 'cute' | 'cool';

export interface StickerDef {
  id: string;
  slot: number;
  name: string;
  style: StickerStyle;
  image: string;
}

/** シール帳1ページ（5×5=25マス） */
export const STICKERS_PER_PAGE = 25;
export const REWARD_MILESTONES = [5, 10, 15, 20, 25] as const;

const stickerMeta: Omit<StickerDef, 'slot' | 'image'>[] = [
  { id: '01', name: 'じゃがいもくま', style: 'cute' },
  { id: '02', name: 'りんごナイト', style: 'cool' },
  { id: '03', name: 'タワーガード', style: 'cool' },
  { id: '04', name: 'アルプス', style: 'cool' },
  { id: '05', name: 'たこやき', style: 'cute' },
  { id: '06', name: 'ももちゃん', style: 'cute' },
  { id: '07', name: 'うどんサムライ', style: 'cool' },
  { id: '08', name: 'さくらじま', style: 'cool' },
  { id: '09', name: 'ねこパトロール', style: 'cute' },
  { id: '10', name: 'ドラゴン', style: 'cool' },
  { id: '11', name: 'うさぎ星', style: 'cute' },
  { id: '12', name: 'ロケット', style: 'cool' },
  { id: '13', name: 'ぱんだ', style: 'cute' },
  { id: '14', name: 'サメ', style: 'cool' },
  { id: '15', name: 'ちょうちょ', style: 'cute' },
  { id: '16', name: 'かめん', style: 'cool' },
  { id: '17', name: 'ほし', style: 'cute' },
  { id: '18', name: 'ライオン', style: 'cool' },
  { id: '19', name: 'アイス', style: 'cute' },
  { id: '20', name: 'サンダー', style: 'cool' },
  { id: '21', name: 'ふくろう', style: 'cute' },
  { id: '22', name: 'コンパス', style: 'cool' },
  { id: '23', name: 'くまちゃん', style: 'cute' },
  { id: '24', name: 'シールド', style: 'cool' },
  { id: '25', name: 'にじ', style: 'cute' },
];

export const STICKER_CATALOG: StickerDef[] = stickerMeta.map((item, index) => ({
  ...item,
  slot: index + 1,
  image: `/stickers/sticker-${item.id}.svg`,
}));

export function getStickerById(id: string): StickerDef | undefined {
  return STICKER_CATALOG.find((s) => s.id === id);
}

/** ごほうびスタンプが重なるマス（5・10・15・20・25枚目） */
export function isRewardMilestoneSlot(slot: number): boolean {
  return slot % 5 === 0;
}

export function getStickerForPageSlot(slot: number): StickerDef | undefined {
  return STICKER_CATALOG.find((s) => s.slot === slot);
}

/** 獲得順に左上→右→次の行…。次に貼るシール（カタログ順） */
export function getNextSticker(earnedIds: string[]): StickerDef | undefined {
  if (earnedIds.length >= STICKERS_PER_PAGE) return undefined;
  return STICKER_CATALOG[earnedIds.length];
}

/** 過去データがあっても「枚数ぶん左から順」に並べ直す */
export function normalizeEarnedStickerIds(earnedIds: string[]): string[] {
  const count = Math.min(earnedIds.length, STICKERS_PER_PAGE);
  return STICKER_CATALOG.slice(0, count).map((s) => s.id);
}

export function earnedCount(stickerIds: string[]): number {
  return stickerIds.length;
}

export function hasRewardMilestone(stickerIds: string[], milestone: number): boolean {
  return earnedCount(stickerIds) >= milestone;
}
