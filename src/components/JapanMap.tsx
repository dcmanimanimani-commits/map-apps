import { useId, useMemo, useRef, type ReactNode } from 'react';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { useMapSize } from '../hooks/useMapSize';
import { getRegionColor, getShortHiragana, getShortKanji, prefectureByKanji } from '../data/prefectures';
import {
  OKINAWA_KANJI,
  simplifyOkinawaForInset,
  splitMainlandAndOkinawa,
  trimForRegionFocus,
} from '../utils/geoTransform';
import { getPrefectureLabelLayout, getProjectedLargestRing, PREFER_INTERIOR_KANJI, type PlacedPrefectureLabel } from '../utils/mapLabels';
import { ADVENTURE_WORLD_SCALE_W } from '../utils/mapPositions';
import { prefectureCapitalByKanji } from '../data/prefectureCapitals';
import {
  createMainlandPathGenerator,
  createOkinawaFullPathGenerator,
  createOkinawaInsetPathGenerator,
  createRegionFocusPathGenerator,
  getFeatureKanji,
  getOkinawaInsetLayout,
  MAINLAND_CLIP_ID,
  OKINAWA_CLIP_ID,
  OKINAWA_INSET_SCALE_FULL,
  OKINAWA_INSET_SCALE_REGION,
  OCEAN_GRADIENT_ID,
  REGION_LAND_ANCHOR_DEFAULT,
  type RegionLandAnchor,
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
  /** 地方ズーム時の海まわり余白（小さいほど陸地が大きく） */
  regionFocusPadding?: number;
  /** 九州＋沖縄のように本州側と沖縄インセットを両方表示するとき */
  regionFocusReserveOkinawaInset?: boolean;
  /** 陸地重心を合わせる点（0–1）。ラベル中央×地図エリア中央が既定 */
  regionFocusLandAnchor?: RegionLandAnchor;
  /** 地方ごとの微調整オフセット */
  regionFocusOffsetY?: number;
  /** 枠内で陸地をどれだけ拡大するか */
  regionFocusLandFill?: number;
  /** 沖縄インセット用の確保割合 */
  regionFocusOkinawaInsetWidthRatio?: number;
  regionFocusOkinawaInsetHeightRatio?: number;
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
  regionFocusPadding = 2,
  regionFocusReserveOkinawaInset = false,
  regionFocusLandAnchor = REGION_LAND_ANCHOR_DEFAULT,
  regionFocusOffsetY = 0,
  regionFocusLandFill,
  regionFocusOkinawaInsetWidthRatio,
  regionFocusOkinawaInsetHeightRatio,
  renderOverlay,
}: JapanMapProps) {
  const mapInstanceId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const measured = useMapSize(containerRef);
  const width = fixedSize?.width ?? measured.width;
  const height = fixedSize?.height ?? measured.height;

  const isFocused = Boolean(focusKanjiSet && focusKanjiSet.size > 0);
  const { mainland, okinawa } = useMemo(() => splitMainlandAndOkinawa(geo), [geo]);
  const strokeWidth = fixedSize
    ? Math.max(0.35, (width / ADVENTURE_WORLD_SCALE_W) * 0.0016)
    : Math.max(1, width * 0.002);
  const labelFontSize = fixedSize
    ? Math.max(8, Math.min(14, (width / ADVENTURE_WORLD_SCALE_W) * 0.02))
    : Math.max(11, Math.min(15, width * 0.024));
  const insetLabelFontSize = fixedSize
    ? Math.max(8, Math.min(12, (width / ADVENTURE_WORLD_SCALE_W) * 0.018))
    : Math.max(10, Math.min(13, width * 0.02));

  const visibleMainland = useMemo(() => {
    if (!isFocused || !focusKanjiSet) return mainland;
    const focused = {
      type: 'FeatureCollection' as const,
      features: mainland.features.filter((f) =>
        focusKanjiSet.has(getFeatureKanji(f as Feature<Geometry, GeoJsonProperties & { nam_ja?: string }>)),
      ),
    };
    return trimForRegionFocus(focused);
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
      ? createRegionFocusPathGenerator(
        visibleMainland,
        width,
        height,
        regionFocusPadding,
        regionFocusReserveOkinawaInset || (includesOkinawa && hasMainlandFocus),
        regionFocusLandAnchor,
        regionFocusLandFill,
        regionFocusOkinawaInsetWidthRatio,
        regionFocusOkinawaInsetHeightRatio,
      )
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
  }, [
    showOkinawaFull,
    isFocused,
    visibleMainland,
    mainland,
    width,
    height,
    regionFocusPadding,
    regionFocusReserveOkinawaInset,
    includesOkinawa,
    hasMainlandFocus,
    regionFocusLandAnchor,
    regionFocusLandFill,
    regionFocusOkinawaInsetWidthRatio,
    regionFocusOkinawaInsetHeightRatio,
  ]);

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
    const insetScale = includesOkinawa && hasMainlandFocus
      ? (isFocused && regionFocusPadding <= 12 ? 0.5 : OKINAWA_INSET_SCALE_REGION)
      : OKINAWA_INSET_SCALE_FULL;
    const pathGen = createOkinawaInsetPathGenerator(okinawa, layout, width, height, insetScale);
    return {
      d: pathGen(simplified) ?? null,
      layout,
      pathGen,
      simplified,
    };
  }, [showOkinawaInset, okinawa, width, height, includesOkinawa, hasMainlandFocus, isFocused, regionFocusPadding]);

  interface MapLabel {
    kanji: string;
    name: string;
    hiragana: string;
    x: number;
    y: number;
    fontSize: number;
    clip: boolean;
    clipPathId?: string;
  }

  function buildLabel(
    kanji: string,
    feature: Feature<Geometry, GeoJsonProperties>,
    pathGen: ReturnType<typeof createMainlandPathGenerator>,
    pathD: string | null,
    maxFontSize: number,
    otherRings: [number, number][][],
    placedLabels: PlacedPrefectureLabel[],
    mode: 'auto' | 'interior-only' | 'sea-only' = 'auto',
    relaxPlacedCollision = false,
  ): MapLabel | null {
    const pref = prefectureByKanji.get(kanji);
    const name = getShortKanji(kanji);
    const hiragana = pref ? getShortHiragana(kanji, pref.hiragana) : '';
    const capital = prefectureCapitalByKanji.get(kanji);
    const preferInterior = PREFER_INTERIOR_KANJI.has(kanji);

    const layout = getPrefectureLabelLayout(feature, pathGen, name, hiragana, maxFontSize, {
      capital: capital ? { lon: capital.lon, lat: capital.lat } : undefined,
      otherRings,
      placedLabels,
      mode,
      relaxPlacedCollision,
      minInteriorFontSize: preferInterior ? 5 : undefined,
      looseInteriorFit: preferInterior,
    });
    if (!layout) return null;

    const useClip = layout.clip && !(preferInterior && layout.placement === 'interior');

    return {
      kanji,
      name,
      hiragana,
      x: layout.x,
      y: layout.y,
      fontSize: layout.fontSize,
      clip: useClip,
      clipPathId: useClip && pathD ? `pref-clip-${mapInstanceId}-${kanji}` : undefined,
    };
  }

  function buildLabelsForPaths(
    paths: typeof mainlandPaths,
    fontSize: number,
  ): MapLabel[] {
    const ringByKanji = new Map<string, [number, number][]>();
    for (const { kanji, pathGen, feature } of paths) {
      const ring = getProjectedLargestRing(feature, pathGen);
      if (ring) ringByKanji.set(kanji, ring);
    }

    const sorted = [...paths].sort((a, b) => {
      const ringA = ringByKanji.get(a.kanji);
      const ringB = ringByKanji.get(b.kanji);
      const areaA = ringA ? ringAreaEstimate(ringA) : 0;
      const areaB = ringB ? ringAreaEstimate(ringB) : 0;
      return areaB - areaA;
    });

    const placed: PlacedPrefectureLabel[] = [];
    const items: MapLabel[] = [];
    const labeled = new Set<string>();

    const byAreaDesc = [...sorted];
    for (const { kanji, pathGen, feature, d } of byAreaDesc) {
      const otherRings = [...ringByKanji.entries()]
        .filter(([key]) => key !== kanji)
        .map(([, ring]) => ring);
      const preferInterior = PREFER_INTERIOR_KANJI.has(kanji);
      const label = buildLabel(
        kanji,
        feature,
        pathGen,
        d,
        fontSize,
        otherRings,
        placed,
        'interior-only',
        preferInterior,
      );
      if (!label) continue;
      items.push(label);
      labeled.add(kanji);
      placed.push({
        x: label.x,
        y: label.y,
        name: label.name,
        hiragana: label.hiragana,
        fontSize: label.fontSize,
      });
    }

    const byAreaAsc = [...sorted].reverse();
    for (const { kanji, pathGen, feature, d } of byAreaAsc) {
      if (labeled.has(kanji)) continue;
      const otherRings = [...ringByKanji.entries()]
        .filter(([key]) => key !== kanji)
        .map(([, ring]) => ring);
      const preferInterior = PREFER_INTERIOR_KANJI.has(kanji);
      let label = preferInterior
        ? buildLabel(kanji, feature, pathGen, d, fontSize, otherRings, placed, 'interior-only', true)
        : null;
      if (!label) {
        label = buildLabel(kanji, feature, pathGen, d, fontSize, otherRings, placed, 'sea-only');
      }
      if (!label) continue;
      items.push(label);
      labeled.add(kanji);
      placed.push({
        x: label.x,
        y: label.y,
        name: label.name,
        hiragana: label.hiragana,
        fontSize: label.fontSize,
      });
    }

    for (const { kanji, pathGen, feature, d } of sorted) {
      if (labeled.has(kanji)) continue;
      const otherRings = [...ringByKanji.entries()]
        .filter(([key]) => key !== kanji)
        .map(([, ring]) => ring);
      const label = buildLabel(kanji, feature, pathGen, d, fontSize, otherRings, placed, 'auto');
      if (!label) continue;
      items.push(label);
      placed.push({
        x: label.x,
        y: label.y,
        name: label.name,
        hiragana: label.hiragana,
        fontSize: label.fontSize,
      });
    }

    const upgraded: MapLabel[] = [];
    const upgradedPlaced: PlacedPrefectureLabel[] = [];
    for (const label of items) {
      if (label.clip) {
        upgraded.push(label);
        upgradedPlaced.push({
          x: label.x,
          y: label.y,
          name: label.name,
          hiragana: label.hiragana,
          fontSize: label.fontSize,
        });
        continue;
      }

      const pathEntry = paths.find((entry) => entry.kanji === label.kanji);
      if (!pathEntry) {
        upgraded.push(label);
        upgradedPlaced.push({
          x: label.x,
          y: label.y,
          name: label.name,
          hiragana: label.hiragana,
          fontSize: label.fontSize,
        });
        continue;
      }

      const otherRings = [...ringByKanji.entries()]
        .filter(([key]) => key !== label.kanji)
        .map(([, ring]) => ring);
      const preferInterior = PREFER_INTERIOR_KANJI.has(label.kanji);
      const interiorLabel = buildLabel(
        label.kanji,
        pathEntry.feature,
        pathEntry.pathGen,
        pathEntry.d,
        fontSize,
        otherRings,
        upgradedPlaced,
        'interior-only',
        true,
      );

      if (interiorLabel) {
        upgraded.push(interiorLabel);
        upgradedPlaced.push({
          x: interiorLabel.x,
          y: interiorLabel.y,
          name: interiorLabel.name,
          hiragana: interiorLabel.hiragana,
          fontSize: interiorLabel.fontSize,
        });
      } else if (preferInterior) {
        const forcedInterior = buildLabel(
          label.kanji,
          pathEntry.feature,
          pathEntry.pathGen,
          pathEntry.d,
          fontSize,
          otherRings,
          [],
          'interior-only',
          true,
        );
        if (forcedInterior) {
          upgraded.push(forcedInterior);
          upgradedPlaced.push({
            x: forcedInterior.x,
            y: forcedInterior.y,
            name: forcedInterior.name,
            hiragana: forcedInterior.hiragana,
            fontSize: forcedInterior.fontSize,
          });
        } else {
          upgraded.push(label);
          upgradedPlaced.push({
            x: label.x,
            y: label.y,
            name: label.name,
            hiragana: label.hiragana,
            fontSize: label.fontSize,
          });
        }
      } else {
        upgraded.push(label);
        upgradedPlaced.push({
          x: label.x,
          y: label.y,
          name: label.name,
          hiragana: label.hiragana,
          fontSize: label.fontSize,
        });
      }
    }

    return upgraded;
  }

  function ringAreaEstimate(ring: [number, number][]): number {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return (maxX - minX) * (maxY - minY);
  }

  const mainlandLabels = useMemo(() => {
    if (!showPrefectureLabels) return [];

    const items: MapLabel[] = [];

    if (okinawaFullPath) {
      const label = buildLabel(
        OKINAWA_KANJI,
        okinawaFullPath.feature,
        okinawaFullPath.pathGen,
        okinawaFullPath.d,
        labelFontSize,
        [],
        [],
      );
      if (label) items.push(label);
      return items;
    }

    return buildLabelsForPaths(mainlandPaths, labelFontSize);
  }, [showPrefectureLabels, okinawaFullPath, mainlandPaths, labelFontSize, mapInstanceId]);

  const mainlandTransform = useMemo(() => {
    if (!isFocused || mainlandPaths.length === 0) return '';
    if (includesOkinawa && hasMainlandFocus) {
      return regionFocusOffsetY ? `translate(0 ${regionFocusOffsetY})` : '';
    }

    let weightedX = 0;
    let weightedY = 0;
    let totalArea = 0;

    for (const { pathGen, feature } of mainlandPaths) {
      const area = pathGen.area(feature);
      const [cx, cy] = pathGen.centroid(feature);
      if (!isFinite(area) || area <= 0 || !isFinite(cx) || !isFinite(cy)) continue;
      weightedX += cx * area;
      weightedY += cy * area;
      totalArea += area;
    }

    if (totalArea <= 0) return '';
    const centerX = weightedX / totalArea;
    const centerY = weightedY / totalArea;
    const dx = width / 2 - centerX;
    const dy = height / 2 - centerY + regionFocusOffsetY;
    return `translate(${dx} ${dy})`;
  }, [
    isFocused,
    mainlandPaths,
    width,
    height,
    regionFocusOffsetY,
    includesOkinawa,
    hasMainlandFocus,
  ]);

  const insetLabel = useMemo(() => {
    if (!showPrefectureLabels || !okinawaInset || okinawaFullPath) return null;

    const otherRings = mainlandPaths
      .map(({ feature, pathGen }) => getProjectedLargestRing(feature, pathGen))
      .filter((ring): ring is [number, number][] => ring !== null);

    return buildLabel(
      OKINAWA_KANJI,
      okinawaInset.simplified,
      okinawaInset.pathGen,
      okinawaInset.d,
      insetLabelFontSize,
      otherRings,
      [],
    );
  }, [showPrefectureLabels, okinawaInset, okinawaFullPath, insetLabelFontSize, mapInstanceId, mainlandPaths]);

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

  function renderLabels(labels: MapLabel[]) {
    if (labels.length === 0) return null;

    return (
      <g className="prefecture-labels" pointerEvents="none">
        {labels.map(({ kanji, name, hiragana, x, y, fontSize, clipPathId }) => (
          <text
            key={kanji}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            clipPath={clipPathId ? `url(#${clipPathId})` : undefined}
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
          {showPrefectureLabels &&
            mainlandPaths.map(({ kanji, d }) =>
              d ? (
                <clipPath key={`clip-${kanji}`} id={`pref-clip-${mapInstanceId}-${kanji}`}>
                  <path d={d} />
                </clipPath>
              ) : null,
            )}
          {showPrefectureLabels && okinawaFullPath?.d && (
            <clipPath id={`pref-clip-${mapInstanceId}-${OKINAWA_KANJI}`}>
              <path d={okinawaFullPath.d} />
            </clipPath>
          )}
        </defs>
        <rect width={width} height={height} fill={`url(#${OCEAN_GRADIENT_ID})`} rx="8" />

        <g
          className="mainland-layer"
          clipPath={`url(#${MAINLAND_CLIP_ID})`}
          transform={mainlandTransform || undefined}
        >
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
