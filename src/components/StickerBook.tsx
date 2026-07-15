import { useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import {
  STICKERS_PER_PAGE,
  getStickerById,
  getStickerForPageSlot,
  hasRewardMilestone,
  isRewardMilestoneSlot,
} from '../data/stickers';

interface StickerBookProps {
  onBack: () => void;
}

export function StickerBook({ onBack }: StickerBookProps) {
  const { activePlayer } = usePlayer();
  const earnedIds = activePlayer?.progress.earnedStickerIds ?? [];
  const count = earnedIds.length;

  const slots = useMemo(() => {
    return Array.from({ length: STICKERS_PER_PAGE }, (_, index) => {
      const slot = index + 1;
      const sticker = getStickerForPageSlot(slot);
      // 左上→右→次の行、と獲得枚数ぶんだけ埋まる
      const earned = slot <= count;
      const milestone = isRewardMilestoneSlot(slot) ? slot : null;
      const rewardUnlocked = milestone ? hasRewardMilestone(earnedIds, milestone) : false;

      return { slot, sticker, earned, milestone, rewardUnlocked };
    });
  }, [count, earnedIds]);

  return (
    <div className="game-screen sticker-book-screen">
      <header className="game-header compact sticker-book-header">
        <button type="button" className="btn-back" onClick={onBack}>← ホーム</button>
        <h2>📒 シール帳</h2>
      </header>

      <div className="sticker-book-player compact">
        {activePlayer ? (
          <span><strong>{activePlayer.name}</strong> · {count}/25まい</span>
        ) : (
          <span>ぷれいやーを選んでね</span>
        )}
      </div>

      <p className="sticker-book-lead">地方べんきょうでシールを集めよう</p>

      <div className="sticker-book-page">
        <div className="sticker-grid">
          {slots.map(({ slot, sticker, earned, milestone, rewardUnlocked }) => (
            <div
              key={`slot-${slot}`}
              className={`sticker-cell ${earned ? 'earned' : 'locked'} ${sticker?.style ?? ''} ${milestone ? 'milestone' : ''}`}
              title={sticker?.name}
            >
              {earned && sticker ? (
                <img src={sticker.image} alt={sticker.name} className="sticker-image" />
              ) : (
                <span className="sticker-placeholder">{sticker?.style === 'cool' ? '☆' : '♡'}</span>
              )}
              {milestone && rewardUnlocked && (
                <span className="reward-stamp-badge" aria-label={`${milestone}まいごほうび`}>
                  ごほうび
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="sticker-book-hint">
        クリアするたび左からシールが増えるよ（同じ地方でもOK）。5・10・15・20・25まい目にごほうびスタンプ！
      </p>
    </div>
  );
}

export function StickerPreview({ stickerId }: { stickerId: string }) {
  const sticker = getStickerById(stickerId);
  if (!sticker) return null;
  return (
    <div className="sticker-preview">
      <img src={sticker.image} alt={sticker.name} className="sticker-image lg" />
      <p className="sticker-preview-name">シールゲット！ {sticker.name}</p>
    </div>
  );
}
