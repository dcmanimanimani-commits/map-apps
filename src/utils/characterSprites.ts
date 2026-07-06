import { AVATAR_IMAGES, BOSS_IMAGE, type AvatarLevel } from '../data/characterAssets';

export type CharDirection = 'up' | 'right' | 'down' | 'left';
export type CharStep = 'idle' | 'rightFoot' | 'leftFoot';

/**
 * 16コマ構成: 4方向 ×（静止・右足前・左足前）
 * 将来 /characters/sprites/avatar-N/{dir}-{step}.webp を置けば差し替え可能。
 * 現状は単一WebP + CSSアニメで表現。
 */
export function getAvatarSpriteSrc(level: AvatarLevel, _dir: CharDirection, _step: CharStep): string {
  return AVATAR_IMAGES[level];
}

export function getOniSpriteSrc(_dir: CharDirection, _step: CharStep): string {
  return BOSS_IMAGE;
}

export function directionFromVector(dx: number, dy: number): CharDirection {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}
