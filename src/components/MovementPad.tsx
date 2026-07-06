interface MovementPadProps {
  onDirection: (dx: number, dy: number) => void;
  disabled?: boolean;
}

const BTNS: { key: string; dx: number; dy: number; label: string }[] = [
  { key: 'up', dx: 0, dy: -1, label: '↑' },
  { key: 'left', dx: -1, dy: 0, label: '←' },
  { key: 'right', dx: 1, dy: 0, label: '→' },
  { key: 'down', dx: 0, dy: 1, label: '↓' },
];

export function MovementPad({ onDirection, disabled }: MovementPadProps) {
  return (
    <div className="movement-pad" aria-label="移動パッド">
      {BTNS.map(({ key, dx, dy, label }) => (
        <button
          key={key}
          type="button"
          className={`movement-pad-btn movement-pad-btn--${key}`}
          disabled={disabled}
          aria-label={`${key}へ移動`}
          onPointerDown={(e) => {
            e.preventDefault();
            onDirection(dx, dy);
          }}
          onPointerUp={() => onDirection(0, 0)}
          onPointerLeave={() => onDirection(0, 0)}
          onPointerCancel={() => onDirection(0, 0)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
