import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { useMapSize } from '../hooks/useMapSize';
import { prefectures, type Prefecture } from '../data/prefectures';
import { getLandmarkSpots } from '../data/landmarkDetails';
import { usePlayer } from '../context/PlayerContext';
import { BOSS_IMAGE, type AvatarLevel } from '../data/characterAssets';
import { resolveAvatarLevel } from '../data/progress';
import { AdventureAvatarSelect } from './AdventureAvatarSelect';
import {
  buildPrefectureCapitalPositions,
  buildWorldSize,
  clampToMap,
  clientToWorld,
  getCamera,
  mapDistance,
  moveToward,
  pickBossAndMinionSpawns,
  readViewportSize,
  type MapPoint,
} from '../utils/mapPositions';
import {
  directionFromVector,
  getAvatarFallbackSrc,
  getMinionSpriteSrc,
  getOniSpriteSrc,
  type CharDirection,
  type CharStep,
} from '../utils/characterSprites';
import { JapanMap } from './JapanMap';
import { MapCharacterSprite } from './MapCharacterSprite';
import { PlayerStatus } from './PlayerStatus';

interface AvatarAdventureGameProps {
  geo: JapanGeoJSON;
  onBack: () => void;
}

type Phase = 'pick-avatar' | 'intro' | 'play' | 'win' | 'lose';
type PlayIntro = 'goal-reveal' | 'oni-reveal' | 'playing';

const ONI_SPEED = 5.4;
const MINION_COUNT = 10;
/** 小さい鬼は大王よりゆっくり（とことこ） */
const MINION_SPEEDS = [2.88, 3.12, 3.36, 3.6, 3.84, 4.08, 4.32, 4.56, 4.8, 5.04] as const;
const ONI_INTRO_MS = 1000;
const GOAL_REVEAL_MS = 8000;
const ARRIVE_RADIUS = 34;
const CATCH_RADIUS = 34;
const CHAR_SIZE_BASE = 152;
const ONI_SIZE_BASE = 184;
const MINION_SIZE_BASE = 96;
/** 指の目標位置へ向かう速さ（小さいほどゆっくり） */
const PLAYER_FOLLOW_RATE = 0.036125;

function adventureSpriteScale(viewW: number): number {
  if (viewW > 0 && viewW < 430) return 0.52;
  if (viewW < 700) return 0.7;
  return 1;
}

const START_EXCLUDED_KANJI = new Set(['北海道', '沖縄県']);
const START_REGIONS = new Set(['東北', '関東', '中部', '近畿', '中国', '四国', '九州']);

function isMainlandStartPrefecture(pref: Prefecture): boolean {
  if (START_EXCLUDED_KANJI.has(pref.kanji)) return false;
  return START_REGIONS.has(pref.region);
}

function maxCapitalDistance(capitals: Map<string, MapPoint>): number {
  const points = [...capitals.values()];
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(max, mapDistance(points[i], points[j]));
    }
  }
  return max;
}

/** 出発地と目的地の距離が十分離れるよう選ぶ（最大距離の一定割合以上） */
const MIN_START_GOAL_DIST_RATIO = 0.5;

