import { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { resolveAvatarLevel } from '../data/progress';
import { AvatarPicker } from './AvatarPicker';
import { PlayerAvatar } from './PlayerAvatar';

interface PlayerStatusProps {
  onSwitchPlayer?: () => void;
}

export function PlayerStatus({ onSwitchPlayer }: PlayerStatusProps) {
  const { activePlayer, setAvatar } = usePlayer();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!activePlayer) return null;

  const { progress, name } = activePlayer;
  const xpInLevel = progress.xp % 100;
  const avatarLevel = resolveAvatarLevel(progress);

  return (
    <>
      <div className="player-status">
        <div className="player-status-top">
          <button
            type="button"
            className="player-avatar-btn"
            onClick={() => setPickerOpen(true)}
            aria-label="アバターを変更"
            title="アバターを変更"
          >
            <PlayerAvatar level={avatarLevel} size="md" />
          </button>
          <div className="player-status-info">
            <div className="player-level">
              <span className="level-badge">Lv.{progress.level}</span>
              <span className="player-name">{name}</span>
            </div>
            <span className="player-title">{progress.title}</span>
          </div>
          {onSwitchPlayer && (
            <button type="button" className="btn-switch-player" onClick={onSwitchPlayer} title="プレイヤー変更">
              交代
            </button>
          )}
        </div>
        <div className="xp-bar-wrap">
          <div className="xp-bar" style={{ width: `${xpInLevel}%` }} />
        </div>
        <p className="xp-text">⭐ {progress.masteredRegions.length}地方マスター</p>
      </div>

      <AvatarPicker
        open={pickerOpen}
        progress={progress}
        onClose={() => setPickerOpen(false)}
        onSelect={(level) => {
          setAvatar(level);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
