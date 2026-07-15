import { useEffect, useState } from 'react';
import type { CharDirection, CharStep } from '../utils/characterSprites';

interface MapCharacterSpriteProps {
  x?: number;
  y?: number;
  size: number;
  imageSrc: string;
  fallbackSrc?: string;
  direction: CharDirection;
  step: CharStep;
  className?: string;
  label?: string;
  interactive?: boolean;
  /** world = 地図座標 / viewport-center = 画面中央固定（カメラ追従用） */
  layout?: 'world' | 'viewport-center';
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function MapCharacterSprite({
  x = 0,
  y = 0,
  size,
  imageSrc,
  fallbackSrc,
  direction,
  step,
  className = '',
  label,
  interactive = false,
  layout = 'world',
  onPointerDown,
}: MapCharacterSpriteProps) {
  const moving = step !== 'idle';
  const [resolvedSrc, setResolvedSrc] = useState(imageSrc);
  const pinned = layout === 'viewport-center';

  useEffect(() => {
    setResolvedSrc(imageSrc);
  }, [imageSrc]);

  return (
    <div
      className={`map-char ${moving ? 'map-char--moving' : ''} map-char--${direction} map-char--${step} ${interactive ? 'map-char--interactive' : ''} ${pinned ? 'map-char--viewport-center' : ''} ${className}`.trim()}
      style={
        pinned
          ? { width: size, height: size }
          : {
              left: x,
              top: y,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
            }
      }
      aria-hidden={!label}
      title={label}
      onPointerDown={interactive ? onPointerDown : undefined}
    >
      <img
        src={resolvedSrc}
        alt=""
        className="map-char-img"
        draggable={false}
        onError={() => {
          if (fallbackSrc && resolvedSrc !== fallbackSrc) {
            setResolvedSrc(fallbackSrc);
          }
        }}
      />
    </div>
  );
}
