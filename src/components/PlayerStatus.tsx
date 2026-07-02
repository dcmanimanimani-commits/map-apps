import { loadProgress } from '../data/progress';

export function PlayerStatus() {
  const progress = loadProgress();
  const xpInLevel = progress.xp % 100;

  return (
    <div className="player-status">
      <div className="player-level">
        <span className="level-badge">Lv.{progress.level}</span>
        <span className="player-title">{progress.title}</span>
      </div>
      <div className="xp-bar-wrap">
        <div className="xp-bar" style={{ width: `${xpInLevel}%` }} />
      </div>
      <p className="xp-text">⭐ {progress.masteredRegions.length}地方マスター</p>
    </div>
  );
}
