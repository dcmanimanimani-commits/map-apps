import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getWriteKanjiChars } from '../data/prefectures';
import { pickBossQuestions, type KanjiBossQuestion } from '../data/kanjiBossQuestions';
import { supportsAppleScribble } from '../utils/device';
import { matchFreehandKanji, preloadBossKanjiMasks } from '../utils/kanjiMatch';
import { matchScribbleChar } from '../utils/scribbleMatch';
import { FreehandKanjiPad, type FreehandKanjiPadHandle } from './FreehandKanjiPad';
import { ScribbleKanjiInput, type ScribbleKanjiInputHandle } from './ScribbleKanjiInput';
import { KanjiGlyph } from './KanjiGlyph';
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
const MORPH_MS = 900;

function usePadSize() {
  return useMemo(() => {
    const w = window.innerWidth;
    return Math.min(300, Math.max(220, w * 0.55));
  }, []);
}

export function KanjiBossGame({ onBack }: KanjiBossGameProps) {
  const useScribble = useMemo(() => supportsAppleScribble(), []);

  const [phase, setPhase] = useState<Phase>('intro');
  const [questions, setQuestions] = useState<KanjiBossQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [completedChars, setCompletedChars] = useState<string[]>([]);
  const [bossHp, setBossHp] = useState(BOSS_MAX_HP);
  const [playerHp, setPlayerHp] = useState(3);
  const [mistakes, setMistakes] = useState(0);
  const [attackFx, setAttackFx] = useState<AttackFx>(null);
  const [bossShake, setBossShake] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [locked, setLocked] = useState(false);
  const [padResetKey, setPadResetKey] = useState(0);
  const [morphChar, setMorphChar] = useState<string | null>(null);
  const [morphSnapshot, setMorphSnapshot] = useState<string | null>(null);
  const [bulletChar, setBulletChar] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: 'クイズに答えて、白い紙に漢字（かんじ）を書（か）こう！',
    type: 'info',
  });

  const canvasPadRef = useRef<FreehandKanjiPadHandle>(null);
  const scribbleRef = useRef<ScribbleKanjiInputHandle>(null);
  const firingRef = useRef(false);
  const padSize = usePadSize();

  const question = questions[qIndex];
  const chars = useMemo(
    () => (question ? getWriteKanjiChars(question.answerKanji) : []),
    [question?.answerKanji],
  );
  const expectedChar = chars[charIndex];

  const clearPad = useCallback(() => {
    if (useScribble) {
      scribbleRef.current?.clear();
      scribbleRef.current?.focus();
    } else {
      canvasPadRef.current?.clear();
    }
  }, [useScribble]);

  const hasInput = useCallback(() => {
    if (useScribble) return scribbleRef.current?.hasChar() ?? false;
    return canvasPadRef.current?.hasInk() ?? false;
  }, [useScribble]);

  const startGame = () => {
    setQuestions(pickBossQuestions(QUESTION_COUNT));
    setQIndex(0);
    setCharIndex(0);
    setCompletedChars([]);
    setBossHp(BOSS_MAX_HP);
    setPlayerHp(3);
    setMistakes(0);
    setShowHint(false);
    setPadResetKey((k) => k + 1);
    setMorphChar(null);
    setMorphSnapshot(null);
    setPhase('play');
    if (!useScribble) preloadBossKanjiMasks();
    setFeedback({
      message: useScribble
        ? 'Apple Pencil で1文字（もじ）ずつ書（か）こう！ 活字（かつじ）になったら「打（う）とう！」'
        : '1文字（もじ）ずつ書（か）く！ 書（か）き終（お）わったら「打（う）とう！」',
      type: 'info',
    });
  };

  const triggerDeflect = useCallback((char: string) => {
    setBulletChar(char || '?');
    setAttackFx('deflect');
    setBossShake(false);
    setFeedback({ message: '💨 はじかれた！もう一度（いちど）書（か）いて！', type: 'error' });
    setTimeout(() => setAttackFx(null), 700);
  }, []);

  const triggerHit = useCallback((char: string, final: boolean) => {
    setBulletChar(char);
    setAttackFx('hit');
    setBossShake(true);
    if (final) {
      setFeedback({ message: `💥 命中（めいちゅう）！「${question?.answerKanji}」`, type: 'success' });
    } else {
      setFeedback({ message: '✨ 活字（かつじ）になった！つぎの1文字（もじ）！', type: 'success' });
    }
    setTimeout(() => {
      setAttackFx(null);
      setBossShake(false);
    }, final ? 900 : 600);
  }, [question?.answerKanji]);

  const goNextQuestion = useCallback(() => {
    setMistakes(0);
    setShowHint(false);
    setCharIndex(0);
    setCompletedChars([]);
    setMorphChar(null);
    setMorphSnapshot(null);
    setPadResetKey((k) => k + 1);
    if (qIndex + 1 >= questions.length) {
      setPhase('win');
      return;
    }
    setQIndex((i) => i + 1);
    setFeedback({ message: 'つぎの問題（もんだい）！ また1文字（もじ）ずつ！', type: 'info' });
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

  const finishSuccess = useCallback((char: string, isLast: boolean) => {
    setMorphChar(char);
    setTimeout(() => {
      triggerHit(char, isLast);
      setCompletedChars((prev) => [...prev, char]);

      setTimeout(() => {
        setMorphChar(null);
        setMorphSnapshot(null);
        clearPad();
        setPadResetKey((k) => k + 1);

        if (!isLast) {
          setCharIndex((i) => i + 1);
          setLocked(false);
          firingRef.current = false;
          return;
        }

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
          firingRef.current = false;
        }, 500);
      }, isLast ? 400 : 300);
    }, MORPH_MS);
  }, [triggerHit, clearPad, goNextQuestion]);

  const handleFire = useCallback(async () => {
    if (locked || firingRef.current || !expectedChar || morphChar) return;
    if (!hasInput()) {
      setFeedback({
        message: useScribble
          ? '✏️ Apple Pencil で白い紙に書（か）いてね'
          : '✏️ 白い紙に文字（もじ）を書（か）いてから「打（う）とう！」',
        type: 'info',
      });
      return;
    }

    firingRef.current = true;
    setLocked(true);

    let ok = false;
    let writtenChar = '';

    if (useScribble) {
      writtenChar = scribbleRef.current?.getChar() ?? '';
      ok = matchScribbleChar(writtenChar, expectedChar);
    } else {
      const canvas = canvasPadRef.current?.getCanvas();
      if (canvas) {
        setMorphSnapshot(canvasPadRef.current?.toDataURL() ?? null);
        const result = await matchFreehandKanji(canvas, expectedChar);
        ok = result.ok;
      }
      writtenChar = expectedChar;
    }

    if (!ok) {
      const next = mistakes + 1;
      setMistakes(next);
      triggerDeflect(useScribble ? (writtenChar || '？') : '？');
      clearPad();
      if (useScribble) scribbleRef.current?.blur();
      setLocked(false);
      firingRef.current = false;
      if (next >= MAX_MISTAKES) {
        failQuestion();
      }
      return;
    }

    if (useScribble) {
      setMorphSnapshot(null);
    }

    finishSuccess(expectedChar, charIndex + 1 >= chars.length);
  }, [
    locked,
    expectedChar,
    morphChar,
    mistakes,
    charIndex,
    chars.length,
    useScribble,
    hasInput,
    clearPad,
    triggerDeflect,
    failQuestion,
    finishSuccess,
  ]);

  useEffect(() => {
    if (phase !== 'play' || useScribble) return;
    const blockSelect = (e: Event) => e.preventDefault();
    document.documentElement.classList.add('boss-no-select');
    document.addEventListener('selectstart', blockSelect);
    return () => {
      document.documentElement.classList.remove('boss-no-select');
      document.removeEventListener('selectstart', blockSelect);
    };
  }, [phase, useScribble]);

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
          <p>白（しろ）い紙（かみ）に漢字（かんじ）を書（か）いて攻（せ）めよう！</p>
          <ul className="boss-intro-rules">
            <li>📝 <strong>1文字（もじ）ずつ</strong>白い紙（かみ）に書（か）く</li>
            {useScribble ? (
              <li>✨ Apple Pencil で書（か）くと<strong>活字（かつじ）</strong>になる（キーノートと同じ）</li>
            ) : (
              <li>✨ 書（か）き終（お）わったら<strong>活字（かつじ）</strong>になって弾（たま）になる</li>
            )}
            <li>❌ ちがう → はじかれる</li>
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

  if (!question || !expectedChar) return null;

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
                {bulletChar}
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

      <div className="question-card compact boss-write-card">
        <p className="boss-step-banner">
          1文字（もじ）ずつ書（か）く！　今（いま）は <strong>{charIndex + 1}文字目</strong>（全部で{chars.length}文字）
        </p>
        <div className="boss-answer-strip" aria-label="答えの進み">
          {chars.map((_, i) => (
            <div
              key={i}
              className={[
                'boss-answer-slot',
                i < completedChars.length ? 'done' : '',
                i === charIndex && !morphChar ? 'active' : '',
                i === charIndex && morphChar ? 'morphing' : '',
              ].filter(Boolean).join(' ')}
            >
              {i < completedChars.length ? (
                <KanjiGlyph char={completedChars[i]} size={36} />
              ) : i === charIndex ? (
                morphChar ? (
                  <KanjiGlyph char={morphChar} size={36} className="boss-slot-glyph" />
                ) : (
                  <span className="boss-slot-now">✏️</span>
                )
              ) : (
                <span className="boss-slot-empty">·</span>
              )}
            </div>
          ))}
        </div>
        <p className="char-progress">
          {morphChar
            ? '✨ 活字（かつじ）に変（か）わってる…'
            : useScribble
              ? '白い紙をタップ → 書く → 活字になったら「打とう！」'
              : '白（しろ）い紙（かみ）に今（いま）の1文字（もじ）だけ書（か）いて！'}
        </p>
      </div>

      <FeedbackBanner message={feedback.message} type={feedback.type} />

      <div className={`hanzi-actions ${useScribble ? 'hanzi-actions--above-pad' : ''}`}>
        <button className="btn-primary boss-fire-btn" type="button" onClick={() => handleFire()} disabled={locked || !!morphChar}>
          🎯 打（う）とう！
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            clearPad();
            setFeedback({ message: '消（け）したよ。もう一度（いちど）書（か）いて！', type: 'info' });
          }}
          disabled={locked || !!morphChar}
        >
          🧹 消（け）す
        </button>
        <button className="btn-secondary" type="button" onClick={() => setShowHint(true)} disabled={locked}>
          💡 ヒント
        </button>
      </div>

      <div className="hanzi-area boss-hanzi-area">
        <div className="freehand-pad-wrap" style={{ width: padSize, height: padSize }}>
          {morphChar ? (
            <div className="kanji-morph-stage" style={{ width: padSize, height: padSize }}>
              {!useScribble && morphSnapshot && (
                <img src={morphSnapshot} alt="" className="kanji-morph-hand" />
              )}
              <KanjiGlyph char={morphChar} size={padSize} className="kanji-morph-glyph" />
            </div>
          ) : useScribble ? (
            <ScribbleKanjiInput
              ref={scribbleRef}
              size={padSize}
              disabled={locked}
              resetKey={padResetKey}
            />
          ) : (
            <FreehandKanjiPad
              ref={canvasPadRef}
              size={padSize}
              disabled={locked}
              resetKey={padResetKey}
            />
          )}
        </div>
        <p className="hanzi-hint">
          {morphChar
            ? '活字（かつじ）になった！'
            : useScribble
              ? '書き終わるとメニューが消える →「打とう！」を押してね'
              : '書（か）き終（お）わったら「打（う）とう！」'}
        </p>
      </div>
    </div>
  );
}
