import { useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { prefectureByKanji } from '../data/prefectures';
import { getLandmarkSpots } from '../data/landmarkDetails';
import { getLandmarkImage } from '../data/landmarkImages';
import { JapanMap } from './JapanMap';

interface ExploreModeProps {
  geo: JapanGeoJSON;
  onBack: () => void;
}

function spotKey(kanji: string, index: number) {
  return `${kanji}:${index}`;
}

export function ExploreMode({ geo, onBack }: ExploreModeProps) {
  const [selectedKanji, setSelectedKanji] = useState<string | null>(null);
  const [openPhotoKey, setOpenPhotoKey] = useState<string | null>(null);
  const selected = selectedKanji ? prefectureByKanji.get(selectedKanji) : null;
  const spots = selected ? getLandmarkSpots(selected.kanji) : [];

  const togglePhoto = (kanji: string, index: number) => {
    const key = spotKey(kanji, index);
    if (!getLandmarkImage(kanji, index)) return;
    setOpenPhotoKey((prev) => (prev === key ? null : key));
  };

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
            onPrefectureClick={(kanji) => {
              setSelectedKanji(kanji);
              setOpenPhotoKey(null);
            }}
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
                <p className="landmark-photo-hint">📷 タップすると写真が見られるよ</p>
                <div className="landmark-cards">
                  {spots.map((spot, index) => {
                    const key = spotKey(selected.kanji, index);
                    const imageSrc = getLandmarkImage(selected.kanji, index);
                    const isOpen = openPhotoKey === key;
                    const hasPhoto = Boolean(imageSrc);

                    return (
                      <article
                        key={spot.name}
                        className={`landmark-card ${hasPhoto ? 'landmark-card--clickable' : ''} ${isOpen ? 'landmark-card--open' : ''}`}
                      >
                        <button
                          type="button"
                          className="landmark-card-button"
                          onClick={() => togglePhoto(selected.kanji, index)}
                          disabled={!hasPhoto}
                          aria-expanded={isOpen}
                        >
                          <div className="landmark-card-header">
                            <span className="landmark-card-emoji">{spot.emoji}</span>
                            <h4 className="landmark-card-name">{spot.name}</h4>
                            {hasPhoto && (
                              <span className="landmark-card-photo-badge" aria-hidden>
                                {isOpen ? '▲' : '📷'}
                              </span>
                            )}
                          </div>
                          <p className="landmark-card-desc">{spot.description}</p>
                        </button>
                        {isOpen && imageSrc && (
                          <div className="landmark-photo-wrap">
                            <img
                              className="landmark-photo"
                              src={imageSrc}
                              alt={`${spot.name}の写真`}
                              loading="lazy"
                              decoding="async"
                            />
                            <p className="landmark-photo-credit">写真: Wikimedia Commons</p>
                          </div>
                        )}
                      </article>
                    );
                  })}
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
