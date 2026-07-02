import { useState } from 'react';
import { useJapanGeo } from './hooks/useJapanGeo';
import { WhereGame } from './components/WhereGame';
import { LandmarkGame } from './components/LandmarkGame';
import { KanjiWriteGame } from './components/KanjiWriteGame';
import { ExploreMode } from './components/ExploreMode';
import { RegionSelect } from './components/RegionSelect';
import { RegionStudy } from './components/RegionStudy';
import { PlayerStatus } from './components/PlayerStatus';
import './App.css';

type Screen =
  | 'home'
  | 'regions'
  | 'region-study'
  | 'where'
  | 'landmark'
  | 'kanji'
  | 'explore';

const quizModes = [
  { id: 'where' as const, emoji: '🗾', title: 'どこかな？', desc: '漢字の県名を読んで、地図で場所をタップ！', color: '#4F9CF9' },
  { id: 'landmark' as const, emoji: '🍜', title: '名物クイズ', desc: '名物・名所から都道府県を当てよう！', color: '#FF6B6B' },
  { id: 'kanji' as const, emoji: '✏️', title: '漢字チャレンジ', desc: '指やペンで漢字を書いて覚えよう！', color: '#9B5DE5' },
  { id: 'explore' as const, emoji: '🔍', title: '地図でべんきょう', desc: '地図を自由にタップして確認', color: '#06D6A0' },
];

function App() {
  const { geo, loading, error } = useJapanGeo();
  const [screen, setScreen] = useState<Screen>('home');
  const [studyRegion, setStudyRegion] = useState<{ id: string; sub?: string } | null>(null);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <span className="loading-emoji">🗾</span>
          <p>地図をよみこみ中...</p>
        </div>
      </div>
    );
  }

  if (error || !geo) {
    return (
      <div className="loading-screen error">
        <p>😢 {error ?? '地図データが読み込めませんでした'}</p>
      </div>
    );
  }

  if (screen === 'regions') {
    return (
      <RegionSelect
        onBack={() => setScreen('home')}
        onSelect={(id, sub) => {
          setStudyRegion({ id, sub });
          setScreen('region-study');
        }}
      />
    );
  }

  if (screen === 'region-study' && studyRegion) {
    return (
      <RegionStudy
        geo={geo}
        regionId={studyRegion.id}
        subRegionId={studyRegion.sub}
        onBack={() => setScreen('regions')}
        onMastered={() => setScreen('regions')}
      />
    );
  }

  if (screen === 'where') return <WhereGame geo={geo} onBack={() => setScreen('home')} />;
  if (screen === 'landmark') return <LandmarkGame geo={geo} onBack={() => setScreen('home')} />;
  if (screen === 'kanji') return <KanjiWriteGame onBack={() => setScreen('home')} />;
  if (screen === 'explore') return <ExploreMode geo={geo} onBack={() => setScreen('home')} />;

  return (
    <div className="app home compact-home">
      <header className="hero compact">
        <h1 className="hero-title sm">
          <span className="title-emoji sm">🗾</span>
          にほんちずたんけん
        </h1>
      </header>

      <PlayerStatus />

      <button className="main-mode-card" onClick={() => setScreen('regions')}>
        <span className="main-mode-emoji">📚</span>
        <div>
          <span className="main-mode-title">地方べんきょう</span>
          <span className="main-mode-desc">まずここから！地方ごとに覚えよう</span>
        </div>
        <span className="main-mode-arrow">→</span>
      </button>

      <section className="quiz-section">
        <h2 className="section-title">🎮 クイズモード</h2>
        <div className="mode-grid compact">
          {quizModes.map((mode) => (
            <button
              key={mode.id}
              className="mode-card sm"
              style={{ '--card-color': mode.color } as React.CSSProperties}
              onClick={() => setScreen(mode.id)}
            >
              <span className="mode-emoji sm">{mode.emoji}</span>
              <span className="mode-title sm">{mode.title}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
