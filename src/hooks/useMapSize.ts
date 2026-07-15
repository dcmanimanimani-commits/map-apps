import { useEffect, useState, type RefObject } from 'react';

/**
 * コンテナの実サイズを測る。
 * マウント直後に ref が null の場合もあるので、要素が出るまで待ってから観測する。
 */
export function useMapSize(
  containerRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!enabled) {
      setSize({ width: 0, height: 0 });
      return;
    }

    let observer: ResizeObserver | null = null;
    let raf = 0;
    let cancelled = false;

    const attach = () => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) {
        raf = requestAnimationFrame(attach);
        return;
      }

      const update = () => {
        const { width, height } = el.getBoundingClientRect();
        setSize({
          width: Math.max(1, Math.round(width)),
          height: Math.max(1, Math.round(height)),
        });
      };

      update();
      observer = new ResizeObserver(update);
      observer.observe(el);
    };

    attach();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [containerRef, enabled]);

  return size;
}
