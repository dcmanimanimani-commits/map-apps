import { useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { prefectureByKanji } from '../data/prefectures';
import { getLandmarkSpots } from '../data/landmarkDetails';
import { JapanMap } from './JapanMap';

interface ExploreModeProps {
  geo: JapanGeoJSON;
  onBack: () => void;
}

export function ExploreMode({ geo, onBack }: ExploreModeProps) {
  const [selectedKanji, setSelectedKanji] = useState<string | null>(null);
  const selected = selectedKanji ? prefectureByKanji.get(selectedKanji) : null;
  const spots = selected ? getLandmarkSpots(selected.kanji) : [];

  return (
    <div className="game-screen explore-screen">
      <header className="game-header">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>🔍 地図でべんきょう</h2>
        <p className="game-desc">地図をタップして、都道府県の名前と名物・名所を覚えよう！</p>
      </header>

      <div className="explore-layout game-play-area">
        <div className="map-container explore-map">
          <JapanMap
            geo={geo}
            highlightedKanji={selectedKanji}
            onPrefectureClick={setSelectedKanji}
          />
        </div>

        <div className="info-panel game-sidebar explore-sidebar">
          {selected ? (
            <div className="prefecture-info explore-info">
              <div className="info-header">
                <span className="info-emoji">{selected.landmarkEmoji}</span>
                <div>
                  <h3 className="info-kanji">{selected.kanji}</h3>
                  <p className="info-hiragana">{selected.hiragana}</p>
                </div>
              </div>
              <dl className="info-details">
                <div>
                  <dt>地方</dt>
                  <dd>{selected.region}</dd>
                </div>
              </dl>

              <div className="landmark-guide">
                <p className="landmark-guide-title">🍜 名物・名所をくわしく</p>
                <div className="landmark-cards">
                  {spots.map((spot) => (
                    <article key={spot.name} className="landmark-card">
                      <div className="landmark-card-header">
                        <span className="landmark-card-emoji">{spot.emoji}</span>
                        <h4 className="landmark-card-name">{spot.name}</h4>
                      </div>
                      <p className="landmark-card-desc">{spot.description}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="prefecture-info empty-info">
              <p>👆 地図の都道府県をタップしてね！</p>
              <p className="sub-text">名物・名所のくわしい話が読めるよ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
