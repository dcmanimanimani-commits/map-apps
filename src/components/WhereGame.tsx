import { useCallback, useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { getRandomPrefecture, type Prefecture } from '../data/prefectures';
import { JapanMap } from './JapanMap';
import { ScorePanel } from './ScorePanel';
import { FeedbackBanner } from './FeedbackBanner';

interface WhereGameProps {
  geo: JapanGeoJSON;
  onBack: () => void;
}

const GOAL = 10;

export function WhereGame({ geo, onBack }: WhereGameProps) {
  const [target, setTarget] = useState<Prefecture>(() => getRandomPrefecture());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: '地図をタップしてね！',
    type: 'info',
  });
  const [correctKanji, setCorrectKanji] = useState<string | null>(null);
  const [wrongKanji, setWrongKanji] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const nextQuestion = useCallback((last?: Prefecture) => {
    setTarget(getRandomPrefecture(last));
    setCorrectKanji(null);
    setWrongKanji(null);
    setLocked(false);
    setFeedback({ message: '地図をタップしてね！', type: 'info' });
  }, []);

  const handleClick = (kanji: string) => {
    if (locked) return;
    setLocked(true);

    if (kanji === target.kanji) {
      const newStreak = streak + 1;
      const bonus = newStreak >= 3 ? 2 : 0;
      setScore((s) => s + 10 + bonus);
      setStreak(newStreak);
      setCorrectKanji(kanji);
      setFeedback({
        message: bonus > 0 ? `🎉 せいかい！れんぞくボーナス +${bonus}！` : '🎉 せいかい！すごい！',
        type: 'success',
      });
    } else {
      setStreak(0);
      setWrongKanji(kanji);
      setCorrectKanji(target.kanji);
      setFeedback({
        message: `💪 おしい！せいかいは「${target.kanji}」だよ`,
        type: 'error',
      });
    }

    const newAnswered = answered + 1;
    setAnswered(newAnswered);

    setTimeout(() => {
      if (newAnswered >= GOAL) {
        setFeedback({
          message: `🏆 クリア！スコア ${score + (kanji === target.kanji ? 10 + (streak >= 2 ? 2 : 0) : 0)} てん！`,
          type: 'success',
        });
      } else {
        nextQuestion(target);
      }
    }, 1500);
  };

  const finished = answered >= GOAL;

  return (
    <div className="game-screen">
      <header className="game-header">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>🗾 どこかな？</h2>
        <p className="game-desc">漢字の都道府県名を読んで、地図の場所をタップ！</p>
      </header>

      <div className="game-play-area">
        <div className="game-sidebar">
          <ScorePanel score={score} streak={streak} total={GOAL} label="もくひょう" />

          <div className="question-card">
            <p className="question-label">この都道府県はどこ？</p>
            <div className="kanji-display">
              <span className="big-kanji">{target.kanji}</span>
              <span className="hiragana-hint">（{target.hiragana}）</span>
            </div>
            <p className="region-hint">📍 地方：{target.region}</p>
          </div>

          <FeedbackBanner message={feedback.message} type={feedback.type} />
        </div>

        <div className="map-container">
          <JapanMap
            geo={geo}
            onPrefectureClick={handleClick}
            correctKanji={correctKanji}
            wrongKanji={wrongKanji}
            interactive={!locked && !finished}
          />
        </div>
      </div>

      {finished && (
        <div className="finish-actions">
          <button className="btn-primary" onClick={() => {
            setScore(0);
            setStreak(0);
            setAnswered(0);
            nextQuestion();
          }}>
            もういちどちょうせん
          </button>
          <button className="btn-secondary" onClick={onBack}>ホームへ</button>
        </div>
      )}
    </div>
  );
}
