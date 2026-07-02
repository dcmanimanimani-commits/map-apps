import { useMemo, useRef } from 'react';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { useMapSize } from '../hooks/useMapSize';
import { getRegionColor, prefectureByKanji } from '../data/prefectures';
import { OKINAWA_KANJI, simplifyOkinawaForInset, splitMainlandAndOkinawa } from '../utils/geoTransform';
import {
  createMainlandPathGenerator,
  createOkinawaFullPathGenerator,
  createOkinawaInsetPathGenerator,
  createRegionFocusPathGenerator,
  getFeatureKanji,
  getOkinawaInsetLayout,
  MAINLAND_CLIP_ID,
  OKINAWA_CLIP_ID,
  OCEAN_GRADIENT_ID,
} from '../utils/geo';

interface JapanMapProps {
  geo: JapanGeoJSON;
  highlightedKanji?: string | null;
  correctKanji?: string | null;
  wrongKanji?: string | null;
  activeKanjiSet?: Set<string>;
  /** 指定時はその県のみ表示し、地方にズーム */
  focusKanjiSet?: Set<string>;
  onPrefectureClick?: (kanji: string) => void;
  interactive?: boolean;
}

export function JapanMap({
  geo,
  highlightedKanji = null,
  correctKanji = null,
  wrongKanji = null,
  activeKanjiSet,
  focusKanjiSet,
  onPrefectureClick,
  interactive = true,
}: JapanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useMapSize(containerRef);

  const isFocused = Boolean(focusKanjiSet && focusKanjiSet.size > 0);
  const { mainland, okinawa } = useMemo(() => splitMainlandAndOkinawa(geo), [geo]);
  const strokeWidth = Math.max(1.2, width * 0.0025);

  const visibleMainland = useMemo(() => {
    if (!isFocused || !focusKanjiSet) return mainland;
    return {
      type: 'FeatureCollection' as const,
      features: mainland.features.filter((f) =>
        focusKanjiSet.has(getFeatureKanji(f as Feature<Geometry, GeoJsonProperties & { nam_ja?: string }>)),
      ),
    };
  }, [mainland, focusKanjiSet, isFocused]);

  const showOkinawaFull = isFocused && focusKanjiSet?.has(OKINAWA_KANJI) && okinawa;
  const showOkinawaInset = !isFocused && okinawa;

  const mainlandPaths = useMemo(() => {
    if (showOkinawaFull) return [];

    const source = isFocused ? visibleMainland : mainland;
    if (source.features.length === 0) return [];

    const pathGen = isFocused
      ? createRegionFocusPathGenerator(visibleMainland, width, height)
      : createMainlandPathGenerator(mainland, width, height);

    return source.features.map((feature) => {
      const kanji = getFeatureKanji(feature as Feature<Geometry, GeoJsonProperties & { nam_ja?: string }>);
      const d = pathGen(feature as Feature<Geometry, GeoJsonProperties>) ?? null;
      const pref = prefectureByKanji.get(kanji);
      return {
        kanji,
        d,
        color: pref ? getRegionColor(pref.region) : '#888',
      };
    });
  }, [showOkinawaFull, isFocused, visibleMainland, mainland, width, height]);

  const okinawaFullPath = useMemo(() => {
    if (!showOkinawaFull || !okinawa) return null;
    const pathGen = createOkinawaFullPathGenerator(okinawa, width, height);
    return pathGen(simplifyOkinawaForInset(okinawa)) ?? null;
  }, [showOkinawaFull, okinawa, width, height]);

  const okinawaInset = useMemo(() => {
    if (!showOkinawaInset || !okinawa) return null;
    const layout = getOkinawaInsetLayout(width, height);
    const simplified = simplifyOkinawaForInset(okinawa);
    const pathGen = createOkinawaInsetPathGenerator(okinawa, layout, width, height);
    return { d: pathGen(simplified) ?? null, layout };
  }, [showOkinawaInset, okinawa, width, height]);

  function getFill(kanji: string, baseColor: string): string {
    if (correctKanji === kanji) return '#4ade80';
    if (wrongKanji === kanji) return '#f87171';
    if (highlightedKanji === kanji) return '#fbbf24';
    return baseColor;
  }

  function getOpacity(kanji: string): number {
    if (isFocused) {
      if (highlightedKanji && highlightedKanji !== kanji) return 0.55;
      return 1;
    }
    if (activeKanjiSet && !activeKanjiSet.has(kanji)) return 0.15;
    if (highlightedKanji && highlightedKanji !== kanji) return 0.4;
    return 1;
  }

  function renderPath(kanji: string, d: string, color: string) {
    return (
      <path
        key={kanji}
        d={d}
        fill={getFill(kanji, color)}
        stroke="#ffffff"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fillOpacity={getOpacity(kanji)}
        className={interactive ? 'prefecture-path interactive' : 'prefecture-path'}
        onClick={() => interactive && onPrefectureClick?.(kanji)}
        style={{ cursor: interactive ? 'pointer' : 'default' }}
      >
        <title>{kanji}</title>
      </path>
    );
  }

  return (
    <div ref={containerRef} className={`japan-map-wrapper${isFocused ? ' region-focus' : ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="japan-map"
        role="img"
        aria-label="日本地図"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={OCEAN_GRADIENT_ID} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#3d9fd4" />
            <stop offset="55%" stopColor="#1a7ab5" />
            <stop offset="100%" stopColor="#0c5e94" />
          </linearGradient>
          <clipPath id={MAINLAND_CLIP_ID}>
            <rect x={0} y={0} width={width} height={height} />
          </clipPath>
          {okinawaInset && (
            <clipPath id={OKINAWA_CLIP_ID}>
              <rect
                x={okinawaInset.layout.cornerX}
                y={okinawaInset.layout.cornerY}
                width={width - okinawaInset.layout.cornerX}
                height={height - okinawaInset.layout.cornerY}
              />
            </clipPath>
          )}
        </defs>
        <rect width={width} height={height} fill={`url(#${OCEAN_GRADIENT_ID})`} rx="8" />

        <g className="mainland-layer" clipPath={`url(#${MAINLAND_CLIP_ID})`}>
          {mainlandPaths.map(({ kanji, d, color }) =>
            d ? renderPath(kanji, d, color) : null,
          )}
          {okinawaFullPath &&
            renderPath(OKINAWA_KANJI, okinawaFullPath, getRegionColor('沖縄'))}
        </g>

        {okinawaInset && (
          <g className="okinawa-inset-layer" clipPath={`url(#${OKINAWA_CLIP_ID})`}>
            <path
              d={`M ${okinawaInset.layout.cornerX} ${height} L ${okinawaInset.layout.cornerX} ${okinawaInset.layout.cornerY} L ${width} ${okinawaInset.layout.cornerY}`}
              fill="none"
              stroke="#ffffff"
              strokeWidth={strokeWidth * 1.2}
              pointerEvents="none"
            />

            {okinawaInset.d &&
              renderPath(
                OKINAWA_KANJI,
                okinawaInset.d,
                getRegionColor('沖縄'),
              )}
          </g>
        )}
      </svg>
    </div>
  );
}
