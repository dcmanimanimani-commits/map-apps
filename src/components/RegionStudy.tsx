import { useCallback, useMemo, useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { getPrefecturesByRegion, getRandomPrefecture, prefectureByKanji, type Prefecture } from '../data/prefectures';
import { getStudyRegion } from '../data/regions';
import { masterRegion } from '../data/progress';
import { JapanMap } from './JapanMap';
import { FeedbackBanner } from './FeedbackBanner';
import { PlayerStatus } from './PlayerStatus';

interface RegionStudyProps {
  geo: JapanGeoJSON;
  regionId: string;
  onBack: () => void;
  onMastered: () => void;
}

type Phase = 'learn' | 'quiz' | 'clear';

const QUIZ_GOAL = 8;

export function RegionStudy({ geo, regionId, onBack, onMastered }: RegionStudyProps) {
  const region = getStudyRegion(regionId);
  const prefs = useMemo(
    () => getPrefecturesByRegion(regionId),
    [regionId],
  );

  const regionLabel = region?.name ?? '';

  const [phase, setPhase] = useState<Phase>('learn');
  const [selectedKanji, setSelectedKanji] = useState<string | null>(null);
  const [visitedKanji, setVisitedKanji] = useState<Set<string>>(() => new Set());
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
  const selected = selectedKanji ? prefectureByKanji.get(selectedKanji) : null;
  const allVisited = visitedKanji.size >= prefs.length;

  const nextQuiz = useCallback((last?: Prefecture) => {
    const next = getRandomPrefecture(last, prefs);
    setTarget(next);
    setCorrectKanji(null);
    setWrongKanji(null);
    setLocked(false);
    setFeedback({ message: 'この県はどこ？地図をタップ！', type: 'info' });
  }, [prefs]);

  const handleLearnTap = (kanji: string) => {
    if (!activeKanjiSet.has(kanji)) return;
    setSelectedKanji(kanji);
    setVisitedKanji((prev) => new Set(prev).add(kanji));
  };

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
          const updated = masterRegion(regionId);
          setNewTitle(updated.title);
          setPhase('clear');
        } else {
          setFeedback({ message: 'もう少し！べんきょうからやり直そう', type: 'error' });
          setTimeout(() => {
            setPhase('learn');
            setSelectedKanji(null);
            setVisitedKanji(new Set());
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
          {visitedKanji.size} / {prefs.length} 県を見たよ
        </div>

        <div className="learn-card">
          {selected ? (
            <>
              <span className="learn-emoji">{selected.landmarkEmoji}</span>
              <div className="learn-card-body">
                <h3 className="learn-kanji">{selected.kanji}</h3>
                <p className="learn-hiragana">{selected.hiragana}</p>
                <p className="learn-landmark">{selected.landmark}</p>
              </div>
            </>
          ) : (
            <p className="learn-prompt">👆 地図の県をタップして名物を見よう！</p>
          )}
        </div>

        <div className="map-container compact-map region-focus-map">
          <JapanMap
            geo={geo}
            highlightedKanji={selectedKanji}
            focusKanjiSet={activeKanjiSet}
            showPrefectureLabels
            onPrefectureClick={handleLearnTap}
            interactive
          />
        </div>

        {allVisited && (
          <div className="learn-nav">
            <button
              className="btn-primary"
              onClick={() => {
                setPhase('quiz');
                nextQuiz();
              }}
            >
              ぜんぶ見た！クイズへ →
            </button>
          </div>
        )}
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