function pickStartAndGoal(capitals: Map<string, MapPoint>): {
  start: Prefecture;
  goal: Prefecture;
  startPos: MapPoint;
  goalPos: MapPoint;
} {
  const available = prefectures.filter((p) => capitals.has(p.kanji));
  const startPool = available.filter(isMainlandStartPrefecture);
  const maxDist = maxCapitalDistance(capitals);

  const collectPairs = (minRatio: number) => {
    const minDist = maxDist * minRatio;
    const pairs: {
      start: Prefecture;
      goal: Prefecture;
      startPos: MapPoint;
      goalPos: MapPoint;
      dist: number;
    }[] = [];

    for (const goal of available) {
      const goalPos = capitals.get(goal.kanji)!;
      for (const start of startPool) {
        if (start.kanji === goal.kanji) continue;
        const startPos = capitals.get(start.kanji)!;
        const dist = mapDistance(startPos, goalPos);
        if (dist >= minDist) {
          pairs.push({ start, goal, startPos, goalPos, dist });
        }
      }
    }
    return pairs;
  };

  const farPairs = collectPairs(MIN_START_GOAL_DIST_RATIO);
  const pool = farPairs.length > 0 ? farPairs : collectPairs(0.35);
  if (pool.length > 0) {
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return {
      start: picked.start,
      goal: picked.goal,
      startPos: picked.startPos,
      goalPos: picked.goalPos,
    };
  }

  let best: {
    start: Prefecture;
    goal: Prefecture;
    startPos: MapPoint;
    goalPos: MapPoint;
    dist: number;
  } | null = null;

  for (const goal of available) {
    const goalPos = capitals.get(goal.kanji)!;
    for (const start of startPool) {
      if (start.kanji === goal.kanji) continue;
      const startPos = capitals.get(start.kanji)!;
      const dist = mapDistance(startPos, goalPos);
      if (!best || dist > best.dist) {
        best = { start, goal, startPos, goalPos, dist };
      }
    }
  }

  const fallback = best ?? {
    start: startPool[0],
    goal: available.find((p) => p.kanji !== startPool[0].kanji)!,
    startPos: capitals.get(startPool[0].kanji)!,
    goalPos: capitals.get(available.find((p) => p.kanji !== startPool[0].kanji)!.kanji)!,
  };

  return {
    start: fallback.start,
    goal: fallback.goal,
    startPos: fallback.startPos,
    goalPos: fallback.goalPos,
  };
}

function goalRegionLabel(region: string): string {
  return region === '北海道' ? '北海道' : `${region}地方`;
}

function stepFromMotion(moving: boolean, frame: number): CharStep {
  if (!moving) return 'idle';
  return frame % 2 === 0 ? 'rightFoot' : 'leftFoot';
}

