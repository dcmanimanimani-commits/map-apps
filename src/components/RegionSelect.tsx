import { useState } from 'react';
import { studyRegions, getStudyRegion } from '../data/regions';
import { isRegionMastered } from '../data/progress';
import { PlayerStatus } from './PlayerStatus';

interface RegionSelectProps {
  onBack: () => void;
  onSelect: (regionId: string, subRegionId?: string) => void;
}

export function RegionSelect({ onBack, onSelect }: RegionSelectProps) {
  const [expandedChubu, setExpandedChubu] = useState(false);

  function isMastered(regionId: string, subId?: string): boolean {
    if (regionId === 'chubu' && !subId) {
      const chubu = getStudyRegion('chubu');
      return chubu?.subRegions?.every((s) => isRegionMastered('chubu', s.id)) ?? false;
    }
    return isRegionMastered(regionId, subId);
  }

  return (
    <div className="game-screen region-select-screen">
      <header className="game-header compact">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>🗾 地方べんきょう</h2>
      </header>

      <PlayerStatus />

      <p className="region-intro">まず地方ごとに都道府県を覚えよう！全部マスターしたらクイズが解放されるよ</p>

      <div className="region-grid">
        {studyRegions.map((region) => {
          const mastered = isMastered(region.id);
          const isChubu = region.id === 'chubu';

          if (isChubu) {
            return (
              <div key={region.id} className="region-chubu-block">
                <button
                  className={`region-card ${mastered ? 'mastered' : ''}`}
                  style={{ '--region-color': region.color } as React.CSSProperties}
                  onClick={() => setExpandedChubu(!expandedChubu)}
                >
                  <span className="region-emoji">{region.emoji}</span>
                  <span className="region-name">{region.name}</span>
                  {mastered && <span className="master-badge">✅</span>}
                  <span className="region-expand">{expandedChubu ? '▲' : '▼'}</span>
                </button>
                {expandedChubu && region.subRegions && (
                  <div className="subregion-grid">
                    {region.subRegions.map((sub) => (
                      <button
                        key={sub.id}
                        className={`subregion-card ${isRegionMastered('chubu', sub.id) ? 'mastered' : ''}`}
                        onClick={() => onSelect('chubu', sub.id)}
                      >
                        <span>{sub.emoji}</span>
                        <span>{sub.name}</span>
                        {isRegionMastered('chubu', sub.id) && <span>✅</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

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
