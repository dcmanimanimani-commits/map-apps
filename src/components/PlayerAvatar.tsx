import { getTitleLevel, TITLES } from '../data/progress';

export type AvatarLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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
      <svg viewBox="0 0 100 100" className="player-avatar-svg">
        {lv === 1 && <UnpiKun />}
        {lv === 2 && <Dangomushi />}
        {lv === 3 && <Tentomushi />}
        {lv === 4 && <BabySnail />}
        {lv === 5 && <InjuredHamster />}
        {lv === 6 && <GrandmaCat />}
        {lv === 7 && <ToothlessLion />}
        {lv === 8 && <MachoElephant />}
      </svg>
    </div>
  );
}

export function getAvatarTitle(level: AvatarLevel): string {
  return TITLES.find((t) => t.minLevel === level)?.title ?? TITLES[0].title;
}

function UnpiKun() {
  return (
    <>
      <ellipse cx="50" cy="58" rx="28" ry="22" fill="#8B5A2B" />
      <ellipse cx="50" cy="52" rx="24" ry="18" fill="#A0622D" />
      <circle cx="40" cy="48" r="4" fill="#fff" />
      <circle cx="60" cy="48" r="4" fill="#fff" />
      <circle cx="41" cy="48" r="2" fill="#1e293b" />
      <circle cx="61" cy="48" r="2" fill="#1e293b" />
      <path d="M44 58 Q50 64 56 58" stroke="#5c3d1e" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="35" cy="42" rx="6" ry="4" fill="#F472B6" opacity="0.5" />
      <ellipse cx="65" cy="42" rx="6" ry="4" fill="#F472B6" opacity="0.5" />
    </>
  );
}

