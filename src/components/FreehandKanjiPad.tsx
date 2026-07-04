import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface FreehandKanjiPadHandle {
  clear: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  hasInk: () => boolean;
}

interface FreehandKanjiPadProps {
  size: number;
  disabled?: boolean;
  resetKey?: number;
}

interface Point {
  x: number;
  y: number;
  pressure: number;
}

export const FreehandKanjiPad = forwardRef<FreehandKanjiPadHandle, FreehandKanjiPadProps>(
  function FreehandKanjiPad({ size, disabled = false, resetKey = 0 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const lastPoint = useRef<Point | null>(null);

    const clear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
    };

    const hasInk = () => {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, size, size).data;
      for (let i = 0; i < data.length; i += 16) {
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (lum < 220) return true;
      }
      return false;
    };

    useImperativeHandle(ref, () => ({
      clear,
      getCanvas: () => canvasRef.current,
      hasInk,
    }));

    useEffect(() => {
      clear();
    }, [resetKey, size]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#312e81';
      clear();
    }, [size]);

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const pressure = e.pressure > 0 ? e.pressure : 0.5;
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure,
      };
    };

    const drawLine = (from: Point, to: Point) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const width = 2.5 + (from.pressure + to.pressure) * 4;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    };

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      const p = getPoint(e);
      lastPoint.current = p;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 2.5 + p.pressure * 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#312e81';
        ctx.fill();
      }
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || disabled) return;
      e.preventDefault();
      const p = getPoint(e);
      if (lastPoint.current) drawLine(lastPoint.current, p);
      lastPoint.current = p;
    };

    const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      drawing.current = false;
      lastPoint.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    };

    return (
      <canvas
        ref={canvasRef}
        className="freehand-kanji-pad"
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
        aria-label="白い紙に漢字を書く"
      />
    );
  },
);
