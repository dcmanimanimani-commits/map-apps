import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface ScribbleKanjiInputHandle {
  clear: () => void;
  getChar: () => string;
  hasChar: () => boolean;
  focus: () => void;
  blur: () => void;
}

interface ScribbleKanjiInputProps {
  size: number;
  disabled?: boolean;
  resetKey?: number;
}

export const ScribbleKanjiInput = forwardRef<ScribbleKanjiInputHandle, ScribbleKanjiInputProps>(
  function ScribbleKanjiInput({ size, disabled = false, resetKey = 0 }, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [empty, setEmpty] = useState(true);

    const getChar = () => inputRef.current?.value.normalize('NFKC').trim() ?? '';

    const focusInput = () => {
      const el = inputRef.current;
      if (!el || disabled) return;
      el.focus({ preventScroll: true });
    };

    const blurInput = () => {
      inputRef.current?.blur();
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        if (inputRef.current) inputRef.current.value = '';
        setEmpty(true);
        focusInput();
      },
      getChar,
      hasChar: () => getChar().length > 0,
      focus: focusInput,
      blur: blurInput,
    }));

    useEffect(() => {
      if (inputRef.current) inputRef.current.value = '';
      setEmpty(true);
      if (!disabled) {
        const t = window.setTimeout(focusInput, 60);
        return () => window.clearTimeout(t);
      }
    }, [resetKey, disabled]);

    useEffect(() => {
      if ('virtualKeyboard' in navigator) {
        try {
          (navigator as Navigator & { virtualKeyboard: { overlaysContent: boolean } }).virtualKeyboard.overlaysContent = true;
        } catch {
          /* ignore */
        }
      }
    }, []);

    const onInput = () => {
      setEmpty(!getChar());
      // 活字になったらメニューを閉じる（次の文字は auto-focus で即書ける）
      window.setTimeout(blurInput, 120);
    };

    return (
      <div className="scribble-kanji-wrap" style={{ width: size, height: size }}>
        <input
          ref={inputRef}
          type="text"
          className="scribble-kanji-input"
          lang="ja"
          inputMode="none"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={1}
          disabled={disabled}
          aria-label="Apple Pencilで漢字を1文字書く"
          onInput={onInput}
          onPointerDown={() => {
            if (!disabled) focusInput();
          }}
          {...({ virtualkeyboardpolicy: 'manual' } as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        {!disabled && empty && (
          <span className="scribble-kanji-placeholder" aria-hidden>
            Pencilで書く
          </span>
        )}
      </div>
    );
  },
);
