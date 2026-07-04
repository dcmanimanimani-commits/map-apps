import type { AvatarLevel } from '../data/characterAssets';
import {
  getMaxUnlockedAvatarLevel,
  resolveAvatarLevel,
  type PlayerProgress,
} from '../data/progress';
import { getAvatarTitle, PlayerAvatar } from './PlayerAvatar';

interface AvatarPickerProps {
  open: boolean;
  progress: PlayerProgress;
  onClose: () => void;
  onSelect: (level: AvatarLevel) => void;
}

const ALL_LEVELS: AvatarLevel[] = [1, 2, 3, 4, 5, 6, 7, 8];

export function AvatarPicker({ open, progress, onClose, onSelect }: AvatarPickerProps) {
  if (!open) return null;

  const selected = resolveAvatarLevel(progress);
  const maxUnlocked = getMaxUnlockedAvatarLevel(progress.level);

  return (
    <div className="avatar-picker-overlay" onClick={onClose} role="presentation">
      <div
        className="avatar-picker-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
      >
        <h2 id="avatar-picker-title" className="avatar-picker-title">
          アバターをえらぼう
        </h2>
        <p className="avatar-picker-hint">獲得（かくとく）した称号のアバターが使（つか）えるよ</p>

        <div className="avatar-picker-grid">
          {ALL_LEVELS.map((lv) => {
            const unlocked = lv <= maxUnlocked;
            const isSelected = lv === selected;
            const label = getAvatarTitle(lv);

            return (
              <button
                key={lv}
                type="button"
                className={`avatar-picker-item ${isSelected ? 'avatar-picker-item--selected' : ''} ${unlocked ? '' : 'avatar-picker-item--locked'}`}
                disabled={!unlocked}
                onClick={() => onSelect(lv)}
                aria-pressed={isSelected}
                aria-label={unlocked ? label : `${label}（まだ獲得していません）`}
              >
                <PlayerAvatar level={lv} size="picker" />
                <span className="avatar-picker-label">{label.replace('レベル', '')}</span>
                {!unlocked && <span className="avatar-picker-lock" aria-hidden>🔒</span>}
                {isSelected && unlocked && <span className="avatar-picker-check" aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>

        <button type="button" className="btn-secondary avatar-picker-close" onClick={onClose}>
          とじる
        </button>
      </div>
    </div>
  );
}
