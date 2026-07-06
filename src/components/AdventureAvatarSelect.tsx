import { useState } from 'react';
import type { AvatarLevel } from '../data/characterAssets';
import {
  getMaxUnlockedAvatarLevel,
  resolveAvatarLevel,
  TITLES,
  type PlayerProgress,
} from '../data/progress';
import { getAvatarTitle, PlayerAvatar } from './PlayerAvatar';

interface AdventureAvatarSelectProps {
  progress: PlayerProgress;
  onBack: () => void;
  onConfirm: (level: AvatarLevel) => void;
}

const ALL_LEVELS: AvatarLevel[] = TITLES.map((t) => t.minLevel as AvatarLevel);

export function AdventureAvatarSelect({ progress, onBack, onConfirm }: AdventureAvatarSelectProps) {
  const maxUnlocked = getMaxUnlockedAvatarLevel(progress.level);
  const unlockedLevels = ALL_LEVELS.filter((lv) => lv <= maxUnlocked);
  const [selected, setSelected] = useState<AvatarLevel>(resolveAvatarLevel(progress));

  return (
    <div className="game-screen adventure-screen">
      <header className="game-header compact">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>🚶 アバターたんけん</h2>
      </header>

      <div className="adventure-avatar-select-card">
        <p className="adventure-avatar-select-lead">たんけんにいくキャラを選（えら）んでね！</p>
        <p className="adventure-avatar-select-hint">獲得（かくとく）したアバターだけ選（えら）べるよ</p>

        <div className="adventure-avatar-select-grid">
          {unlockedLevels.map((lv) => {
            const isSelected = lv === selected;
            const label = getAvatarTitle(lv);

            return (
              <button
                key={lv}
                type="button"
                className={`adventure-avatar-select-item ${isSelected ? 'adventure-avatar-select-item--selected' : ''}`}
                onClick={() => setSelected(lv)}
                aria-pressed={isSelected}
              >
                <PlayerAvatar level={lv} size="picker" />
                <span className="adventure-avatar-select-label">{label.replace('レベル', '')}</span>
                {isSelected && <span className="adventure-avatar-select-check" aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn-primary adventure-avatar-select-confirm"
          onClick={() => onConfirm(selected)}
        >
          このキャラでたんけん！
        </button>
      </div>
    </div>
  );
}
