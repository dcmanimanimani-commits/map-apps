import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getWriteKanjiChars } from '../data/prefectures';
import { pickBossQuestions, type KanjiBossQuestion } from '../data/kanjiBossQuestions';
import { BOSS_IMAGE } from '../data/characterAssets';
import { supportsAppleScribble } from '../utils/device';
import { preloadBossKanjiMasks } from '../utils/kanjiMatch';
import { HybridKanjiPad, type HybridKanjiPadHandle } from './HybridKanjiPad';
import { KanjiGlyph } from './KanjiGlyph';
import { FeedbackBanner } from './FeedbackBanner';
import { PlayerAvatar } from './PlayerAvatar';
import { usePlayer } from '../context/PlayerContext';
import { resolveAvatarLevel } from '../data/progress';

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
    const sideCol = 108;
    const gap = 12;
    const edgePad = 12;
    const maxPad = w - sideCol * 2 - gap * 2 - edgePad;
    return Math.floor(Math.min(280, Math.max(200, Math.min(w * 0.42, maxPad))));
  }, []);
}

function useCheerSize(padSize: number) {
  return useMemo(() => {
    const w = window.innerWidth;
    const sideCol = 108;
    const leftSpace = (w - padSize - sideCol - 24) / 2;
    const raw = Math.min(320, Math.max(200, leftSpace * 0.92));
    return Math.floor(raw * 0.8);
  }, [padSize]);
}