export function AvatarAdventureGame({ geo, onBack }: AvatarAdventureGameProps) {
  const { activePlayer } = usePlayer();
  const defaultAvatar = activePlayer ? resolveAvatarLevel(activePlayer.progress) : 1;

  const [phase, setPhase] = useState<Phase>('pick-avatar');
  const [chosenAvatar, setChosenAvatar] = useState<AvatarLevel>(defaultAvatar);
  const [pendingStart, setPendingStart] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { width: viewW, height: viewH } = useMapSize(viewportRef);
  const worldSize = useMemo(
    () => (viewW >= 200 ? buildWorldSize(viewW, viewH) : { width: 0, height: 0 }),
    [viewW, viewH],
  );

  const [startPref, setStartPref] = useState<Prefecture | null>(null);
  const [goalPref, setGoalPref] = useState<Prefecture | null>(null);
  const [playerPos, setPlayerPos] = useState<MapPoint>({ x: 350, y: 260 });
  const [oniPos, setOniPos] = useState<MapPoint | null>(null);
  const [minionPositions, setMinionPositions] = useState<MapPoint[]>([]);
  const [oniActive, setOniActive] = useState(false);
  const [oniIntro, setOniIntro] = useState(false);
  const [playIntro, setPlayIntro] = useState<PlayIntro>('playing');
  const [cinematicCamera, setCinematicCamera] = useState<MapPoint>({ x: 0, y: 0 });
  const [animFrame, setAnimFrame] = useState(0);
  const [isMoving, setIsMoving] = useState(false);

  const pointerRef = useRef({
    active: false,
    clientX: 0,
    clientY: 0,
    grabOffsetX: 0,
    grabOffsetY: 0,
  });
  const playerPosRef = useRef(playerPos);
  const oniPosRef = useRef<MapPoint | null>(null);
  const minionPosRef = useRef<MapPoint[]>([]);
  const oniActiveRef = useRef(false);
  const oniChasePausedRef = useRef(false);
  const playIntroRef = useRef<PlayIntro>('playing');
  const cinematicCameraRef = useRef<MapPoint>({ x: 0, y: 0 });
  const cinematicTargetRef = useRef<MapPoint>({ x: 0, y: 0 });
  const goalPosRef = useRef<MapPoint>({ x: 0, y: 0 });
  const phaseRef = useRef<Phase>('pick-avatar');
  const lastDirRef = useRef<CharDirection>('down');
  const worldSizeRef = useRef(worldSize);
  const viewSizeRef = useRef({ width: viewW, height: viewH });
  const geoRef = useRef(geo);

  playerPosRef.current = playerPos;
  oniPosRef.current = oniPos;
  minionPosRef.current = minionPositions;
  oniActiveRef.current = oniActive;
  playIntroRef.current = playIntro;
  phaseRef.current = phase;
  worldSizeRef.current = worldSize;
  viewSizeRef.current = { width: viewW, height: viewH };

  const capitals = useMemo(() => {
    if (worldSize.width < 200) return new Map<string, MapPoint>();
    return buildPrefectureCapitalPositions(geo, worldSize.width, worldSize.height);
  }, [geo, worldSize.width, worldSize.height]);

  const capitalsRef = useRef(capitals);
  capitalsRef.current = capitals;

  const capitalMarkerSize = useMemo(() => {
    if (viewW < 200) return Math.round(26 * 0.8);
    return Math.round(Math.max(24, Math.min(42, viewW * 0.058)) * 0.8);
  }, [viewW]);

  const spriteScale = useMemo(() => adventureSpriteScale(viewW), [viewW]);
  const charSize = Math.round(CHAR_SIZE_BASE * spriteScale);
  const oniSize = Math.round(ONI_SIZE_BASE * spriteScale);
  const minionSize = Math.round(MINION_SIZE_BASE * spriteScale);

  const goalLandmarkSpots = useMemo(
    () => (goalPref ? getLandmarkSpots(goalPref.kanji) : []),
    [goalPref],
  );

  const displayCamera = useMemo(() => {
    if (playIntro === 'playing') {
      // 実測サイズで中央固定（useMapSizeのズレを防ぐ）
      const live = readViewportSize(viewportRef.current);
      const vw = live.width > 1 ? live.width : viewW;
      const vh = live.height > 1 ? live.height : viewH;
      return getCamera(playerPos, vw, vh, worldSize.width, worldSize.height);
    }
    return cinematicCamera;
  }, [playIntro, playerPos, cinematicCamera, viewW, viewH, worldSize.width, worldSize.height]);

  const getActiveCamera = useCallback(() => {
    if (playIntroRef.current === 'playing') {
      const live = readViewportSize(viewportRef.current);
      const fallback = viewSizeRef.current;
      const vw = live.width > 1 ? live.width : fallback.width;
      const vh = live.height > 1 ? live.height : fallback.height;
      const { width: ww, height: wh } = worldSizeRef.current;
      return getCamera(playerPosRef.current, vw, vh, ww, wh);
    }
    return cinematicCameraRef.current;
  }, []);

  worldSizeRef.current = worldSize;
  viewSizeRef.current = { width: viewW, height: viewH };
  geoRef.current = geo;

  const prepareOniSpawns = useCallback(() => {
    const { width: ww, height: wh } = worldSizeRef.current;
    const { width: vw, height: vh } = viewSizeRef.current;
    if (ww < 200 || capitalsRef.current.size === 0) return;

    const { boss: bossSpawn, minions: minionSpawns } = pickBossAndMinionSpawns(
      MINION_COUNT,
      playerPosRef.current,
      geoRef.current,
      ww,
      wh,
      vw,
      vh,
      capitalsRef.current,
    );
    setOniPos(bossSpawn);
    oniPosRef.current = bossSpawn;
    setMinionPositions(minionSpawns);
    minionPosRef.current = minionSpawns;
    setOniActive(true);
    oniActiveRef.current = true;
  }, []);

  const initRound = useCallback(() => {
    const { start, goal, startPos, goalPos: goalSpot } = pickStartAndGoal(capitals);
    const live = readViewportSize(viewportRef.current);
    const fallback = viewSizeRef.current;
    const vw = live.width > 1 ? live.width : fallback.width;
    const vh = live.height > 1 ? live.height : fallback.height;
    const { width: ww, height: wh } = worldSizeRef.current;
    setStartPref(start);
    setGoalPref(goal);
    goalPosRef.current = goalSpot;
    setPlayerPos(startPos);
    playerPosRef.current = startPos;
    setOniPos(null);
    oniPosRef.current = null;
    setMinionPositions([]);
    minionPosRef.current = [];
    setOniActive(false);
    oniActiveRef.current = false;
    setOniIntro(false);
    oniChasePausedRef.current = true;
    setAnimFrame(0);
    setIsMoving(false);
    pointerRef.current = {
      active: false,
      clientX: 0,
      clientY: 0,
      grabOffsetX: 0,
      grabOffsetY: 0,
    };

    const startCam = getCamera(startPos, vw, vh, ww, wh);
    const goalCam = getCamera(goalSpot, vw, vh, ww, wh);
    cinematicCameraRef.current = startCam;
    cinematicTargetRef.current = goalCam;
    setCinematicCamera(startCam);
    setPlayIntro('goal-reveal');
    playIntroRef.current = 'goal-reveal';
  }, [capitals]);

  const applyPointerToPlayer = useCallback(() => {
    const ptr = pointerRef.current;
    if (!ptr.active) return false;

    const el = viewportRef.current;
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const { width: ww, height: wh } = worldSizeRef.current;
    const cam = getActiveCamera();
    const touch = clientToWorld(ptr.clientX, ptr.clientY, rect, cam);
    const before = playerPosRef.current;
    const targetX = touch.x - ptr.grabOffsetX;
    const targetY = touch.y - ptr.grabOffsetY;
    const nextPlayer = clampToMap(
      {
        x: before.x + (targetX - before.x) * PLAYER_FOLLOW_RATE,
        y: before.y + (targetY - before.y) * PLAYER_FOLLOW_RATE,
      },
      ww,
      wh,
    );

    const dx = nextPlayer.x - before.x;
    const dy = nextPlayer.y - before.y;

    playerPosRef.current = nextPlayer;
    if (dx !== 0 || dy !== 0) {
      setPlayerPos(nextPlayer);
      lastDirRef.current = directionFromVector(dx, dy);
    }
    setIsMoving(true);
    return true;
  }, [getActiveCamera]);

  const worldPointFromClient = useCallback((clientX: number, clientY: number) => {
    const el = viewportRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cam = getActiveCamera();
    return clientToWorld(clientX, clientY, rect, cam);
  }, [getActiveCamera]);

  const requestStart = useCallback(() => {
    setPhase('play');
    setPendingStart(true);
  }, []);

  useEffect(() => {
    if (!pendingStart || phase !== 'play' || worldSize.width < 200 || capitals.size === 0) return;
    initRound();
    setPendingStart(false);
  }, [pendingStart, phase, worldSize.width, capitals.size, initRound]);

  const applyPointerRef = useRef(applyPointerToPlayer);
  applyPointerRef.current = applyPointerToPlayer;

  const handlePlayerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'play' || playIntroRef.current !== 'playing') return;
    e.preventDefault();
    e.stopPropagation();

    const touch = worldPointFromClient(e.clientX, e.clientY);
    if (!touch) return;

    pointerRef.current = {
      active: true,
      clientX: e.clientX,
      clientY: e.clientY,
      grabOffsetX: touch.x - playerPosRef.current.x,
      grabOffsetY: touch.y - playerPosRef.current.y,
    };
    viewportRef.current?.setPointerCapture(e.pointerId);
  }, [worldPointFromClient]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerRef.current.active) return;
    e.preventDefault();
    pointerRef.current.clientX = e.clientX;
    pointerRef.current.clientY = e.clientY;
  }, []);

  const handlePointerEnd = useCallback((e: React.PointerEvent) => {
    if (!pointerRef.current.active) return;
    pointerRef.current.active = false;
    setIsMoving(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  useEffect(() => {
    if (playIntro !== 'goal-reveal' || phase !== 'play') return;
    const goalRevealTimer = window.setTimeout(() => {
      prepareOniSpawns();
      const live = readViewportSize(viewportRef.current);
      const fallback = viewSizeRef.current;
      const vw = live.width > 1 ? live.width : fallback.width;
      const vh = live.height > 1 ? live.height : fallback.height;
      const { width: ww, height: wh } = worldSizeRef.current;
      cinematicTargetRef.current = getCamera(playerPosRef.current, vw, vh, ww, wh);
      setPlayIntro('oni-reveal');
      playIntroRef.current = 'oni-reveal';
      setOniIntro(true);
      oniChasePausedRef.current = true;
    }, GOAL_REVEAL_MS);
    return () => clearTimeout(goalRevealTimer);
  }, [playIntro, phase, prepareOniSpawns]);

  useEffect(() => {
    if (playIntro !== 'oni-reveal' || phase !== 'play') return;
    const oniRevealTimer = window.setTimeout(() => {
      setOniIntro(false);
      setPlayIntro('playing');
      playIntroRef.current = 'playing';
      oniChasePausedRef.current = false;
    }, ONI_INTRO_MS);
    return () => clearTimeout(oniRevealTimer);
  }, [playIntro, phase]);

  useEffect(() => {
    if (playIntro === 'playing' || phase !== 'play') return;

    let raf = 0;
    const tick = () => {
      if (playIntroRef.current === 'playing' || phaseRef.current !== 'play') return;

      const cur = cinematicCameraRef.current;
      const tgt = cinematicTargetRef.current;
      const next = {
        x: cur.x + (tgt.x - cur.x) * 0.1,
        y: cur.y + (tgt.y - cur.y) * 0.1,
      };
      cinematicCameraRef.current = next;
      setCinematicCamera(next);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playIntro, phase]);

  useEffect(() => {
    if (phase !== 'play' || worldSize.width < 200) return;

    let raf = 0;
    let frame = 0;

    const tick = () => {
      if (phaseRef.current !== 'play') return;

      if (pointerRef.current.active) {
        applyPointerRef.current();
      }

      const nextPlayer = playerPosRef.current;

      if (oniActiveRef.current && !oniChasePausedRef.current) {
        if (oniPosRef.current) {
          const nextOni = moveToward(oniPosRef.current, nextPlayer, ONI_SPEED);
          oniPosRef.current = nextOni;
          setOniPos(nextOni);

          if (mapDistance(nextOni, nextPlayer) < CATCH_RADIUS) {
            setPhase('lose');
            phaseRef.current = 'lose';
            return;
          }
        }

        const nextMinions = minionPosRef.current.map((pos, i) =>
          moveToward(pos, nextPlayer, MINION_SPEEDS[i] ?? MINION_SPEEDS[0]),
        );
        minionPosRef.current = nextMinions;
        setMinionPositions(nextMinions);

        for (const minionPos of nextMinions) {
          if (mapDistance(minionPos, nextPlayer) < CATCH_RADIUS) {
            setPhase('lose');
            phaseRef.current = 'lose';
            return;
          }
        }
      }

      if (mapDistance(nextPlayer, goalPosRef.current) < ARRIVE_RADIUS) {
        setPhase('win');
        phaseRef.current = 'win';
        return;
      }

      frame += 1;
      if (frame % 8 === 0) setAnimFrame((f) => f + 1);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [phase, worldSize.width]);

  const playerStep = stepFromMotion(isMoving, animFrame);
  const oniStep = oniActive ? stepFromMotion(true, animFrame) : 'idle';
  const oniDir: CharDirection = oniPos
    ? directionFromVector(playerPos.x - oniPos.x, playerPos.y - oniPos.y)
    : 'left';

  if (phase === 'pick-avatar') {
    if (!activePlayer) {
      onBack();
      return null;
    }
    return (
      <AdventureAvatarSelect
        progress={activePlayer.progress}
        onBack={onBack}
        onConfirm={(level) => {
          setChosenAvatar(level);
          setPhase('intro');
          phaseRef.current = 'intro';
        }}
      />
    );
  }

  if (phase === 'intro') {
    return (
      <div className="game-screen adventure-screen">
        <header className="game-header compact">
          <button className="btn-back" onClick={onBack}>← もどる</button>
          <h2>🚶 アバターたんけん</h2>
        </header>
        <div className="adventure-intro-card">
          <p className="adventure-intro-lead">手に入れたアバターで日本地図を歩こう！</p>
          <ul className="adventure-intro-rules">
            <li>ひとつ選ばれた県の<strong>県庁所在地（◎）</strong>へたどり着け！</li>
            <li>🗾 各県に◎マーク。見た目ではどれがゴールかわからない</li>
            <li>🚩 スタートは本州・四国・九州の県庁所在地</li>
            <li>👆 アバターに触れたまま、<strong>指をスライド</strong>して歩こう</li>
            <li>🗺️ 画面は1地方くらい。歩くと地図がスクロール</li>
            <li>👹 スタートと同時に、<strong>もんだい大王</strong>と小さい鬼3匹が画面の外から追いかけてくる！</li>
          </ul>
          <button type="button" className="btn-primary" onClick={requestStart}>たんけんスタート！</button>
        </div>
      </div>
    );
  }

  if (phase === 'win') {
    return (
      <div className="game-screen adventure-screen">
        <div className="clear-card">
          <span className="clear-emoji">🎉</span>
          <h2>到着！</h2>
          <p>{goalPref?.kanji}の県庁所在地にたどり着いた！</p>
          <div className="finish-actions">
            <button className="btn-primary" onClick={requestStart}>もう一度</button>
            <button className="btn-secondary" onClick={onBack}>ホームへ</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'lose') {
    return (
      <div className="game-screen adventure-screen">
        <div className="clear-card">
          <span className="clear-emoji">👹</span>
          <h2>捕まった…</h2>
          <p>鬼に追いつかれた！</p>
          <div className="finish-actions">
            <button className="btn-primary" onClick={requestStart}>もう一度</button>
            <button className="btn-secondary" onClick={onBack}>ホームへ</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-screen adventure-screen">
      <header className="game-header compact">
        <button className="btn-back" onClick={onBack}>← もどる</button>
        <h2>🚶 アバターたんけん</h2>
      </header>

      <div
        className={`adventure-top-panel${
          playIntro === 'goal-reveal' ? ' adventure-top-panel--reveal' : ''
        }`}
      >
        <div className="adventure-top-labels">
          <PlayerStatus />

          <div className="adventure-hud">
            <div
              className={`adventure-goal-banner${
                playIntro === 'goal-reveal' ? ' adventure-goal-banner--reveal' : ''
              }`}
            >
              <span className="adventure-goal-eyebrow">
                {playIntro === 'goal-reveal' ? 'ここ！' : 'もくてき'}
              </span>
              <div className="adventure-goal-title-wrap">
                {goalPref && (
                  <p className="adventure-goal-main">
                    <span className="adventure-goal-destination">{goalPref.kanji}</span>
                    {playIntro !== 'goal-reveal' && (
                      <span className="adventure-goal-region">（{goalRegionLabel(goalPref.region)}）</span>
                    )}
                  </p>
                )}
                {goalPref && playIntro !== 'goal-reveal' && (
                  <p className="adventure-goal-hiragana">◎ {goalPref.hiragana}</p>
                )}
              </div>
            </div>
            {oniActive && !oniIntro && playIntro === 'playing' && (
              <p className="adventure-warning">👹 にげろ！</p>
            )}
          </div>
        </div>

        {playIntro === 'goal-reveal' && goalPref && (
          <div className="adventure-goal-study" role="status" aria-live="polite">
            <p className="adventure-goal-study-lead">📖 おぼえよう</p>
            <div className="adventure-goal-study-basic">
              <p className="adventure-goal-study-name">
                <span className="adventure-goal-study-kanji">{goalPref.kanji}</span>
                <span className="adventure-goal-study-hira">（{goalPref.hiragana}）</span>
              </p>
              <p className="adventure-goal-study-region">{goalRegionLabel(goalPref.region)}</p>
              <p className="adventure-goal-study-famous">
                {goalPref.landmarkEmoji} {goalPref.landmark}
              </p>
              <p className="adventure-goal-study-capital">県庁所在地 ◎</p>
            </div>
            <div className="adventure-goal-study-landmarks">
              <p className="adventure-goal-study-section-title">🍜 名物・名所</p>
              <div className="adventure-goal-study-spots">
                {goalLandmarkSpots.map((spot) => (
                  <div key={spot.name} className="adventure-goal-study-spot">
                    <span className="adventure-goal-study-spot-emoji" aria-hidden>{spot.emoji}</span>
                    <div className="adventure-goal-study-spot-body">
                      <p className="adventure-goal-study-spot-name">{spot.name}</p>
                      <p className="adventure-goal-study-spot-desc">{spot.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="adventure-play-area">
        <div
          ref={viewportRef}
          className="adventure-viewport map-container adventure-map"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {worldSize.width >= 200 && (
            <div
              className="adventure-world"
              style={{
                width: worldSize.width,
                height: worldSize.height,
                transform: `translate(${-displayCamera.x}px, ${-displayCamera.y}px)`,
              }}
            >
              <JapanMap
                geo={geo}
                fixedSize={worldSize}
                showPrefectureLabels
                interactive={false}
                renderOverlay={() => (
                  <div
                    className="adventure-overlay"
                    style={{ width: worldSize.width, height: worldSize.height }}
                  >
                    {Array.from(capitals.entries()).map(([kanji, pos]) => {
                      const isGoalReveal = playIntro === 'goal-reveal' && kanji === goalPref?.kanji;
                      return (
                      <div
                        key={kanji}
                        className={`adventure-capital-marker${
                          isGoalReveal ? ' adventure-capital-marker--goal' : ''
                        }`}
                        style={{
                          left: pos.x,
                          top: pos.y,
                          fontSize: isGoalReveal ? capitalMarkerSize * 2.5 : capitalMarkerSize,
                        }}
                        aria-hidden
                      >
                        ◎
                      </div>
                      );
                    })}
                    {oniActive && oniPos && !oniIntro && (
                      <MapCharacterSprite
                        x={oniPos.x}
                        y={oniPos.y}
                        size={oniSize}
                        imageSrc={getOniSpriteSrc(oniDir, oniStep)}
                        direction={oniDir}
                        step={oniStep}
                        className="map-char--oni map-char--oni-boss"
                      />
                    )}
                    {oniActive && !oniIntro && minionPositions.map((pos, i) => {
                      const minionDir = directionFromVector(playerPos.x - pos.x, playerPos.y - pos.y);
                      const minionStep = stepFromMotion(true, animFrame + i * 3);
                      return (
                        <MapCharacterSprite
                          key={i}
                          x={pos.x}
                          y={pos.y}
                          size={minionSize}
                          imageSrc={getMinionSpriteSrc(minionDir, minionStep)}
                          direction={minionDir}
                          step={minionStep}
                          className="map-char--oni map-char--oni-minion"
                        />
                      );
                    })}
                  </div>
                )}
              />
            </div>
          )}
          {/* キャラは常にマップ画面の中央。移動するとマップが動く */}
          {playIntro !== 'goal-reveal' && worldSize.width >= 200 && (
            <div className="adventure-player-pin" style={{ width: charSize, height: charSize }}>
              <MapCharacterSprite
                x={charSize / 2}
                y={charSize / 2}
                size={charSize}
                imageSrc={getAvatarFallbackSrc(chosenAvatar)}
                direction="down"
                step={playerStep}
                className="map-char--player"
                interactive={playIntro === 'playing'}
                onPointerDown={handlePlayerPointerDown}
              />
            </div>
          )}
          {playIntro === 'playing' && (
            <p className="adventure-touch-hint">👆 アバターをつかんでスライド</p>
          )}
          {playIntro === 'goal-reveal' && (
            <div className="adventure-goal-reveal-dim" aria-hidden />
          )}
          {playIntro === 'oni-reveal' && (
            <div className="adventure-oni-splash" role="status" aria-live="assertive">
              <img src={BOSS_IMAGE} alt="" className="adventure-oni-splash-img" />
              <p className="adventure-oni-splash-text">鬼登場！逃げろ！</p>
            </div>
          )}
        </div>
      </div>

      {startPref && playIntro === 'playing' && (
        <p className="adventure-start-hint">スタート：{startPref.kanji}の県庁所在地</p>
      )}
    </div>
  );
}
