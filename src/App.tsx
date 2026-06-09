import { useState } from 'react';
import { useJapanGeo } from './hooks/useJapanGeo';
import { WhereGame } from './components/WhereGame';
import { LandmarkGame } from './components/LandmarkGame';
import { KanjiGame } from './components/KanjiGame';
import { ExploreMode } from './components/ExploreMode';
import './App.css';

type Screen = 'home' | 'where' | 'landmark' | 'kanji' | 'explore';

const modes = [
  {
    id: 'where' as const,
    emoji: '🗾',
    title: 'どこかな？',
    desc: '漢字の県名を読んで、地図で場所をタップ！',
    color: '#4F9CF9',
  },
  {
    id: 'landmark' as const,
    emoji: '🍜',
    title: '名物クイズ',
    desc: '名物・名所から都道府県を当てよう！',
    color: '#FF6B6B',
  },
  {
    id: 'kanji' as const,
    emoji: '✏️',
    title: '漢字チャレンジ',
    desc: 'ひらがなから漢字の県名を選ぼう！',
    color: '#9B5DE5',
  },
  {
    id: 'explore' as const,
    emoji: '🔍',
    title: '地図でべんきょう',
    desc: '地図を自由にタップして、じっくり覚えよう',
    color: '#06D6A0',
  },
];

function App() {
  const { geo, loading, error } = useJapanGeo();
  const [screen, setScreen] = useState<Screen>('home');

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

  if (screen === 'where') return <WhereGame geo={geo} onBack={() => setScreen('home')} />;
  if (screen === 'landmark') return <LandmarkGame geo={geo} onBack={() => setScreen('home')} />;
  if (screen === 'kanji') return <KanjiGame onBack={() => setScreen('home')} />;
  if (screen === 'explore') return <ExploreMode geo={geo} onBack={() => setScreen('home')} />;

  return (
    <div className="app home">
      <header className="hero">
        <div className="hero-badge">🎮 小学生むけ</div>
        <h1 className="hero-title">
          <span className="title-emoji">🗾</span>
          にほんちず
          <br />
          たんけんアプリ
        </h1>
        <p className="hero-subtitle">
          あそびながら、47都道府県の場所・名物・漢字をマスターしよう！
        </p>
      </header>

      <main className="mode-grid">
        {modes.map((mode) => (
          <button
            key={mode.id}
            className="mode-card"
            style={{ '--card-color': mode.color } as React.CSSProperties}
            onClick={() => setScreen(mode.id)}
          >
            <span className="mode-emoji">{mode.emoji}</span>
            <span className="mode-title">{mode.title}</span>
            <span className="mode-desc">{mode.desc}</span>
          </button>
        ))}
      </main>

      <footer className="home-footer">
        <p>💡 ヒント：まず「地図でべんきょう」で慣れてから、クイズにちょうせん！</p>
      </footer>
    </div>
  );
}

export default App;
