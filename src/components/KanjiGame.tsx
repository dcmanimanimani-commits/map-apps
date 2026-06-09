import { useCallback, useState } from 'react';
import {
  getRandomChoices,
  getRandomPrefecture,
  type Prefecture,
} from '../data/prefectures';
import { ScorePanel } from './ScorePanel';
import { FeedbackBanner } from './FeedbackBanner';

interface KanjiGameProps {
  onBack: () => void;
}

const GOAL = 10;

export function KanjiGame({ onBack }: KanjiGameProps) {
  const [target, setTarget] = useState<Prefecture>(() => getRandomPrefecture());
  const [choices, setChoices] = useState<Prefecture[]>(() => getRandomChoices(target));
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: 'ひらがなを読んで、漢字をえらんでね！',
    type: 'info',
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);

  const nextQuestion = useCallback((last?: Prefecture) => {
    const next = getRandomPrefecture(last);
    setTarget(next);
    setChoices(getRandomChoices(next));
    setSelectedId(null);
    setLocked(false);
    setFeedback({ message: 'ひらがなを読んで、漢字をえらんでね！', type: 'info' });
  }, []);

  const handleChoice = (pref: Prefecture) => {
    if (locked) return;
    setLocked(true);
    setSelectedId(pref.id);

    if (pref.id === target.id) {
      const newStreak = streak + 1;
      const bonus = newStreak >= 3 ? 2 : 0;
      setScore((s) => s + 10 + bonus);
      setStreak(newStreak);
      setFeedback({
        message: `🎉 せいかい！「${target.kanji}」の漢字がわかったね！`,
        type: 'success',
      });
    } else {
      setStreak(0);
      setFeedback({
        message: `💪 せいかいは「${target.kanji}」だよ。${target.landmarkEmoji} ${target.landmark}`,
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

  function choiceClass(pref: Prefecture): string {
    if (!locked) return 'choice-btn';
    if (pref.id === target.id) return 'choice-btn correct';
    if (pref.id === selectedId) return 'choice-btn wrong';
    return 'choice-btn dimmed';
  }

  return (
    <div className="game-screen">
      <header className="game-header">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>✏️ 漢字チャレンジ</h2>
        <p className="game-desc">ひらがなを読んで、正しい漢字の都道府県名を選ぼう！</p>
      </header>

      <ScorePanel score={score} streak={streak} total={GOAL} />

      <div className="question-card kanji-card">
        <p className="question-label">この読み方の漢字はどれ？</p>
        <div className="hiragana-display">{target.hiragana}</div>
        <p className="sub-hint">📍 {target.region}地方の県だよ</p>
      </div>

      <FeedbackBanner message={feedback.message} type={feedback.type} />

      <div className="choices-grid">
        {choices.map((pref) => (
          <button
            key={pref.id}
            className={choiceClass(pref)}
            onClick={() => handleChoice(pref)}
            disabled={locked}
          >
            <span className="choice-kanji">{pref.kanji}</span>
            <span className="choice-emoji">{pref.landmarkEmoji}</span>
          </button>
        ))}
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
