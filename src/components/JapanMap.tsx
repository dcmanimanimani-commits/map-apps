import { useMemo, useRef, type ReactNode } from 'react';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { useMapSize } from '../hooks/useMapSize';
import { getRegionColor, getShortHiragana, getShortKanji, prefectureByKanji } from '../data/prefectures';
import { OKINAWA_KANJI, simplifyOkinawaForInset, splitMainlandAndOkinawa } from '../utils/geoTransform';
import {
  createMainlandPathGenerator,
  createOkinawaFullPathGenerator,
  createOkinawaInsetPathGenerator,
  createRegionFocusPathGenerator,
  getFeatureKanji,
  getOkinawaInsetLayout,
  getProjectedCentroid,
  MAINLAND_CLIP_ID,
  OKINAWA_CLIP_ID,
  OKINAWA_INSET_SCALE_FULL,
  OKINAWA_INSET_SCALE_REGION,
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
  /** 地方ズーム時に県名ラベルを表示 */
  showPrefectureLabels?: boolean;
  onPrefectureClick?: (kanji: string) => void;
  interactive?: boolean;
  /** ワールド座標用の固定サイズ（たんけんモードなど） */
  fixedSize?: { width: number; height: number };
  renderOverlay?: (size: { width: number; height: number }) => ReactNode;
}

