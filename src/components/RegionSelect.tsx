import { studyRegions } from '../data/regions';
import { isRegionMastered } from '../data/progress';
import { PlayerStatus } from './PlayerStatus';

interface RegionSelectProps {
  onBack: () => void;
  onSelect: (regionId: string) => void;
  onSwitchPlayer?: () => void;
}

export function RegionSelect({ onBack, onSelect, onSwitchPlayer }: RegionSelectProps) {
  return (
    <div className="game-screen region-select-screen">
      <header className="game-header compact">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>🗾 地方べんきょう</h2>
      </header>

      <PlayerStatus onSwitchPlayer={onSwitchPlayer} />

      <p className="region-intro">まず地方ごとに都道府県を覚えよう！全部マスターしたらクイズが解放されるよ</p>

      <div className="region-grid">
        {studyRegions.map((region) => {
          const mastered = isRegionMastered(region.id);

          return (
            <button
              key={region.id}
              className={`region-card ${mastered ? 'mastered' : ''}`}
              style={{ '--region-color': region.color } as React.CSSProperties}
              onClick={() => onSelect(region.id)}
            >
              <span className="region-emoji">{region.emoji}</span>
              <span className="region-name">{region.name}</span>
              {mastered && <span className="master-badge">✅</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
