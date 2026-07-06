import type { CharDirection, CharStep } from '../utils/characterSprites';

interface MapCharacterSpriteProps {
  x: number;
  y: number;
  size: number;
  imageSrc: string;
  direction: CharDirection;
  step: CharStep;
  className?: string;
  label?: string;
}

export function MapCharacterSprite({
  x,
  y,
  size,
  imageSrc,
  direction,
  step,
  className = '',
  label,
}: MapCharacterSpriteProps) {
  const moving = step !== 'idle';

  return (
    <div
      className={`map-char ${moving ? 'map-char--moving' : ''} map-char--${direction} map-char--${step} ${className}`.trim()}
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
      }}
      aria-hidden={!label}
      title={label}
    >
      <img src={imageSrc} alt="" className="map-char-img" draggable={false} />
    </div>
  );
}
