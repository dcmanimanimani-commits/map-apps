import { getTitleLevel, TITLES } from '../data/progress';
import { AVATAR_IMAGES, type AvatarLevel } from '../data/characterAssets';

export type { AvatarLevel };

interface PlayerAvatarProps {
  level?: AvatarLevel;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function resolveLevel(level?: AvatarLevel, title?: string): AvatarLevel {
  if (level) return level;
  if (title) return getTitleLevel(title) as AvatarLevel;
  return 1;
}

function sizePx(size: 'sm' | 'md' | 'lg'): number {
  if (size === 'lg') return 96;
  if (size === 'sm') return 48;
  return 72;
}

export function PlayerAvatar({ level, title, size = 'md', className = '' }: PlayerAvatarProps) {
  const lv = resolveLevel(level, title);
  const px = sizePx(size);

  return (
    <div
      className={`player-avatar player-avatar-lv${lv} ${className}`.trim()}
      style={{ width: px, height: px }}
      aria-hidden
    >
      <img
        src={AVATAR_IMAGES[lv]}
        alt=""
        className="player-avatar-img"
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export function getAvatarTitle(level: AvatarLevel): string {
  return TITLES.find((t) => t.minLevel === level)?.title ?? TITLES[0].title;
}
