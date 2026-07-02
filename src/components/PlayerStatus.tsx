import { usePlayer } from '../context/PlayerContext';
import { PlayerAvatar } from './PlayerAvatar';
import { getTitleLevel } from '../data/progress';

interface PlayerStatusProps {
  onSwitchPlayer?: () => void;
}

export function PlayerStatus({ onSwitchPlayer }: PlayerStatusProps) {
  const { activePlayer } = usePlayer();
  if (!activePlayer) return null;

  const { progress, name } = activePlayer;
  const xpInLevel = progress.xp % 100;
  const avatarLevel = getTitleLevel(progress.title) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

  return (
    <div className="player-status">
      <div className="player-status-top">
        <PlayerAvatar level={avatarLevel} size="sm" />
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
  );
}
