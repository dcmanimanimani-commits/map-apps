import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface FreehandKanjiPadHandle {
  clear: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  hasInk: () => boolean;
  toDataURL: () => string | null;
}

interface FreehandKanjiPadProps {
  size: number;
  disabled?: boolean;
  resetKey?: number;
  onIdle?: () => void;
}

interface Point {
  x: number;
  y: number;
  pressure: number;
}

export const FreehandKanjiPad = forwardRef<FreehandKanjiPadHandle, FreehandKanjiPadProps>(
  function FreehandKanjiPad({ size, disabled = false, resetKey = 0, onIdle }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const lastPoint = useRef<Point | null>(null);
    const idleTimer = useRef<number | null>(null);
    const onIdleRef = useRef(onIdle);
    onIdleRef.current = onIdle;

    const scheduleIdle = () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        onIdleRef.current?.();
      }, 650);
    };

    const clear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.fillStyle = '#1e3a5f';
      ctx.strokeStyle = '#1e3a5f';
    };

    const hasInk = () => {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < data.length; i += 16) {
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (lum < 220 && data[i + 3] > 20) return true;
      }
      return false;
    };

    useImperativeHandle(ref, () => ({
      clear,
      getCanvas: () => canvasRef.current,
      hasInk,
      toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? null,
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
      ctx.strokeStyle = '#1e3a5f';
      ctx.fillStyle = '#1e3a5f';
      clear();
    }, [size]);

    useEffect(() => () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    }, []);

    const getPoint = (e: React.PointerEvent | PointerEvent): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const pressure = e.pressure > 0 ? e.pressure : 0.55;
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
      const width = 4 + (from.pressure + to.pressure) * 5;
      ctx.lineWidth = width;
      ctx.strokeStyle = '#1e3a5f';
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    };

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      if (e.pointerType === 'touch' && !e.isPrimary) return;
      e.preventDefault();
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      const p = getPoint(e);
      lastPoint.current = p;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        const w = 4 + p.pressure * 5;
        ctx.fillStyle = '#1e3a5f';
        ctx.beginPath();
        ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || disabled) return;
      e.preventDefault();
      const native = e.nativeEvent;
      const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
      for (const ev of events) {
        const p = getPoint(ev);
        if (lastPoint.current) drawLine(lastPoint.current, p);
        lastPoint.current = p;
      }
    };

    const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      drawing.current = false;
      lastPoint.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      scheduleIdle();
    };

    return (
      <canvas
        ref={canvasRef}
        className="freehand-kanji-pad"
        style={{ width: size, height: size, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
        aria-label="白い紙に漢字を1文字書く"
      />
    );
  },
);
