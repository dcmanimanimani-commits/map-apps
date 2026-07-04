import { useEffect, useState } from 'react';

interface KanjiGlyphProps {
  char: string;
  size: number;
  className?: string;
}

export function KanjiGlyph({ char, size, className }: KanjiGlyphProps) {
  const [strokes, setStrokes] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStrokes(null);
    fetch(`/kanji-data/${encodeURIComponent(char)}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.strokes) setStrokes(data.strokes as string[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [char]);

  if (!strokes) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <g transform="scale(1,-1) translate(0,-900)">
        {strokes.map((stroke, i) => (
          <path key={i} d={stroke} fill="#1e3a5f" />
        ))}
      </g>
    </svg>
  );
}
