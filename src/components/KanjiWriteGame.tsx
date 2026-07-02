import { useCallback, useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import { getKanjiChars, getRandomPrefecture, type Prefecture } from '../data/prefectures';
import { FeedbackBanner } from './FeedbackBanner';

interface KanjiWriteGameProps {
  onBack: () => void;
}

export function KanjiWriteGame({ onBack }: KanjiWriteGameProps) {
  const [target, setTarget] = useState<Prefecture>(() => getRandomPrefecture());
  const [charIndex, setCharIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: '指やペンで漢字を書いてね！',
    type: 'info',
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const chars = getKanjiChars(target.kanji);
  const currentChar = chars[charIndex];

  const initWriter = useCallback((char: string, mode: 'quiz' | 'animate') => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    writerRef.current = HanziWriter.create(containerRef.current, char, {
      width: 140,
      height: 140,
      padding: 8,
      showOutline: true,
      strokeColor: '#1e3a5f',
      outlineColor: '#cbd5e1',
      drawingColor: '#6366f1',
      drawingWidth: 16,
      highlightColor: '#fbbf24',
    });

    if (mode === 'quiz') {
      writerRef.current.quiz({
        showHintAfterMisses: 2,
        highlightOnComplete: true,
        onComplete: () => {
          if (charIndex < chars.length - 1) {
            setCharIndex((i) => i + 1);
            setFeedback({ message: 'つぎの漢字！', type: 'success' });
          } else {
            setCompleted((c) => c + 1);
            setFeedback({ message: `🎉「${target.kanji}」かけたね！`, type: 'success' });
            setTimeout(() => {
              const next = getRandomPrefecture(target);
              setTarget(next);
              setCharIndex(0);
              setFeedback({ message: '指やペンで漢字を書いてね！', type: 'info' });
            }, 1500);
          }
        },
      });
    }
  }, [charIndex, chars.length, target]);

  useEffect(() => {
    if (!currentChar) return;
    initWriter(currentChar, 'quiz');
  }, [currentChar, initWriter]);

  const showStrokeOrder = () => {
    if (!containerRef.current || !currentChar) return;
    containerRef.current.innerHTML = '';
    const writer = HanziWriter.create(containerRef.current, currentChar, {
      width: 140,
      height: 140,
      padding: 8,
      showOutline: true,
      strokeColor: '#1e3a5f',
      outlineColor: '#cbd5e1',
    });
    writer.animateCharacter();
    writerRef.current = writer;
    setTimeout(() => initWriter(currentChar, 'quiz'), 3000);
  };

  return (
    <div className="game-screen kanji-write-screen">
      <header className="game-header compact">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>✏️ 漢字チャレンジ</h2>
      </header>

      <div className="question-card compact">
        <p className="question-label">「{target.kanji}」を書こう！（{target.hiragana}）</p>
        <p className="sub-hint">{target.landmarkEmoji} {target.landmark}</p>
        <p className="char-progress">
          {charIndex + 1}文字目 / {chars.length}文字　✅{completed}問クリア
        </p>
      </div>

      <FeedbackBanner message={feedback.message} type={feedback.type} />

      <div className="hanzi-area">
        <div ref={containerRef} className="hanzi-canvas" />
        <p className="hanzi-hint">なぞって書いてね</p>
      </div>

      <div className="hanzi-actions">
        <button className="btn-secondary" onClick={showStrokeOrder}>
          📝 書き順を見る
        </button>
        <button
          className="btn-secondary"
          onClick={() => initWriter(currentChar, 'quiz')}
        >
          🔄 やり直し
        </button>
      </div>
    </div>
  );
}