export function JapanMap({
  geo,
  highlightedKanji = null,
  correctKanji = null,
  wrongKanji = null,
  activeKanjiSet,
  focusKanjiSet,
  showPrefectureLabels = false,
  onPrefectureClick,
  interactive = true,
  fixedSize,
  renderOverlay,
}: JapanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measured = useMapSize(containerRef);
  const width = fixedSize?.width ?? measured.width;
  const height = fixedSize?.height ?? measured.height;

  const isFocused = Boolean(focusKanjiSet && focusKanjiSet.size > 0);
  const { mainland, okinawa } = useMemo(() => splitMainlandAndOkinawa(geo), [geo]);
  const strokeWidth = fixedSize
    ? Math.max(0.35, (width / 6.5) * 0.0016)
    : Math.max(1, width * 0.002);
  const labelFontSize = Math.max(11, Math.min(15, width * 0.024));
  const insetLabelFontSize = Math.max(10, Math.min(13, width * 0.02));

  const visibleMainland = useMemo(() => {
    if (!isFocused || !focusKanjiSet) return mainland;
    return {
      type: 'FeatureCollection' as const,
      features: mainland.features.filter((f) =>
        focusKanjiSet.has(getFeatureKanji(f as Feature<Geometry, GeoJsonProperties & { nam_ja?: string }>)),
      ),
    };
  }, [mainland, focusKanjiSet, isFocused]);

  const hasMainlandFocus = visibleMainland.features.length > 0;
  const includesOkinawa = Boolean(isFocused && focusKanjiSet?.has(OKINAWA_KANJI));

  const showOkinawaFull = includesOkinawa && okinawa && !hasMainlandFocus;
  const showOkinawaInset = Boolean(
    okinawa && ((!isFocused) || (includesOkinawa && hasMainlandFocus)),
  );

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
        pathGen,
        feature: feature as Feature<Geometry, GeoJsonProperties>,
      };
    });
  }, [showOkinawaFull, isFocused, visibleMainland, mainland, width, height]);

  const okinawaFullPath = useMemo(() => {
    if (!showOkinawaFull || !okinawa) return null;
    const pathGen = createOkinawaFullPathGenerator(okinawa, width, height);
    return {
      d: pathGen(simplifyOkinawaForInset(okinawa)) ?? null,
      pathGen,
      feature: simplifyOkinawaForInset(okinawa),
    };
  }, [showOkinawaFull, okinawa, width, height]);

  const okinawaInset = useMemo(() => {
    if (!showOkinawaInset || !okinawa) return null;
    const layout = getOkinawaInsetLayout(width, height);
    const simplified = simplifyOkinawaForInset(okinawa);
    const insetScale =
      includesOkinawa && hasMainlandFocus ? OKINAWA_INSET_SCALE_REGION : OKINAWA_INSET_SCALE_FULL;
    const pathGen = createOkinawaInsetPathGenerator(okinawa, layout, width, height, insetScale);
    return {
      d: pathGen(simplified) ?? null,
      layout,
      pathGen,
      simplified,
    };
  }, [showOkinawaInset, okinawa, width, height, includesOkinawa, hasMainlandFocus]);

  function buildLabel(kanji: string, x: number, y: number, fontSize = labelFontSize) {
    const pref = prefectureByKanji.get(kanji);
    return {
      kanji,
      name: getShortKanji(kanji),
      hiragana: pref ? getShortHiragana(kanji, pref.hiragana) : '',
      x,
      y,
      fontSize,
    };
  }

  const mainlandLabels = useMemo(() => {
    if (!showPrefectureLabels || !isFocused) return [];

    const items: ReturnType<typeof buildLabel>[] = [];

    if (okinawaFullPath) {
      const point = getProjectedCentroid(okinawaFullPath.feature, okinawaFullPath.pathGen);
      if (point) items.push(buildLabel(OKINAWA_KANJI, point[0], point[1]));
      return items;
    }

    for (const { kanji, pathGen, feature } of mainlandPaths) {
      const point = getProjectedCentroid(feature, pathGen);
      if (!point) continue;
      items.push(buildLabel(kanji, point[0], point[1]));
    }

    return items;
  }, [showPrefectureLabels, isFocused, okinawaFullPath, mainlandPaths, labelFontSize]);

  const insetLabel = useMemo(() => {
    if (!showPrefectureLabels || !okinawaInset || !includesOkinawa) return null;
    if (okinawaFullPath) return null;

    const point = getProjectedCentroid(okinawaInset.simplified, okinawaInset.pathGen);
    if (!point) return null;

    return buildLabel(OKINAWA_KANJI, point[0], point[1], insetLabelFontSize);
  }, [showPrefectureLabels, okinawaInset, includesOkinawa, okinawaFullPath, insetLabelFontSize]);

  function getFill(kanji: string, baseColor: string): string {
    if (correctKanji === kanji) return '#4ade80';
    if (wrongKanji === kanji) return '#f87171';
    if (highlightedKanji === kanji) return '#fbbf24';
    return baseColor;
  }

  function getOpacity(kanji: string): number {
    if (isFocused && showPrefectureLabels) {
      if (highlightedKanji && highlightedKanji !== kanji) return 0.85;
      return 1;
    }
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

  function renderLabels(labels: ReturnType<typeof buildLabel>[]) {
    if (labels.length === 0) return null;

    return (
      <g className="prefecture-labels" pointerEvents="none">
        {labels.map(({ kanji, name, hiragana, x, y, fontSize }) => (
          <text
            key={kanji}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className={highlightedKanji === kanji ? 'prefecture-label-group highlighted' : 'prefecture-label-group'}
          >
            <tspan
              x={x}
              dy="-0.55em"
              className="prefecture-label-kanji"
              fontSize={fontSize}
              fontWeight={highlightedKanji === kanji ? 800 : 700}
            >
              {name}
            </tspan>
            <tspan
              x={x}
              dy="1.15em"
              className="prefecture-label-hiragana"
              fontSize={fontSize}
              fontWeight={highlightedKanji === kanji ? 800 : 700}
            >
              {hiragana}
            </tspan>
          </text>
        ))}
      </g>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`japan-map-wrapper${isFocused ? ' region-focus' : ''}${fixedSize ? ' japan-map-wrapper--fixed' : ''}`}
      style={fixedSize ? { width: fixedSize.width, height: fixedSize.height } : undefined}
    >
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
          {okinawaFullPath?.d &&
            renderPath(OKINAWA_KANJI, okinawaFullPath.d, getRegionColor('九州'))}
          {renderLabels(mainlandLabels)}
        </g>

        {okinawaInset && (
          <g className="okinawa-inset-layer" clipPath={`url(#${OKINAWA_CLIP_ID})`}>
            <path
              d={`M ${okinawaInset.layout.cornerX} ${height} L ${okinawaInset.layout.cornerX} ${okinawaInset.layout.cornerY} L ${width} ${okinawaInset.layout.cornerY}`}
              fill="none"
              stroke="#ffffff"
              strokeWidth={fixedSize ? strokeWidth : strokeWidth * 1.2}
              pointerEvents="none"
            />

            {okinawaInset.d &&
              renderPath(
                OKINAWA_KANJI,
                okinawaInset.d,
                getRegionColor('九州'),
              )}
            {insetLabel && renderLabels([insetLabel])}
          </g>
        )}
      </svg>
      {renderOverlay?.({ width, height })}
    </div>
  );
}
