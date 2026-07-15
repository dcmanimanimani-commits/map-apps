import { useState } from 'react';
import { useJapanGeo } from './hooks/useJapanGeo';
import { WhereGame } from './components/WhereGame';
import { LandmarkGame } from './components/LandmarkGame';
import { KanjiWriteGame } from './components/KanjiWriteGame';
import { ExploreMode } from './components/ExploreMode';
import { AvatarAdventureGame } from './components/AvatarAdventureGame';
import { RegionSelect } from './components/RegionSelect';
import { RegionStudy } from './components/RegionStudy';
import { PlayerStatus } from './components/PlayerStatus';
import { PlayerSelect } from './components/PlayerSelect';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { StickerBook } from './components/StickerBook';
import './App.css';

type Screen =
  | 'home'
  | 'sticker-book'
  | 'regions'
  | 'region-study'
  | 'where'
  | 'landmark'
  | 'kanji'
  | 'explore'
  | 'adventure';

const quizModes = [
  { id: 'where' as const, emoji: '🗾', title: 'どこかな？', desc: '漢字の県名を読んで、地図で場所をタップ！', color: '#4F9CF9' },
  { id: 'landmark' as const, emoji: '🍜', title: '名物クイズ', desc: '名物・名所から都道府県を当てよう！', color: '#FF6B6B' },
  { id: 'kanji' as const, emoji: '✏️', title: '漢字チャレンジ', desc: '指やペンで漢字を書いて覚えよう！', color: '#9B5DE5' },
  { id: 'adventure' as const, emoji: '🚶', title: 'アバターたんけん', desc: '地図を歩いて目的地へ！鬼に気をつけて', color: '#F59E0B' },
  { id: 'explore' as const, emoji: '🔍', title: '地図でべんきょう', desc: '地図を自由にタップして確認', color: '#06D6A0' },
];

function AppContent() {
  const { geo, loading, error } = useJapanGeo();
  const { activePlayer } = usePlayer();
  const [screen, setScreen] = useState<Screen>('home');
  const [studyRegion, setStudyRegion] = useState<string | null>(null);
  const [pickingPlayer, setPickingPlayer] = useState(() => !activePlayer);

  const openPlayerSelect = () => setPickingPlayer(true);

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

  if (pickingPlayer) {
    return (
      <PlayerSelect
        onReady={() => setPickingPlayer(false)}
        allowBack={Boolean(activePlayer)}
        onBack={() => setPickingPlayer(false)}
      />
    );
  }

  if (screen === 'sticker-book') {
    return <StickerBook onBack={() => setScreen('home')} />;
  }

  if (screen === 'regions') {
    return (
      <RegionSelect
        onBack={() => setScreen('home')}
        onSelect={(id) => {
          setStudyRegion(id);
          setScreen('region-study');
        }}
        onSwitchPlayer={openPlayerSelect}
      />
    );
  }

  if (screen === 'region-study' && studyRegion) {
    return (
      <RegionStudy
        geo={geo}
        regionId={studyRegion}
        onBack={() => setScreen('regions')}
        onMastered={() => setScreen('regions')}
        onSwitchPlayer={openPlayerSelect}
      />
    );
  }

  if (screen === 'where') return <WhereGame geo={geo} onBack={() => setScreen('home')} />;
  if (screen === 'landmark') return <LandmarkGame geo={geo} onBack={() => setScreen('home')} />;
  if (screen === 'kanji') return <KanjiWriteGame geo={geo} onBack={() => setScreen('home')} />;
  if (screen === 'explore') return <ExploreMode geo={geo} onBack={() => setScreen('home')} />;
  if (screen === 'adventure') return <AvatarAdventureGame geo={geo} onBack={() => setScreen('home')} />;

  return (
    <div className="app home compact-home">
      <header className="hero compact">
        <h1 className="hero-title sm">
          <span className="title-emoji sm">🗾</span>
          にほんちずたんけん
        </h1>
      </header>

      <PlayerStatus onSwitchPlayer={openPlayerSelect} />

      <button className="main-mode-card" onClick={() => setScreen('regions')}>
        <span className="main-mode-emoji">📚</span>
        <div>
          <span className="main-mode-title">地方べんきょう</span>
          <span className="main-mode-desc">まずここから！地方ごとに覚えよう</span>
        </div>
        <span className="main-mode-arrow">→</span>
      </button>

      <button className="main-mode-card sticker-book-card" onClick={() => setScreen('sticker-book')}>
        <span className="main-mode-emoji">📒</span>
        <div>
          <span className="main-mode-title">シール帳</span>
          <span className="main-mode-desc">地方べんきょうでシールをあつめよう</span>
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

function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}

export default App;
