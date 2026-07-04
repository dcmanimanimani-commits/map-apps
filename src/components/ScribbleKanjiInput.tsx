import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface ScribbleKanjiInputHandle {
  clear: () => void;
  getChar: () => string;
  hasChar: () => boolean;
  focus: () => void;
}

interface ScribbleKanjiInputProps {
  size: number;
  disabled?: boolean;
  resetKey?: number;
}

export const ScribbleKanjiInput = forwardRef<ScribbleKanjiInputHandle, ScribbleKanjiInputProps>(
  function ScribbleKanjiInput({ size, disabled = false, resetKey = 0 }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);

    const getChar = () => inputRef.current?.value.normalize('NFKC').trim() ?? '';

    useImperativeHandle(ref, () => ({
      clear: () => {
        if (inputRef.current) inputRef.current.value = '';
      },
      getChar,
      hasChar: () => getChar().length > 0,
      focus: () => inputRef.current?.focus(),
    }));

    useEffect(() => {
      if (inputRef.current) inputRef.current.value = '';
      if (!disabled) {
        const t = window.setTimeout(() => inputRef.current?.focus(), 80);
        return () => window.clearTimeout(t);
      }
    }, [resetKey, disabled]);

    return (
      <input
        ref={inputRef}
        type="text"
        className="scribble-kanji-input"
        lang="ja"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={1}
        disabled={disabled}
        aria-label="Apple Pencilで漢字を1文字書く"
        style={{ width: size, height: size }}
      />
    );
  },
);
