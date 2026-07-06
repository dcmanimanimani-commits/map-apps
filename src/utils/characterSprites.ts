import { AVATAR_IMAGES, BOSS_IMAGE, type AvatarLevel } from '../data/characterAssets';

export type CharDirection = 'up' | 'right' | 'down' | 'left';
export type CharStep = 'idle' | 'rightFoot' | 'leftFoot';

/** 1キャラ16枚 = 4方向 × 4コマ（idle + walk1〜3） */
export type AvatarSpriteFrame = 'idle' | 'walk1' | 'walk2' | 'walk3';

export const AVATAR_DIRECTIONS: CharDirection[] = ['up', 'right', 'down', 'left'];
export const AVATAR_SPRITE_FRAMES: AvatarSpriteFrame[] = ['idle', 'walk1', 'walk2', 'walk3'];

const SPRITE_ROOT = '/characters/sprites';

export function charStepToSpriteFrame(_level: AvatarLevel, step: CharStep): AvatarSpriteFrame {
  if (step === 'idle') return 'idle';
  if (step === 'rightFoot') return 'walk1';
  return 'walk2';
}

/** 透過WebP/PNGを置くパス（例: /characters/sprites/avatar-3/down-walk1.webp） */
export function getAvatarSpritePath(
  level: AvatarLevel,
  dir: CharDirection,
  step: CharStep,
): string {
  const frame = charStepToSpriteFrame(level, step);
  return `${SPRITE_ROOT}/avatar-${level}/${dir}-${frame}.webp`;
}

/** 16枚スプライトが未配置のときのフォールバック（単体画像） */
export function getAvatarFallbackSrc(level: AvatarLevel): string {
  return AVATAR_IMAGES[level];
}

export function getAvatarSpriteSrc(level: AvatarLevel, dir: CharDirection, step: CharStep): string {
  return getAvatarSpritePath(level, dir, step);
}

export function getOniSpriteSrc(_dir: CharDirection, _step: CharStep): string {
  return BOSS_IMAGE;
}

export function directionFromVector(dx: number, dy: number): CharDirection {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}
