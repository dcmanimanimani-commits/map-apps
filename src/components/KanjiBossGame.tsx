import { useCallback, useMemo, useRef, useState } from 'react';
import { getWriteKanjiChars } from '../data/prefectures';
import { pickBossQuestions, type KanjiBossQuestion } from '../data/kanjiBossQuestions';
import { matchFreehandKanji } from '../utils/kanjiMatch';
import { FreehandKanjiPad, type FreehandKanjiPadHandle } from './FreehandKanjiPad';
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

function usePadSize() {
  return useMemo(() => {
    const w = window.innerWidth;
    return Math.min(280, Math.max(200, w * 0.42));
  }, []);
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
  const [locked, setLocked] = useState(false);
  const [padResetKey, setPadResetKey] = useState(0);
  const [morphChar, setMorphChar] = useState<string | null>(null);
  const [bulletChar, setBulletChar] = useState('');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: 'クイズに答えて、白い紙に漢字（かんじ）を書（か）こう！',
    type: 'info',
  });

  const padRef = useRef<FreehandKanjiPadHandle>(null);
  const padSize = usePadSize();

  const question = questions[qIndex];
  const chars = useMemo(
    () => (question ? getWriteKanjiChars(question.answerKanji) : []),
    [question?.answerKanji],
  );
  const expectedChar = chars[charIndex];

  const startGame = () => {
    setQuestions(pickBossQuestions(QUESTION_COUNT));
    setQIndex(0);
    setCharIndex(0);
    setBossHp(BOSS_MAX_HP);
    setPlayerHp(3);
    setMistakes(0);
    setShowHint(false);
    setPadResetKey((k) => k + 1);
    setMorphChar(null);
    setPhase('play');
    setFeedback({
      message: '問題（もんだい）を読（よ）んで、県名（けんめい）を1文字ずつ書（か）いて打（う）とう！',
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
      setFeedback({ message: '✨ 活字（かつじ）になった！つぎの文字（もじ）！', type: 'success' });
    }
    setTimeout(() => {
      setAttackFx(null);
      setBossShake(false);
      setMorphChar(null);
    }, final ? 900 : 600);
  }, [question?.answerKanji]);

  const goNextQuestion = useCallback(() => {
    setMistakes(0);
    setShowHint(false);
    setCharIndex(0);
    setPadResetKey((k) => k + 1);
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

  const handleFire = useCallback(async () => {
    if (locked || !expectedChar) return;
    const canvas = padRef.current?.getCanvas();
    if (!canvas || !padRef.current?.hasInk()) {
      setFeedback({ message: '✏️ 白い紙に文字（もじ）を書（か）いてから「打（う）とう！」', type: 'info' });
      return;
    }

    setLocked(true);
    const { ok } = await matchFreehandKanji(canvas, expectedChar);

    if (!ok) {
      const next = mistakes + 1;
      setMistakes(next);
      triggerDeflect('？');
      padRef.current?.clear();
      setLocked(false);
      if (next >= MAX_MISTAKES) {
        failQuestion();
      }
      return;
    }

    setMorphChar(expectedChar);
    const isLast = charIndex + 1 >= chars.length;

    setTimeout(() => {
      triggerHit(expectedChar, isLast);
      padRef.current?.clear();
      setPadResetKey((k) => k + 1);

      if (!isLast) {
        setCharIndex((i) => i + 1);
        setLocked(false);
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
      }, 900);
    }, 450);
  }, [
    locked,
    expectedChar,
    mistakes,
    charIndex,
    chars.length,
    triggerDeflect,
    triggerHit,
    failQuestion,
    goNextQuestion,
  ]);

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
            <li>📝 なぞらない！フリーハンドで書（か）く</li>
            <li>✨ 書（か）いた文字（もじ）が活字（かつじ）になって弾（たま）になる</li>
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

      <div className="question-card compact">
        <p className="question-label">答（こた）えを漢字（かんじ）で書（か）こう！（{chars.length}文字（もじ））</p>
        <div className="boss-char-dots" aria-label={`${charIndex}文字書いた`}>
          {chars.map((_, i) => (
            <span key={i} className={`boss-char-dot ${i < charIndex ? 'done' : i === charIndex ? 'active' : ''}`} />
          ))}
        </div>
        <p className="char-progress">{charIndex + 1}文字目（もじめ）を書（か）いて「打（う）とう！」</p>
      </div>

      <FeedbackBanner message={feedback.message} type={feedback.type} />

      <div className="hanzi-area boss-hanzi-area">
        <div className="freehand-pad-wrap">
          {!morphChar && (
            <FreehandKanjiPad
              ref={padRef}
              size={padSize}
              disabled={locked}
              resetKey={padResetKey}
            />
          )}
          {morphChar && (
            <div className="kanji-morph-display" aria-live="polite">
              {morphChar}
            </div>
          )}
        </div>
        <p className="hanzi-hint">Apple Pencil や指（ゆび）で白い紙（かみ）に書（か）いてね</p>
      </div>

      <div className="hanzi-actions">
        <button className="btn-primary boss-fire-btn" type="button" onClick={handleFire} disabled={locked}>
          🎯 打（う）とう！
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            padRef.current?.clear();
            setFeedback({ message: '消（け）したよ。もう一度（いちど）書（か）いて！', type: 'info' });
          }}
          disabled={locked}
        >
          🧹 消（け）す
        </button>
        <button className="btn-secondary" type="button" onClick={() => setShowHint(true)} disabled={locked}>
          💡 ヒント
        </button>
      </div>
    </div>
  );
}
