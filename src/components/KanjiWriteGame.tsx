import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import { getKanjiChars, getRandomPrefecture, type Prefecture } from '../data/prefectures';
import { FeedbackBanner } from './FeedbackBanner';

interface KanjiWriteGameProps {
  onBack: () => void;
}

type WriteStep =
  | { kind: 'single'; char: string; index: number }
  | { kind: 'combo'; chars: string[] };

function buildSteps(kanji: string): WriteStep[] {
  const chars = getKanjiChars(kanji);
  const singles = chars.map((char, index) => ({ kind: 'single' as const, char, index }));
  return [...singles, { kind: 'combo', chars }];
}

function useWriterSizes(charCount: number) {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const singleSize = Math.min(280, Math.max(200, width * 0.42));
  const comboSize = Math.min(
    150,
    Math.max(88, (width - 48) / Math.max(charCount, 1) - 10),
  );

  return { singleSize, comboSize };
}

function writerOptions(size: number) {
  return {
    width: size,
    height: size,
    padding: Math.round(size * 0.07),
    showOutline: true,
    strokeColor: '#1e3a5f',
    outlineColor: '#cbd5e1',
    drawingColor: '#6366f1',
    drawingWidth: Math.max(14, Math.round(size * 0.1)),
    highlightColor: '#fbbf24',
  };
}

