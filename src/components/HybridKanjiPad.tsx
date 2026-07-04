import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { matchFreehandKanji } from '../utils/kanjiMatch';
import { matchScribbleChar } from '../utils/scribbleMatch';
import { FreehandKanjiPad, type FreehandKanjiPadHandle } from './FreehandKanjiPad';
import { ScribbleKanjiInput, type ScribbleKanjiInputHandle } from './ScribbleKanjiInput';

export type BossWriteMode = 'pencil' | 'finger';

export interface HybridKanjiPadHandle {
  clear: () => void;
  hasInput: () => boolean;
  focusPencil: () => void;
  getWriteMode: () => BossWriteMode;
  judge: (expectedChar: string) => Promise<{ ok: boolean; writtenChar: string; snapshot: string | null }>;
}

interface HybridKanjiPadProps {
  size: number;
  disabled?: boolean;
  resetKey?: number;
  scribbleEnabled: boolean;
}

export const HybridKanjiPad = forwardRef<HybridKanjiPadHandle, HybridKanjiPadProps>(
  function HybridKanjiPad({ size, disabled = false, resetKey = 0, scribbleEnabled }, ref) {
    const canvasRef = useRef<FreehandKanjiPadHandle>(null);
    const scribbleRef = useRef<ScribbleKanjiInputHandle>(null);
    const [writeMode, setWriteMode] = useState<BossWriteMode>('pencil');
    const writeModeRef = useRef(writeMode);
    writeModeRef.current = writeMode;

    const usePencil = scribbleEnabled && writeMode === 'pencil';

    const clear = useCallback(() => {
      canvasRef.current?.clear();
      if (scribbleEnabled) {
        scribbleRef.current?.clear();
      }
    }, [scribbleEnabled]);

    const hasInput = useCallback(() => {
      if (scribbleEnabled && writeModeRef.current === 'pencil') {
        return scribbleRef.current?.hasChar() ?? false;
      }
      return canvasRef.current?.hasInk() ?? false;
    }, [scribbleEnabled]);

    const judge = useCallback(async (expectedChar: string) => {
      if (scribbleEnabled && writeModeRef.current === 'pencil') {
        const writtenChar = scribbleRef.current?.getChar() ?? '';
        return {
          ok: matchScribbleChar(writtenChar, expectedChar),
          writtenChar,
          snapshot: null,
        };
      }
      const canvas = canvasRef.current?.getCanvas();
      if (!canvas) {
        return { ok: false, writtenChar: '', snapshot: null };
      }
      const result = await matchFreehandKanji(canvas, expectedChar);
      return {
        ok: result.ok,
        writtenChar: expectedChar,
        snapshot: canvasRef.current?.toDataURL() ?? null,
      };
    }, [scribbleEnabled]);

    useEffect(() => {
      setWriteMode('pencil');
    }, [resetKey]);

    useImperativeHandle(ref, () => ({
      clear,
      hasInput,
      focusPencil: () => {
        setWriteMode('pencil');
        scribbleRef.current?.focus();
      },
      getWriteMode: () => writeModeRef.current,
      judge,
    }), [clear, hasInput, judge]);

    const handlePointerDown = (e: React.PointerEvent) => {
      if (disabled || !scribbleEnabled) return;
      if (e.pointerType === 'pen') {
        setWriteMode('pencil');
        scribbleRef.current?.focus();
      } else if (e.pointerType === 'touch') {
        setWriteMode('finger');
        scribbleRef.current?.blur();
      }
    };

    return (
      <div
        className="boss-pad-stack"
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
      >
        <div className={`boss-pad-layer ${usePencil ? 'boss-pad-layer--hidden' : ''}`}>
          <FreehandKanjiPad
            ref={canvasRef}
            size={size}
            disabled={disabled || usePencil}
            resetKey={resetKey}
          />
        </div>
        {scribbleEnabled && (
          <div className={`boss-pad-layer ${usePencil ? '' : 'boss-pad-layer--hidden'}`}>
            <ScribbleKanjiInput
              ref={scribbleRef}
              size={size}
              disabled={disabled || !usePencil}
              resetKey={resetKey}
            />
          </div>
        )}
        {scribbleEnabled && !disabled && (
          <p className="boss-pad-mode-hint" aria-live="polite">
            {usePencil ? '✏️ Pencil' : '👆 指（ゆび）'}
          </p>
        )}
      </div>
    );
  },
);