function Dangomushi() {
  return (
    <>
      <ellipse cx="50" cy="55" rx="32" ry="24" fill="#6B4F3A" />
      <ellipse cx="50" cy="52" rx="28" ry="20" fill="#8B6914" />
      <path d="M30 50 Q50 30 70 50" stroke="#5c3d1e" strokeWidth="3" fill="none" />
      <circle cx="38" cy="48" r="3" fill="#1e293b" />
      <circle cx="62" cy="48" r="3" fill="#1e293b" />
      <line x1="30" y1="55" x2="22" y2="58" stroke="#5c3d1e" strokeWidth="2" strokeLinecap="round" />
      <line x1="70" y1="55" x2="78" y2="58" stroke="#5c3d1e" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="62" x2="24" y2="68" stroke="#5c3d1e" strokeWidth="2" strokeLinecap="round" />
      <line x1="68" y1="62" x2="76" y2="68" stroke="#5c3d1e" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function Tentomushi() {
  return (
    <>
      <ellipse cx="50" cy="58" rx="30" ry="26" fill="#DC2626" />
      <circle cx="38" cy="48" r="8" fill="#1e293b" />
      <circle cx="62" cy="48" r="8" fill="#1e293b" />
      <circle cx="50" cy="62" r="6" fill="#1e293b" />
      <circle cx="36" cy="66" r="4" fill="#1e293b" />
      <circle cx="64" cy="66" r="4" fill="#1e293b" />
      <circle cx="42" cy="44" r="3" fill="#fff" />
      <circle cx="58" cy="44" r="3" fill="#fff" />
      <circle cx="42" cy="44" r="1.5" fill="#1e293b" />
      <circle cx="58" cy="44" r="1.5" fill="#1e293b" />
      <path d="M46 52 Q50 56 54 52" stroke="#fff" strokeWidth="1.5" fill="none" />
      <ellipse cx="30" cy="40" rx="8" ry="5" fill="#FDE047" opacity="0.8" transform="rotate(-30 30 40)" />
    </>
  );
}

function BabySnail() {
  return (
    <>
      <ellipse cx="55" cy="62" rx="22" ry="14" fill="#86EFAC" />
      <circle cx="38" cy="58" r="10" fill="#4ADE80" />
      <circle cx="35" cy="56" r="2.5" fill="#1e293b" />
      <circle cx="41" cy="56" r="2.5" fill="#1e293b" />
      <path d="M36 61 Q38 63 40 61" stroke="#166534" strokeWidth="1.2" fill="none" />
      <path d="M48 48 Q55 32 62 48 Q58 55 50 55 Q42 55 48 48" fill="#D97706" />
      <path d="M50 38 Q55 42 50 46 Q45 42 50 38" fill="#F59E0B" />
      <ellipse cx="50" cy="70" rx="3" ry="2" fill="#BBF7D0" />
    </>
  );
}

function InjuredHamster() {
  return (
    <>
      <circle cx="50" cy="55" r="26" fill="#FCD34D" />
      <circle cx="38" cy="42" r="8" fill="#FCD34D" />
      <circle cx="62" cy="42" r="8" fill="#FCD34D" />
      <ellipse cx="38" cy="44" rx="4" ry="5" fill="#F9A8D4" />
      <ellipse cx="62" cy="44" rx="4" ry="5" fill="#F9A8D4" />
      <circle cx="42" cy="52" r="3" fill="#1e293b" />
      <circle cx="58" cy="52" r="3" fill="#1e293b" />
      <ellipse cx="50" cy="60" rx="4" ry="3" fill="#F472B6" />
      <rect x="58" y="62" width="16" height="8" rx="2" fill="#fff" stroke="#94a3b8" strokeWidth="1" />
      <line x1="62" y1="64" x2="70" y2="68" stroke="#EF4444" strokeWidth="1" />
      <line x1="66" y1="64" x2="62" y2="68" stroke="#EF4444" strokeWidth="1" />
    </>
  );
}

function GrandmaCat() {
  return (
    <>
      <ellipse cx="50" cy="60" rx="28" ry="24" fill="#9CA3AF" />
      <polygon points="30,38 24,22 38,32" fill="#9CA3AF" />
      <polygon points="70,38 76,22 62,32" fill="#9CA3AF" />
      <circle cx="40" cy="52" r="4" fill="#1e293b" />
      <circle cx="60" cy="52" r="4" fill="#1e293b" />
      <ellipse cx="50" cy="60" rx="3" ry="2" fill="#F472B6" />
      <path d="M35 48 Q50 42 65 48" stroke="#6B7280" strokeWidth="2" fill="none" />
      <rect x="32" y="46" width="36" height="8" rx="3" fill="none" stroke="#374151" strokeWidth="2" />
      <line x1="38" y1="46" x2="38" y2="54" stroke="#374151" strokeWidth="1.5" />
      <line x1="62" y1="46" x2="62" y2="54" stroke="#374151" strokeWidth="1.5" />
      <path d="M30 68 Q50 78 70 68" stroke="#6B7280" strokeWidth="2" fill="none" />
    </>
  );
}

function ToothlessLion() {
  return (
    <>
      <circle cx="50" cy="52" r="30" fill="#F59E0B" />
      <circle cx="50" cy="55" r="22" fill="#FCD34D" />
      <circle cx="40" cy="50" r="4" fill="#1e293b" />
      <circle cx="60" cy="50" r="4" fill="#1e293b" />
      <ellipse cx="50" cy="58" rx="6" ry="4" fill="#F472B6" />
      <path d="M42 64 L44 72 M46 65 L47 73 M54 65 L53 73 M58 64 L56 72" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M44 66 Q50 70 56 66" stroke="#1e293b" strokeWidth="1.5" fill="none" />
      <circle cx="28" cy="48" r="5" fill="#F59E0B" />
      <circle cx="72" cy="48" r="5" fill="#F59E0B" />
      <circle cx="50" cy="28" r="5" fill="#F59E0B" />
    </>
  );
}

function MachoElephant() {
  return (
    <>
      <ellipse cx="50" cy="58" rx="30" ry="26" fill="#94A3B8" />
      <ellipse cx="50" cy="55" rx="22" ry="18" fill="#CBD5E1" />
      <circle cx="40" cy="50" r="3" fill="#1e293b" />
      <circle cx="60" cy="50" r="3" fill="#1e293b" />
      <path d="M50 58 Q46 72 38 78 Q42 76 50 68 Q58 76 62 78 Q54 72 50 58" fill="#94A3B8" />
      <ellipse cx="30" cy="62" rx="8" ry="12" fill="#94A3B8" />
      <ellipse cx="70" cy="62" rx="8" ry="12" fill="#94A3B8" />
      <rect x="28" y="48" width="44" height="6" rx="2" fill="#64748B" opacity="0.5" />
      <path d="M35 42 L38 32 M65 42 L62 32" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
      <text x="50" y="46" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#475569">💪</text>
    </>
  );
}
