import { useCallback, useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { getRandomPrefecture, type Prefecture } from '../data/prefectures';
import { JapanMap } from './JapanMap';
import { ScorePanel } from './ScorePanel';
import { FeedbackBanner } from './FeedbackBanner';

interface LandmarkGameProps {
  geo: JapanGeoJSON;
  onBack: () => void;
}

const GOAL = 10;

export function LandmarkGame({ geo, onBack }: LandmarkGameProps) {
  const [target, setTarget] = useState<Prefecture>(() => getRandomPrefecture());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: '名物がある都道府県をタップ！',
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
    setFeedback({ message: '名物がある都道府県をタップ！', type: 'info' });
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
        message: `🎉 せいかい！${target.kanji}の名物だね！`,
        type: 'success',
      });
    } else {
      setStreak(0);
      setWrongKanji(kanji);
      setCorrectKanji(target.kanji);
      setFeedback({
        message: `💪 ${target.landmarkEmoji} は「${target.kanji}」の名物だよ！`,
        type: 'error',
      });
    }

    const newAnswered = answered + 1;
    setAnswered(newAnswered);

    setTimeout(() => {
      if (newAnswered < GOAL) nextQuestion(target);
    }, 1500);
  };

  const finished = answered >= GOAL;

  return (
    <div className="game-screen">
      <header className="game-header">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>🍜 名物クイズ</h2>
        <p className="game-desc">名物・名所がある都道府県を地図で見つけよう！</p>
      </header>

      <div className="game-play-area">
        <div className="game-sidebar">
          <ScorePanel score={score} streak={streak} total={GOAL} />

          <div className="question-card landmark-card">
            <p className="question-label">この名物・名所はどこの県？</p>
            <div className="landmark-display">
              <span className="landmark-emoji">{target.landmarkEmoji}</span>
              <span className="landmark-name">{target.landmark}</span>
            </div>
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
