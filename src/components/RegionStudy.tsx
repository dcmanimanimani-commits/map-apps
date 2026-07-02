import { useCallback, useMemo, useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { getPrefecturesByRegion, getRandomPrefecture, type Prefecture } from '../data/prefectures';
import { getStudyRegion } from '../data/regions';
import { masterRegion } from '../data/progress';
import { JapanMap } from './JapanMap';
import { FeedbackBanner } from './FeedbackBanner';
import { PlayerStatus } from './PlayerStatus';

interface RegionStudyProps {
  geo: JapanGeoJSON;
  regionId: string;
  subRegionId?: string;
  onBack: () => void;
  onMastered: () => void;
}

type Phase = 'learn' | 'quiz' | 'clear';

const QUIZ_GOAL = 8;

export function RegionStudy({ geo, regionId, subRegionId, onBack, onMastered }: RegionStudyProps) {
  const region = getStudyRegion(regionId);
  const prefs = useMemo(
    () => getPrefecturesByRegion(regionId, subRegionId),
    [regionId, subRegionId],
  );

  const regionLabel = subRegionId
    ? region?.subRegions?.find((s) => s.id === subRegionId)?.name ?? ''
    : region?.name ?? '';

  const [phase, setPhase] = useState<Phase>('learn');
  const [learnIndex, setLearnIndex] = useState(0);
  const [target, setTarget] = useState<Prefecture>(() => prefs[0]);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: '地図をタップしてね！',
    type: 'info',
  });
  const [correctKanji, setCorrectKanji] = useState<string | null>(null);
  const [wrongKanji, setWrongKanji] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [newTitle, setNewTitle] = useState<string | null>(null);

  const activeKanjiSet = useMemo(() => new Set(prefs.map((p) => p.kanji)), [prefs]);
  const current = prefs[learnIndex];

  const nextQuiz = useCallback((last?: Prefecture) => {
    const next = getRandomPrefecture(last, prefs);
    setTarget(next);
    setCorrectKanji(null);
    setWrongKanji(null);
    setLocked(false);
    setFeedback({ message: 'この県はどこ？地図をタップ！', type: 'info' });
  }, [prefs]);

  const handleMapClick = (kanji: string) => {
    if (locked || phase !== 'quiz') return;
    setLocked(true);

    const correct = kanji === target.kanji;
    const newScore = correct ? score + 1 : score;
    if (correct) {
      setScore(newScore);
      setCorrectKanji(kanji);
      setFeedback({ message: `🎉 せいかい！${target.kanji}`, type: 'success' });
    } else {
      setWrongKanji(kanji);
      setCorrectKanji(target.kanji);
      setFeedback({ message: `💪 せいかいは「${target.kanji}」${target.landmarkEmoji}`, type: 'error' });
    }

    const newAnswered = answered + 1;
    setAnswered(newAnswered);

    setTimeout(() => {
      if (newAnswered >= QUIZ_GOAL) {
        if (newScore >= 6) {
          const updated = masterRegion(regionId, subRegionId);
          setNewTitle(updated.title);
          setPhase('clear');
        } else {
          setFeedback({ message: 'もう少し！べんきょうからやり直そう', type: 'error' });
          setTimeout(() => {
            setPhase('learn');
            setLearnIndex(0);
            setScore(0);
            setAnswered(0);
          }, 1500);
        }
      } else {
        nextQuiz(target);
      }
    }, 1200);
  };

  if (!region || prefs.length === 0) return null;

  if (phase === 'clear') {
    return (
      <div className="game-screen">
        <div className="clear-card">
          <span className="clear-emoji">🏆</span>
          <h2>{regionLabel}マスター！</h2>
          <p>レベルアップ！称号がもらえたよ</p>
          <p className="new-title">「{newTitle}」</p>
          <div className="finish-actions">
            <button className="btn-primary" onClick={onMastered}>つぎの地方へ</button>
            <button className="btn-secondary" onClick={onBack}>地方選択へ</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'learn') {
    return (
      <div className="game-screen region-study-screen">
        <header className="game-header compact">
          <button className="btn-back" onClick={onBack}>← もどる</button>
          <h2>{region.emoji} {regionLabel}</h2>
        </header>

        <PlayerStatus />

        <div className="learn-progress">
          {learnIndex + 1} / {prefs.length}
        </div>

        <div className="learn-card">
          <span className="learn-emoji">{current.landmarkEmoji}</span>
          <div className="learn-card-body">
            <h3 className="learn-kanji">{current.kanji}</h3>
            <p className="learn-hiragana">{current.hiragana}</p>
            <p className="learn-landmark">{current.landmark}</p>
          </div>
        </div>

        <div className="map-container compact-map region-focus-map">
          <JapanMap
            geo={geo}
            highlightedKanji={current.kanji}
            focusKanjiSet={activeKanjiSet}
            interactive={false}
          />
        </div>

        <div className="learn-nav">
          <button
            className="btn-secondary"
            disabled={learnIndex === 0}
            onClick={() => setLearnIndex((i) => i - 1)}
          >
            ← まえ
          </button>
          {learnIndex < prefs.length - 1 ? (
            <button className="btn-primary" onClick={() => setLearnIndex((i) => i + 1)}>
              つぎ →
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => {
                setPhase('quiz');
                nextQuiz();
              }}
            >
              クイズへ！
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="game-screen region-study-screen">
      <header className="game-header compact">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>{region.emoji} {regionLabel}クイズ</h2>
      </header>

      <div className="quiz-score">🎯 {score} / {QUIZ_GOAL}</div>

      <div className="question-card compact">
        <p className="question-label">この県はどこ？</p>
        <div className="landmark-display compact">
          <span className="landmark-emoji sm">{target.landmarkEmoji}</span>
          <span className="landmark-name sm">{target.landmark}</span>
        </div>
        <p className="sub-hint">{target.kanji}（{target.hiragana}）</p>
      </div>

      <FeedbackBanner message={feedback.message} type={feedback.type} />

      <div className="map-container compact-map region-focus-map flex-grow">
        <JapanMap
          geo={geo}
          onPrefectureClick={handleMapClick}
          correctKanji={correctKanji}
          wrongKanji={wrongKanji}
          focusKanjiSet={activeKanjiSet}
          interactive={!locked}
        />
      </div>
    </div>
  );
}