export function KanjiWriteGame({ onBack }: KanjiWriteGameProps) {
  const [target, setTarget] = useState<Prefecture>(() => getRandomPrefecture());
  const [stepIndex, setStepIndex] = useState(0);
  const [comboCharIndex, setComboCharIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: 'まず1文字ずつ練習しよう！',
    type: 'info',
  });

  const chars = useMemo(() => getKanjiChars(target.kanji), [target.kanji]);
  const steps = useMemo(() => buildSteps(target.kanji), [target.kanji]);
  const currentStep = steps[stepIndex];
  const { singleSize, comboSize } = useWriterSizes(chars.length);

  const singleRef = useRef<HTMLDivElement>(null);
  const comboRefs = useRef<(HTMLDivElement | null)[]>([]);
  const writerRef = useRef<HanziWriter | null>(null);

  const goNextPrefecture = useCallback(() => {
    setCompleted((c) => c + 1);
    setFeedback({ message: `🎉「${target.kanji}」かけたね！`, type: 'success' });
    setTimeout(() => {
      const next = getRandomPrefecture(target);
      setTarget(next);
      setStepIndex(0);
      setComboCharIndex(0);
      setFeedback({ message: 'まず1文字ずつ練習しよう！', type: 'info' });
    }, 1500);
  }, [target]);

  const handleSingleComplete = useCallback(() => {
    const nextStep = steps[stepIndex + 1];
    if (nextStep?.kind === 'combo') {
      setFeedback({
        message: `いいね！最後に「${target.kanji}」を続けて書こう！`,
        type: 'success',
      });
    } else {
      const current = steps[stepIndex];
      if (current?.kind === 'single') {
        setFeedback({
          message: `つぎは「${chars[current.index + 1]}」！`,
          type: 'success',
        });
      }
    }
    setTimeout(() => {
      setStepIndex((s) => s + 1);
      setComboCharIndex(0);
    }, 600);
  }, [stepIndex, steps, chars, target.kanji]);

  const initSingleWriter = useCallback((char: string) => {
    if (!singleRef.current) return;
    singleRef.current.innerHTML = '';
    writerRef.current = HanziWriter.create(singleRef.current, char, writerOptions(singleSize));
    writerRef.current.quiz({
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      onComplete: handleSingleComplete,
    });
  }, [singleSize, handleSingleComplete]);

  const initComboRow = useCallback((activeIndex: number) => {
    chars.forEach((char, i) => {
      const el = comboRefs.current[i];
      if (!el) return;
      el.innerHTML = '';
      const writer = HanziWriter.create(el, char, writerOptions(comboSize));

      if (i < activeIndex) {
        writer.animateCharacter();
      } else if (i === activeIndex) {
        writerRef.current = writer;
        writer.quiz({
          showHintAfterMisses: 2,
          highlightOnComplete: true,
          onComplete: () => {
            if (i < chars.length - 1) {
              setComboCharIndex(i + 1);
              setFeedback({
                message: `つぎは「${chars[i + 1]}」を書いてね！`,
                type: 'success',
              });
            } else {
              goNextPrefecture();
            }
          },
        });
      }
    });
  }, [chars, comboSize, goNextPrefecture]);

  useEffect(() => {
    if (currentStep?.kind !== 'single') return;
    initSingleWriter(currentStep.char);
  }, [stepIndex, target.kanji, currentStep, initSingleWriter]);

  useEffect(() => {
    if (currentStep?.kind !== 'combo') return;
    const timer = setTimeout(() => initComboRow(comboCharIndex), 80);
    return () => clearTimeout(timer);
  }, [stepIndex, comboCharIndex, target.kanji, currentStep, initComboRow]);

  const showStrokeOrder = () => {
    let char: string | undefined;
    let el: HTMLDivElement | null = null;
    let size = singleSize;

    if (currentStep?.kind === 'single') {
      char = currentStep.char;
      el = singleRef.current;
    } else if (currentStep?.kind === 'combo') {
      char = chars[comboCharIndex];
      el = comboRefs.current[comboCharIndex] ?? null;
      size = comboSize;
    }

    if (!el || !char) return;
    el.innerHTML = '';
    const writer = HanziWriter.create(el, char, writerOptions(size));
    writer.animateCharacter();
    writerRef.current = writer;
    setTimeout(() => {
      if (currentStep?.kind === 'single') {
        initSingleWriter(char!);
      } else {
        initComboRow(comboCharIndex);
      }
    }, 2800);
  };

  const retry = () => {
    if (currentStep?.kind === 'single') {
      initSingleWriter(currentStep.char);
    } else {
      initComboRow(comboCharIndex);
    }
  };

  const stepLabel = useMemo(() => {
    if (currentStep?.kind === 'single') {
      return `1文字ずつ練習：「${currentStep.char}」`;
    }
    return `続けて書こう：「${target.kanji}」`;
  }, [currentStep, target.kanji]);

  return (
    <div className="game-screen kanji-write-screen">
      <header className="game-header compact">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>✏️ 漢字チャレンジ</h2>
      </header>

      <div className="question-card compact">
        <p className="question-label">{stepLabel}</p>
        <p className="sub-hint">{target.landmarkEmoji} {target.kanji}（{target.hiragana}）</p>
        <div className="kanji-step-strip">
          {chars.map((char, i) => (
            <span
              key={`${char}-${i}`}
              className={[
                'kanji-step-char',
                currentStep?.kind === 'single' && currentStep.index === i ? 'active' : '',
                currentStep?.kind === 'combo' && comboCharIndex === i ? 'active' : '',
                (currentStep?.kind === 'single' && currentStep.index > i)
                || (currentStep?.kind === 'combo' && comboCharIndex > i)
                  ? 'done'
                  : '',
              ].filter(Boolean).join(' ')}
            >
              {char}
            </span>
          ))}
          <span className={`kanji-step-full ${currentStep?.kind === 'combo' ? 'active' : ''}`}>
            → {target.kanji}
          </span>
        </div>
        <p className="char-progress">
          {stepIndex + 1} / {steps.length} ステップ　✅{completed}問クリア
        </p>
      </div>

      <FeedbackBanner message={feedback.message} type={feedback.type} />

      <div className="hanzi-area">
        {currentStep?.kind === 'single' ? (
          <div
            ref={singleRef}
            className="hanzi-canvas hanzi-canvas-lg"
            style={{ width: singleSize, height: singleSize }}
          />
        ) : (
          <div className="hanzi-combo-row">
            {chars.map((char, i) => (
              <div
                key={`combo-${char}-${i}`}
                ref={(el) => { comboRefs.current[i] = el; }}
                className={`hanzi-canvas hanzi-canvas-combo ${comboCharIndex === i ? 'active' : ''} ${comboCharIndex > i ? 'done' : ''}`}
                style={{ width: comboSize, height: comboSize }}
              />
            ))}
          </div>
        )}
        <p className="hanzi-hint">
          {currentStep?.kind === 'single' ? '大きくなぞって書いてね' : '左から順に続けて書いてね'}
        </p>
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
