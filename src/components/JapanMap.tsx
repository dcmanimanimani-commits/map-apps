import { useMemo, useRef } from 'react';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { useMapSize } from '../hooks/useMapSize';
import { getRegionColor, getShortKanji, prefectureByKanji } from '../data/prefectures';
import { OKINAWA_KANJI, splitMainlandAndOkinawa } from '../utils/geoTransform';
import {
  createMainlandPathGenerator,
  createOkinawaInsetPathGenerator,
  getFeatureKanji,
  getOkinawaInsetLayout,
  MAINLAND_CLIP_ID,
  OCEAN_GRADIENT_ID,
} from '../utils/geo';

interface JapanMapProps {
  geo: JapanGeoJSON;
  highlightedKanji?: string | null;
  correctKanji?: string | null;
  wrongKanji?: string | null;
  onPrefectureClick?: (kanji: string) => void;
  interactive?: boolean;
  showLabels?: boolean;
}

function MapLabel({
  x,
  y,
  text,
  fontSize,
}: {
  x: number;
  y: number;
  text: string;
  fontSize: number;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={fontSize}
      fill="#ffffff"
      stroke="#000000"
      strokeWidth={fontSize * 0.28}
      paintOrder="stroke"
      textAnchor="middle"
      dominantBaseline="middle"
      pointerEvents="none"
      fontWeight="700"
    >
      {text}
    </text>
  );
}

export function JapanMap({
  geo,
  highlightedKanji = null,
  correctKanji = null,
  wrongKanji = null,
  onPrefectureClick,
  interactive = true,
  showLabels = true,
}: JapanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useMapSize(containerRef);

  const { mainland, okinawa } = useMemo(() => splitMainlandAndOkinawa(geo), [geo]);
  const strokeWidth = Math.max(1.2, width * 0.0025);
  const labelSize = Math.max(8, Math.min(13, width * 0.018));

  const mainlandPaths = useMemo(() => {
    const pathGen = createMainlandPathGenerator(mainland, width, height);
    return mainland.features.map((feature) => {
      const kanji = getFeatureKanji(feature as Feature<Geometry, GeoJsonProperties & { nam_ja?: string }>);
      const d = pathGen(feature as Feature<Geometry, GeoJsonProperties>) ?? null;
      const pref = prefectureByKanji.get(kanji);
      const centroid = d
        ? (pathGen.centroid(feature as Feature<Geometry, GeoJsonProperties>) as [number, number])
        : null;
      return {
        kanji,
        d,
        color: pref ? getRegionColor(pref.region) : '#888',
        shortName: pref ? getShortKanji(pref.kanji) : '',
        centroid,
      };
    });
  }, [mainland, width, height]);

  const okinawaInset = useMemo(() => {
    if (!okinawa) return null;
    const layout = getOkinawaInsetLayout(width, height);
    const pathGen = createOkinawaInsetPathGenerator(okinawa, layout, width, height);
    const d = pathGen(okinawa) ?? null;
    const centroid = d ? (pathGen.centroid(okinawa) as [number, number]) : null;
    return { d, layout, centroid };
  }, [okinawa, width, height]);

  function getFill(kanji: string, baseColor: string): string {
    if (correctKanji === kanji) return '#4ade80';
    if (wrongKanji === kanji) return '#f87171';
    if (highlightedKanji === kanji) return '#fbbf24';
    return baseColor;
  }

  function getOpacity(kanji: string): number {
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
    <div ref={containerRef} className="japan-map-wrapper">
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
        </defs>
        <rect width={width} height={height} fill={`url(#${OCEAN_GRADIENT_ID})`} rx="8" />

        <g className="mainland-layer" clipPath={`url(#${MAINLAND_CLIP_ID})`}>
          {mainlandPaths.map(({ kanji, d, color }) =>
            d ? renderPath(kanji, d, color) : null,
          )}
        </g>

        {okinawaInset && (
          <g className="okinawa-inset-layer">
            {/* 参考地図スタイルのL字区切り線 */}
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

            {showLabels && okinawaInset.centroid && (
              <MapLabel
                x={okinawaInset.centroid[0]}
                y={okinawaInset.centroid[1]}
                text="沖縄"
                fontSize={labelSize}
              />
            )}
          </g>
        )}

        {showLabels &&
          mainlandPaths.map(({ kanji, d, shortName, centroid }) => {
            if (!d || !centroid || !shortName) return null;
            return (
              <MapLabel
                key={`label-${kanji}`}
                x={centroid[0]}
                y={centroid[1]}
                text={shortName}
                fontSize={labelSize}
              />
            );
          })}
      </svg>
    </div>
  );
}
