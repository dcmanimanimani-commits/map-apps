import { useCallback, useMemo, useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { getPrefecturesByRegion, prefectureByKanji, shufflePrefectures, type Prefecture } from '../data/prefectures';
import { usePlayer } from '../context/PlayerContext';
import { getStudyRegion } from '../data/regions';
import { JapanMap } from './JapanMap';
import { FeedbackBanner } from './FeedbackBanner';
import { PlayerStatus } from './PlayerStatus';
import { PlayerAvatar } from './PlayerAvatar';

interface RegionStudyProps {
  geo: JapanGeoJSON;
  regionId: string;
  onBack: () => void;
  onMastered: () => void;
  onSwitchPlayer?: () => void;
}

type Phase = 'learn' | 'quiz' | 'clear';

function passScoreFor(count: number): number {
  return Math.ceil(count * 0.75);
}

export function RegionStudy({ geo, regionId, onBack, onMastered, onSwitchPlayer }: RegionStudyProps) {
  const { masterRegion } = usePlayer();
  const region = getStudyRegion(regionId);
  const prefs = useMemo(
    () => getPrefecturesByRegion(regionId),
    [regionId],
  );
  const quizGoal = prefs.length;
  const passScore = passScoreFor(quizGoal);

  const regionLabel = region?.name ?? '';

  const [phase, setPhase] = useState<Phase>('learn');
  const [selectedKanji, setSelectedKanji] = useState<string | null>(null);
  const [visitedKanji, setVisitedKanji] = useState<Set<string>>(() => new Set());
  const [quizQueue, setQuizQueue] = useState<Prefecture[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
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
  const target = quizQueue[quizIndex];

  const startQuiz = useCallback(() => {
    const queue = shufflePrefectures(prefs);
    setQuizQueue(queue);
    setQuizIndex(0);
    setScore(0);
    setAnswered(0);
    setCorrectKanji(null);
    setWrongKanji(null);
    setLocked(false);
    setPhase('quiz');
    setFeedback({ message: 'この県はどこ？地図をタップ！', type: 'info' });
  }, [prefs]);

  const advanceQuiz = useCallback((newScore: number, newAnswered: number) => {
    if (newAnswered >= quizGoal) {
      if (newScore >= passScore) {
        const updated = masterRegion(regionId);
        setNewTitle(updated.title);
        setPhase('clear');
      } else {
        setFeedback({ message: 'もう少し！べんきょうしてからもう一度', type: 'error' });
        setTimeout(() => {
          setPhase('learn');
          setCorrectKanji(null);
          setWrongKanji(null);
          setLocked(false);
        }, 1500);
      }
      return;
    }

    const nextIndex = quizIndex + 1;
    setQuizIndex(nextIndex);
    setCorrectKanji(null);
    setWrongKanji(null);
    setLocked(false);
    setFeedback({ message: 'この県はどこ？地図をタップ！', type: 'info' });
  }, [quizGoal, passScore, quizIndex, masterRegion, regionId]);

  const handleLearnTap = (kanji: string) => {
    if (!activeKanjiSet.has(kanji)) return;
    setSelectedKanji(kanji);
    setVisitedKanji((prev) => new Set(prev).add(kanji));
  };

  const handleMapClick = (kanji: string) => {
    if (locked || phase !== 'quiz' || !target) return;
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
      advanceQuiz(newScore, newAnswered);
    }, 1200);
  };

  if (!region || prefs.length === 0) return null;

  if (phase === 'clear') {
    return (
      <div className="game-screen">
        <div className="clear-card">
          <PlayerAvatar title={newTitle ?? undefined} size="lg" className="clear-avatar" />
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

        <PlayerStatus onSwitchPlayer={onSwitchPlayer} />

        <div className="learn-progress">
          {visitedKanji.size} / {prefs.length} 県を見たよ
        </div>

        <div className="learn-nav learn-nav-top">
          <button className="btn-primary" onClick={startQuiz}>
            クイズへ →（全{prefs.length}問）
          </button>
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
      </div>
    );
  }

  if (!target) return null;

  return (
    <div className="game-screen region-study-screen">
      <header className="game-header compact">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>{region.emoji} {regionLabel}クイズ</h2>
      </header>

      <div className="quiz-score">🎯 {score} / {quizGoal}（{passScore}問以上でクリア）</div>

      <div className="question-card compact">
        <p className="question-label">この県はどこ？</p>
        <div className="landmark-display compact">
          <span className="landmark-emoji sm">{target.landmarkEmoji}</span>
          <span className="landmark-name sm">{target.landmark}</span>
        </div>
        <p className="sub-hint">{target.kanji}（{target.hiragana}）</p>
        <p className="char-progress">{answered + 1} / {quizGoal} 問目</p>
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
