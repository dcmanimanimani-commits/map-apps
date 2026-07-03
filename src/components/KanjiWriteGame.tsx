import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import {
  buildKanjiWriteQueue,
  getWriteKanjiChars,
  type Prefecture,
} from '../data/prefectures';
import { getStudyRegion, studyRegions } from '../data/regions';
import { FeedbackBanner } from './FeedbackBanner';

interface KanjiWriteGameProps {
  onBack: () => void;
}

type Phase = 'select-mode' | 'select-region' | 'play' | 'finish';
type GameMode = 'regional' | 'national';

function useWriterSize() {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return Math.min(280, Math.max(200, width * 0.42));
}

function writerOptions(size: number) {
  return {
    width: size,
    height: size,
    padding: Math.round(size * 0.05),
    showOutline: true,
    strokeColor: '#1e3a5f',
    outlineColor: '#cbd5e1',
    drawingColor: '#6366f1',
    drawingWidth: Math.max(18, Math.round(size * 0.12)),
    highlightColor: '#fbbf24',
    leniency: 2,
    averageDistanceThreshold: 520,
    showHintAfterMisses: 1 as const,
    markStrokeCorrectAfterMisses: 4 as const,
    acceptBackwardsStrokes: true,
  };
}

export function KanjiWriteGame({ onBack }: KanjiWriteGameProps) {
  const [phase, setPhase] = useState<Phase>('select-mode');
  const [mode, setMode] = useState<GameMode | null>(null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<Prefecture[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const target = queue[queueIndex];
  const [charIndex, setCharIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: '1文字ずつ書いてね！',
    type: 'info',
  });

  const chars = useMemo(() => (target ? getWriteKanjiChars(target.kanji) : []), [target?.kanji]);
  const currentChar = chars[charIndex];
  const singleSize = useWriterSize();

  const singleRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);

  const resetStepState = useCallback(() => {
    setCharIndex(0);
    setFeedback({ message: '1文字ずつ書いてね！', type: 'info' });
  }, []);

  const startPlay = useCallback((nextMode: GameMode, nextRegionId?: string) => {
    const nextQueue = buildKanjiWriteQueue(nextMode, nextRegionId);
    if (nextQueue.length === 0) return;
    setMode(nextMode);
    setRegionId(nextRegionId ?? null);
    setQueue(nextQueue);
    setQueueIndex(0);
    resetStepState();
    setPhase('play');
  }, [resetStepState]);

  const goNextPrefecture = useCallback(() => {
    setFeedback({ message: `🎉「${target?.kanji}」かけたね！`, type: 'success' });
    setTimeout(() => {
      if (queueIndex + 1 >= queue.length) {
        setPhase('finish');
        return;
      }
      setQueueIndex((i) => i + 1);
      resetStepState();
    }, 1500);
  }, [target?.kanji, queueIndex, queue.length, resetStepState]);

  const handleCharComplete = useCallback(() => {
    if (charIndex + 1 >= chars.length) {
      goNextPrefecture();
      return;
    }
    setFeedback({
      message: `いいね！つぎは「${chars[charIndex + 1]}」！`,
      type: 'success',
    });
    setTimeout(() => {
      setCharIndex((i) => i + 1);
    }, 600);
  }, [charIndex, chars, goNextPrefecture]);

  const initWriter = useCallback((char: string) => {
    if (!singleRef.current) return;
    singleRef.current.innerHTML = '';
    const options = writerOptions(singleSize);
    writerRef.current = HanziWriter.create(singleRef.current, char, options);
    writerRef.current.quiz({
      showHintAfterMisses: options.showHintAfterMisses,
      highlightOnComplete: true,
      leniency: options.leniency,
      averageDistanceThreshold: options.averageDistanceThreshold,
      markStrokeCorrectAfterMisses: options.markStrokeCorrectAfterMisses,
      acceptBackwardsStrokes: options.acceptBackwardsStrokes,
      onComplete: handleCharComplete,
    });
  }, [singleSize, handleCharComplete]);

  useEffect(() => {
    if (phase !== 'play' || !currentChar) return;
    initWriter(currentChar);
  }, [phase, charIndex, target?.kanji, currentChar, initWriter]);

  const showStrokeOrder = () => {
    if (!singleRef.current || !currentChar) return;
    singleRef.current.innerHTML = '';
    const writer = HanziWriter.create(singleRef.current, currentChar, writerOptions(singleSize));
    writer.animateCharacter();
    writerRef.current = writer;
    setTimeout(() => initWriter(currentChar), 2800);
  };

  const retry = () => {
    if (currentChar) initWriter(currentChar);
  };

  const modeLabel = useMemo(() => {
    if (mode === 'national') return '全国ランダム（20問）';
    if (mode === 'regional' && regionId) {
      return `${getStudyRegion(regionId)?.name ?? ''}モード`;
    }
    return '';
  }, [mode, regionId]);

  if (phase === 'select-mode') {
    return (
      <div className="game-screen kanji-write-screen">
        <header className="game-header compact">
          <button className="btn-back" onClick={onBack}>← もどる</button>
          <h2>✏️ 漢字チャレンジ</h2>
        </header>

        <p className="kanji-mode-intro">モードをえらんでね。どの県も1回ずつ出るよ！</p>

        <div className="kanji-mode-grid">
          <button
            className="kanji-mode-card"
            onClick={() => setPhase('select-region')}
          >
            <span className="kanji-mode-emoji">🗾</span>
            <span className="kanji-mode-title">地方モード</span>
            <span className="kanji-mode-desc">地方ごとにぜんぶの県を1回ずつ</span>
          </button>
          <button
            className="kanji-mode-card"
            onClick={() => startPlay('national')}
          >
            <span className="kanji-mode-emoji">🎲</span>
            <span className="kanji-mode-title">全国ランダム</span>
            <span className="kanji-mode-desc">全国からランダムに20問</span>
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'select-region') {
    return (
      <div className="game-screen kanji-write-screen">
        <header className="game-header compact">
          <button className="btn-back" onClick={() => setPhase('select-mode')}>← もどる</button>
          <h2>地方をえらぶ</h2>
        </header>

        <div className="region-grid compact">
          {studyRegions.map((region) => (
            <button
              key={region.id}
              className="region-card"
              style={{ '--region-color': region.color } as React.CSSProperties}
              onClick={() => startPlay('regional', region.id)}
            >
              <span className="region-emoji">{region.emoji}</span>
              <span className="region-name">{region.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'finish') {
    return (
      <div className="game-screen kanji-write-screen">
        <div className="clear-card">
          <span className="clear-emoji">🎉</span>
          <h2>おつかれさま！</h2>
          <p>{modeLabel}をぜんぶクリアしたよ！</p>
          <div className="finish-actions">
            <button className="btn-primary" onClick={() => setPhase('select-mode')}>もう一度</button>
            <button className="btn-secondary" onClick={onBack}>ホームへ</button>
          </div>
        </div>
      </div>
    );
  }

  if (!target || !currentChar) return null;

  return (
    <div className="game-screen kanji-write-screen">
      <header className="game-header compact">
        <button className="btn-back" onClick={() => setPhase('select-mode')}>← もどる</button>
        <h2>✏️ 漢字チャレンジ</h2>
      </header>

      <div className="question-card compact">
        <p className="question-label">「{currentChar}」を書こう</p>
        <p className="sub-hint">{target.landmarkEmoji} {target.kanji}（{target.hiragana}）</p>
        <p className="kanji-mode-badge">{modeLabel}</p>
        <div className="kanji-step-strip">
          {chars.map((char, i) => (
            <span
              key={`${char}-${i}`}
              className={[
                'kanji-step-char',
                charIndex === i ? 'active' : '',
                charIndex > i ? 'done' : '',
              ].filter(Boolean).join(' ')}
            >
              {char}
            </span>
          ))}
        </div>
        <p className="char-progress">
          {charIndex + 1} / {chars.length} 文字　📍{queueIndex + 1} / {queue.length} 問
        </p>
      </div>

      <FeedbackBanner message={feedback.message} type={feedback.type} />

      <div className="hanzi-area">
        <div
          ref={singleRef}
          className="hanzi-canvas hanzi-canvas-lg"
          style={{ width: singleSize, height: singleSize }}
        />
        <p className="hanzi-hint">大きくなぞって書いてね</p>
      </div>

      <div className="hanzi-actions">
        <button className="btn-secondary" onClick={showStrokeOrder}>
          📝 書き順を見る
        </button>
        <button className="btn-secondary" onClick={retry}>
          🔄 やり直し
        </button>
      </div>
    </div>
  );
}
