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
    const readOnlyRef = useRef(true);
    const [empty, setEmpty] = useState(true);

    const getChar = () => inputRef.current?.value.normalize('NFKC').trim() ?? '';

    const blurInput = () => {
      inputRef.current?.blur();
      readOnlyRef.current = true;
      if (inputRef.current) inputRef.current.readOnly = true;
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        if (inputRef.current) inputRef.current.value = '';
        setEmpty(true);
        blurInput();
      },
      getChar,
      hasChar: () => getChar().length > 0,
      focus: () => {
        const el = inputRef.current;
        if (!el || disabled) return;
        readOnlyRef.current = false;
        el.readOnly = false;
        el.focus({ preventScroll: true });
      },
      blur: blurInput,
    }));

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.readOnly = true;
        readOnlyRef.current = true;
      }
      setEmpty(true);
      blurInput();
    }, [resetKey]);

    useEffect(() => {
      if ('virtualKeyboard' in navigator) {
        try {
          (navigator as Navigator & { virtualKeyboard: { overlaysContent: boolean } }).virtualKeyboard.overlaysContent = true;
        } catch {
          /* ignore */
        }
      }
    }, []);

    const activateForWriting = () => {
      if (disabled) return;
      const el = inputRef.current;
      if (!el) return;
      readOnlyRef.current = false;
      el.readOnly = false;
      el.focus({ preventScroll: true });
    };

    const onInput = () => {
      setEmpty(!getChar());
      window.setTimeout(() => blurInput(), 120);
    };

    return (
      <div
        className="scribble-kanji-wrap"
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          if (disabled) return;
          if (e.pointerType === 'pen' || e.pointerType === 'touch') {
            activateForWriting();
          }
        }}
      >
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
          readOnly
          aria-label="Apple Pencilで漢字を1文字書く。タップしてから書いてね"
          onInput={onInput}
          onBlur={() => {
            readOnlyRef.current = true;
            if (inputRef.current) inputRef.current.readOnly = true;
          }}
          // Safari: ソフトキーボードを自動表示しない
          {...({ virtualkeyboardpolicy: 'manual' } as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        {!disabled && empty && (
          <span className="scribble-kanji-placeholder" aria-hidden>
            タップして書く
          </span>
        )}
      </div>
    );
  },
);
