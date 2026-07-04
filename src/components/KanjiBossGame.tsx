import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import { getWriteKanjiChars } from '../data/prefectures';
import { pickBossQuestions, type KanjiBossQuestion } from '../data/kanjiBossQuestions';
import { createKanjiCharDataLoader } from '../utils/kanjiWriterLoader';
import { FeedbackBanner } from './FeedbackBanner';

interface KanjiBossGameProps {
  onBack: () => void;
}

type Phase = 'intro' | 'play' | 'win' | 'lose';
type AttackFx = 'hit' | 'deflect' | null;

const BOSS_MAX_HP = 100;
const HIT_DAMAGE = 25;
const DEFLECT_DAMAGE_PLAYER = 1;
const MAX_MISTAKES = 4;
const QUESTION_COUNT = 8;

function useWriterSize() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return Math.min(240, Math.max(180, width * 0.38));
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
    showHintAfterMisses: 2 as const,
    markStrokeCorrectAfterMisses: 4 as const,
    acceptBackwardsStrokes: true,
    charDataLoader: createKanjiCharDataLoader(),
  };
}

export function KanjiBossGame({ onBack }: KanjiBossGameProps) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<KanjiBossQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [bossHp, setBossHp] = useState(BOSS_MAX_HP);
  const [playerHp, setPlayerHp] = useState(3);
  const [mistakes, setMistakes] = useState(0);
  const [attackFx, setAttackFx] = useState<AttackFx>(null);
  const [bossShake, setBossShake] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: 'クイズに答えて、漢字（かんじ）で攻（せ）めよう！',
    type: 'info',
  });
  const [locked, setLocked] = useState(false);

  const question = questions[qIndex];
  const chars = useMemo(
    () => (question ? getWriteKanjiChars(question.answerKanji) : []),
    [question?.answerKanji],
  );
  const currentChar = chars[charIndex];
  const singleSize = useWriterSize();
  const singleRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);

  const startGame = () => {
    setQuestions(pickBossQuestions(QUESTION_COUNT));
    setQIndex(0);
    setCharIndex(0);
    setBossHp(BOSS_MAX_HP);
    setPlayerHp(3);
    setMistakes(0);
    setShowHint(false);
    setPhase('play');
    setFeedback({ message: '県（けん）名を漢字（かんじ）で書（か）いてボスをたたく！', type: 'info' });
  };

  const triggerDeflect = useCallback(() => {
    setAttackFx('deflect');
    setBossShake(false);
    setFeedback({ message: '💨 はじかれた！もう一度書（か）いて！', type: 'error' });
    setTimeout(() => setAttackFx(null), 700);
  }, []);

  const triggerHit = useCallback((final: boolean) => {
    setAttackFx('hit');
    setBossShake(true);
    if (final) {
      setBossHp((hp) => Math.max(0, hp - HIT_DAMAGE));
      setFeedback({ message: `💥 命中（めいちゅう）！「${question?.answerKanji}」`, type: 'success' });
    } else {
      setFeedback({ message: '✨ いい感（かん）じ！つぎの文字（もじ）！', type: 'success' });
    }
    setTimeout(() => {
      setAttackFx(null);
      setBossShake(false);
    }, final ? 900 : 500);
  }, [question?.answerKanji]);

  const goNextQuestion = useCallback(() => {
    setMistakes(0);
    setShowHint(false);
    setCharIndex(0);
    if (qIndex + 1 >= questions.length) {
      setPhase('win');
      return;
    }
    setQIndex((i) => i + 1);
    setFeedback({ message: 'つぎの問題（もんだい）！', type: 'info' });
  }, [qIndex, questions.length]);

  const failQuestion = useCallback(() => {
    setLocked(true);
    setFeedback({
      message: `😵 ボスの反撃（はんげき）！せいかいは「${question?.answerKanji}」（${question?.hint}）`,
      type: 'error',
    });
    setPlayerHp((hp) => {
      const next = hp - DEFLECT_DAMAGE_PLAYER;
      setTimeout(() => {
        if (next <= 0) {
          setPhase('lose');
        } else {
          setLocked(false);
          goNextQuestion();
        }
      }, 2200);
      return Math.max(0, next);
    });
  }, [question, goNextQuestion]);

  const handleCharComplete = useCallback(() => {
    if (locked) return;
    const isLast = charIndex + 1 >= chars.length;
    triggerHit(isLast);
    if (!isLast) {
      setTimeout(() => setCharIndex((i) => i + 1), 500);
      return;
    }
    setLocked(true);
    setTimeout(() => {
      setBossHp((hp) => {
        const next = Math.max(0, hp - HIT_DAMAGE);
        if (next <= 0) {
          setPhase('win');
        } else {
          goNextQuestion();
        }
        return next;
      });
      setLocked(false);
    }, 1000);
  }, [locked, charIndex, chars.length, triggerHit, goNextQuestion]);

  const handleMistake = useCallback(() => {
    if (locked) return;
    const next = mistakes + 1;
    setMistakes(next);
    triggerDeflect();
    if (next >= MAX_MISTAKES) {
      failQuestion();
    }
  }, [locked, mistakes, triggerDeflect, failQuestion]);

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
      onMistake: handleMistake,
    } as Parameters<typeof writerRef.current.quiz>[0]);
  }, [singleSize, handleMistake, handleCharComplete]);

  useEffect(() => {
    if (phase !== 'play' || !currentChar || locked) return;
    initWriter(currentChar);
  }, [phase, qIndex, charIndex, currentChar, locked, initWriter]);

  const showStrokeOrder = () => {
    if (!singleRef.current || !currentChar) return;
    singleRef.current.innerHTML = '';
    const writer = HanziWriter.create(singleRef.current, currentChar, writerOptions(singleSize));
    writer.animateCharacter();
    setTimeout(() => initWriter(currentChar), 2800);
  };

  if (phase === 'intro') {
    return (
      <div className="game-screen kanji-write-screen boss-screen">
        <header className="game-header compact">
          <button className="btn-back" onClick={onBack}>← もどる</button>
          <h2>👹 漢字ボスたたき</h2>
        </header>
        <div className="boss-intro-card">
          <span className="boss-intro-emoji">👹🗾</span>
          <h3>もんだい大王（だいおう）が現（あらわ）れた！</h3>
          <p>名物（めいぶつ）のクイズに答（こた）えて、</p>
          <p>漢字（かんじ）を書（か）いて弾（たま）にして攻（せ）めよう！</p>
          <ul className="boss-intro-rules">
            <li>✅ 正（ただ）しく書（か）く → ボスに命中（めいちゅう）</li>
            <li>❌ 間違（まちが）える → はじかれる</li>
            <li>❤️×3　ボスHPを0にしたら勝（か）ち！</li>
          </ul>
          <button className="btn-primary" onClick={startGame}>たたかう！</button>
        </div>
      </div>
    );
  }

  if (phase === 'win') {
    return (
      <div className="game-screen kanji-write-screen boss-screen">
        <div className="clear-card">
          <span className="clear-emoji">🏆</span>
          <h2>勝（か）利（り）！</h2>
          <p>もんだい大王（だいおう）をたおした！</p>
          <div className="finish-actions">
            <button className="btn-primary" onClick={startGame}>もう一度</button>
            <button className="btn-secondary" onClick={onBack}>ホームへ</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'lose') {
    return (
      <div className="game-screen kanji-write-screen boss-screen">
        <div className="clear-card">
          <span className="clear-emoji">😢</span>
          <h2>負（ま）け…</h2>
          <p>もう一度（いちど）挑戦（ちょうせん）しよう！</p>
          <div className="finish-actions">
            <button className="btn-primary" onClick={startGame}>再挑戦（さいちょうせん）</button>
            <button className="btn-secondary" onClick={onBack}>ホームへ</button>
          </div>
        </div>
      </div>
    );
  }

  if (!question || !currentChar) return null;

  return (
    <div className="game-screen kanji-write-screen boss-screen">
      <header className="game-header compact">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>👹 漢字ボスたたき</h2>
      </header>

      <div className="boss-arena">
        <div className="boss-status">
          <div className="boss-face-wrap">
            <span className={`boss-face ${bossShake ? 'boss-face--hit' : ''} ${attackFx === 'deflect' ? 'boss-face--block' : ''}`}>
              👹
            </span>
            {attackFx && (
              <span className={`boss-bullet boss-bullet--${attackFx}`} aria-hidden>
                {currentChar}
              </span>
            )}
          </div>
          <div className="boss-hp-bar">
            <div className="boss-hp-fill" style={{ width: `${(bossHp / BOSS_MAX_HP) * 100}%` }} />
          </div>
          <p className="boss-hp-label">ボス HP {bossHp}</p>
        </div>
        <div className="player-hearts" aria-label={`体力 ${playerHp}`}>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className={i < playerHp ? 'heart on' : 'heart off'}>❤️</span>
          ))}
        </div>
      </div>

      <div className="boss-quiz-card">
        <p className="boss-quiz-label">問題（もんだい） {qIndex + 1} / {questions.length}</p>
        <p className="boss-quiz-text">
          <span className="boss-quiz-emoji">{question.emoji}</span>
          {question.question}
        </p>
        {showHint && (
          <p className="boss-quiz-hint">ヒント：{question.hint}</p>
        )}
      </div>

      <div className="question-card compact">
        <p className="question-label">答（こた）えを書（か）こう！「{currentChar}」</p>
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
        <p className="char-progress">{charIndex + 1} / {chars.length} 文字（もじ）</p>
      </div>

      <FeedbackBanner message={feedback.message} type={feedback.type} />

      <div className="hanzi-area boss-hanzi-area">
        <div
          ref={singleRef}
          className="hanzi-canvas hanzi-canvas-lg boss-canvas"
          style={{ width: singleSize, height: singleSize }}
        />
        <p className="hanzi-hint">書（か）いた文字（もじ）が弾（たま）になる！</p>
      </div>

      <div className="hanzi-actions">
        <button className="btn-secondary" type="button" onClick={() => setShowHint(true)}>
          💡 ヒント
        </button>
        <button className="btn-secondary" type="button" onClick={showStrokeOrder}>
          📝 書き順（かきじゅん）
        </button>
      </div>
    </div>
  );
}