export function KanjiBossGame({ onBack }: KanjiBossGameProps) {
  const useScribble = useMemo(() => supportsAppleScribble(), []);
  const { activePlayer } = usePlayer();
  const avatarLevel = activePlayer ? resolveAvatarLevel(activePlayer.progress) : 1;

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

  const padRef = useRef<HybridKanjiPadHandle>(null);
  const firingRef = useRef(false);
  const padSize = usePadSize();
  const cheerSize = useCheerSize(padSize);

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
    setCompletedChars([]);
    setBossHp(BOSS_MAX_HP);
    setPlayerHp(3);
    setMistakes(0);
    setShowHint(false);
    setPadResetKey((k) => k + 1);
    setMorphChar(null);
    setMorphSnapshot(null);
    setPhase('play');
    preloadBossKanjiMasks();
    setFeedback({ message: '', type: null });
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
        padRef.current?.clear();
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
  }, [triggerHit, goNextQuestion]);

  const handleFire = useCallback(async () => {
    if (locked || firingRef.current || !expectedChar || morphChar) return;
    if (!padRef.current?.hasInput()) {
      setFeedback({
        message: useScribble
          ? '✏️ Pencil または指（ゆび）で白い紙に書（か）いてね'
          : '✏️ 白い紙に文字（もじ）を書（か）いてから「打（う）とう！」',
        type: 'info',
      });
      return;
    }

    firingRef.current = true;
    setLocked(true);

    const { ok, writtenChar, snapshot } = await padRef.current.judge(expectedChar);

    if (!ok) {
      const next = mistakes + 1;
      setMistakes(next);
      triggerDeflect(writtenChar || '？');
      padRef.current?.clear();
      padRef.current?.focusPencil();
      setLocked(false);
      firingRef.current = false;
      if (next >= MAX_MISTAKES) {
        failQuestion();
      }
      return;
    }

    setMorphSnapshot(snapshot);
    finishSuccess(expectedChar, charIndex + 1 >= chars.length);
  }, [
    locked,
    expectedChar,
    morphChar,
    mistakes,
    charIndex,
    chars.length,
    useScribble,
    triggerDeflect,
    failQuestion,
    finishSuccess,
  ]);

  useEffect(() => {
    if (phase !== 'play') return;
    const blockSelect = (e: Event) => e.preventDefault();
    document.documentElement.classList.add('boss-no-select');
    document.addEventListener('selectstart', blockSelect);
    return () => {
      document.documentElement.classList.remove('boss-no-select');
      document.removeEventListener('selectstart', blockSelect);
    };
  }, [phase]);

  if (phase === 'intro') {
    return (
      <div className="game-screen kanji-write-screen boss-screen boss-screen--intro">
        <header className="game-header compact">
          <button className="btn-back" onClick={onBack}>← もどる</button>
          <h2>👹 ボス戦</h2>
        </header>
        <div className="boss-intro-stage">
          <img src={BOSS_IMAGE} alt="" className="boss-intro-img" width={320} height={320} />
          <p className="boss-intro-name">もんだい大王（だいおう）</p>
        </div>
        <div className="boss-intro-card">
          <h3>もんだい大王（だいおう）が現（あらわ）れた！</h3>
          <p>名物（めいぶつ）のクイズに答（こた）えて、</p>
          <p>白（しろ）い紙（かみ）に漢字（かんじ）を書（か）いて攻（せ）めよう！</p>
          <ul className="boss-intro-rules">
            <li>📝 <strong>1文字（もじ）ずつ</strong>白い紙（かみ）に書（か）く</li>
            {useScribble ? (
              <>
                <li>✏️ <strong>Pencil</strong> → 活字（かつじ）になる（キーノートと同じ）</li>
                <li>👆 <strong>指（ゆび）</strong> → フリーハンドで書（か）ける</li>
              </>
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

  const cheerText =
    attackFx === 'hit' ? 'やったー！' :
    attackFx === 'deflect' ? 'もう一度！' :
    morphChar ? 'いいね！' :
    feedback.type === 'error' ? 'だいじょうぶ！' :
    'がんばれ！';

  const cheerClass =
    attackFx === 'hit' ? 'boss-cheer--celebrate' :
    attackFx === 'deflect' ? 'boss-cheer--wince' :
    'boss-cheer--idle';

  return (
    <div className="game-screen kanji-write-screen boss-screen boss-screen--play">
      <header className="game-header compact boss-play-header">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>👹 ボス戦</h2>
        <span className="boss-play-qno">Q{qIndex + 1}/{questions.length}</span>
      </header>

      <div className="boss-stage">
        <div className="boss-stage-hearts" aria-label={`体力 ${playerHp}`}>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className={i < playerHp ? 'heart on' : 'heart off'}>❤️</span>
          ))}
        </div>

        <div className="boss-face-wrap">
          <img
            src={BOSS_IMAGE}
            alt=""
            className={`boss-face-img ${bossShake ? 'boss-face--hit' : ''} ${attackFx === 'deflect' ? 'boss-face--block' : ''}`}
            width={320}
            height={320}
          />
          {attackFx && (
            <span className={`boss-bullet boss-bullet--${attackFx}`} aria-hidden>
              {bulletChar}
            </span>
          )}
        </div>

        <div className="boss-stage-hud">
          <div className="boss-hp-row">
            <span className="boss-hp-label">もんだい大王 HP</span>
            <span className="boss-hp-value">{bossHp}</span>
          </div>
          <div className="boss-hp-bar">
            <div className="boss-hp-fill" style={{ width: `${(bossHp / BOSS_MAX_HP) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="boss-battle-panel">
      <div className="boss-quiz-card">
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
            : `今（いま）の1文字（もじ）を書（か）いて「打（う）とう！」`}
        </p>
      </div>

      {(feedback.type === 'success' || feedback.type === 'error') && (
        <FeedbackBanner message={feedback.message} type={feedback.type} />
      )}

      <div
        className="boss-write-row"
        style={{
          '--boss-pad-size': `${padSize}px`,
          '--boss-cheer-size': `${cheerSize}px`,
        } as React.CSSProperties}
      >
        <div className={`boss-cheer-slot ${cheerClass}`}>
          <PlayerAvatar level={avatarLevel} size="cheer" className="boss-cheer-avatar" />
          <p className="boss-cheer-text">{cheerText}</p>
        </div>

        <div className="boss-pad-slot">
          <div className="freehand-pad-wrap" style={{ width: padSize, height: padSize }}>
            {morphChar ? (
              <div className="kanji-morph-stage" style={{ width: padSize, height: padSize }}>
                {morphSnapshot && (
                  <img src={morphSnapshot} alt="" className="kanji-morph-hand" />
                )}
                <KanjiGlyph char={morphChar} size={padSize} className="kanji-morph-glyph" />
              </div>
            ) : (
              <HybridKanjiPad
                ref={padRef}
                size={padSize}
                disabled={locked}
                resetKey={padResetKey}
                scribbleEnabled={useScribble}
              />
            )}
          </div>
        </div>

        <div className="hanzi-actions boss-write-actions">
          <button className="btn-primary boss-fire-btn" type="button" onClick={() => handleFire()} disabled={locked || !!morphChar}>
            🎯 打（う）とう！
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => {
              padRef.current?.clear();
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
      </div>
      </div>
    </div>
  );
}
