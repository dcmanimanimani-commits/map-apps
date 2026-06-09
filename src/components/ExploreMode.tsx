import { useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { prefectureByKanji, prefectures } from '../data/prefectures';
import { JapanMap } from './JapanMap';

interface ExploreModeProps {
  geo: JapanGeoJSON;
  onBack: () => void;
}

export function ExploreMode({ geo, onBack }: ExploreModeProps) {
  const [selectedKanji, setSelectedKanji] = useState<string | null>(null);
  const selected = selectedKanji ? prefectureByKanji.get(selectedKanji) : null;

  return (
    <div className="game-screen explore-screen">
      <header className="game-header">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>🔍 地図でべんきょう</h2>
        <p className="game-desc">地図をタップして、都道府県の名前・名物・漢字を覚えよう！</p>
      </header>

      <div className="explore-layout game-play-area">
        <div className="map-container explore-map">
          <JapanMap
            geo={geo}
            highlightedKanji={selectedKanji}
            onPrefectureClick={setSelectedKanji}
          />
        </div>

        <div className="info-panel game-sidebar">
          {selected ? (
            <div className="prefecture-info">
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
                <div>
                  <dt>名物・名所</dt>
                  <dd>{selected.landmark}</dd>
                </div>
              </dl>
              <div className="kanji-breakdown">
                <p className="breakdown-title">📝 漢字のポイント</p>
                <p className="breakdown-text">
                  「{selected.kanji}」を書いてみよう！
                  読み方は「{selected.hiragana}」だよ。
                </p>
              </div>
            </div>
          ) : (
            <div className="prefecture-info empty-info">
              <p>👆 地図の都道府県をタップしてね！</p>
              <p className="sub-text">47都道府県ぜんぶあるよ</p>
            </div>
          )}

          <div className="prefecture-list">
            <p className="list-title">📋 都道府県いちらん</p>
            <div className="list-grid">
              {prefectures.map((p) => (
                <button
                  key={p.id}
                  className={`list-item ${selectedKanji === p.kanji ? 'active' : ''}`}
                  onClick={() => setSelectedKanji(p.kanji)}
                >
                  <span>{p.landmarkEmoji}</span>
                  <span>{p.kanji.replace(/[都道府県]/g, '')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
