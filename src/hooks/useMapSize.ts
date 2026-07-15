import { useEffect, useState, type RefObject } from 'react';

export function useMapSize(containerRef: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 700, height: 520 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  return size;
}
