import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { useMapSize } from '../hooks/useMapSize';
import { prefectures, type Prefecture } from '../data/prefectures';
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
  pickOniSpawnAtEdgeCapital,
  type MapPoint,
} from '../utils/mapPositions';
import {
  directionFromVector,
  getAvatarFallbackSrc,
  getAvatarSpriteSrc,
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

const ONI_SPEED = 5.625;
const ONI_INTRO_MS = 1000;
const ARRIVE_RADIUS = 34;
const CATCH_RADIUS = 34;
const CHAR_SIZE = 152;
const ONI_SIZE = 184;
/** 指の目標位置へ向かう速さ（小さいほどゆっくり） */
const PLAYER_FOLLOW_RATE = 0.085;

const START_EXCLUDED_KANJI = new Set(['北海道', '沖縄県']);
const START_REGIONS = new Set(['東北', '関東', '中部', '近畿', '中国', '四国', '九州']);

function isMainlandStartPrefecture(pref: Prefecture): boolean {
  if (START_EXCLUDED_KANJI.has(pref.kanji)) return false;
  return START_REGIONS.has(pref.region);
}

function pickStartAndGoal(capitals: Map<string, MapPoint>): {
  start: Prefecture;
  goal: Prefecture;
  startPos: MapPoint;
  goalPos: MapPoint;
} {
  const available = prefectures.filter((p) => capitals.has(p.kanji));
  const goal = available[Math.floor(Math.random() * available.length)];
  const startPool = available.filter((p) => p.kanji !== goal.kanji && isMainlandStartPrefecture(p));
  const start = startPool[Math.floor(Math.random() * startPool.length)] ?? available.find((p) => p.kanji !== goal.kanji)!;
  return {
    start,
    goal,
    startPos: capitals.get(start.kanji)!,
    goalPos: capitals.get(goal.kanji)!,
  };
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
  const [oniActive, setOniActive] = useState(false);
  const [oniIntro, setOniIntro] = useState(false);
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
  const oniActiveRef = useRef(false);
  const oniChasePausedRef = useRef(false);
  const goalPosRef = useRef<MapPoint>({ x: 0, y: 0 });
  const phaseRef = useRef<Phase>('pick-avatar');
  const lastDirRef = useRef<CharDirection>('down');
  const worldSizeRef = useRef(worldSize);
  const viewSizeRef = useRef({ width: viewW, height: viewH });
  const geoRef = useRef(geo);

  playerPosRef.current = playerPos;
  oniPosRef.current = oniPos;
  oniActiveRef.current = oniActive;
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

  const camera = useMemo(
    () => getCamera(playerPos, viewW, viewH, worldSize.width, worldSize.height),
    [playerPos, viewW, viewH, worldSize.width, worldSize.height],
  );

  worldSizeRef.current = worldSize;
  viewSizeRef.current = { width: viewW, height: viewH };
  geoRef.current = geo;

  const spawnOni = useCallback(() => {
    const { width: ww, height: wh } = worldSizeRef.current;
    const { width: vw, height: vh } = viewSizeRef.current;
    if (ww < 200 || capitalsRef.current.size === 0) return;

    const spawn = pickOniSpawnAtEdgeCapital(
      playerPosRef.current,
      geoRef.current,
      ww,
      wh,
      vw,
      vh,
      capitalsRef.current,
    );
    setOniPos(spawn);
    oniPosRef.current = spawn;
    setOniActive(true);
    oniActiveRef.current = true;
    setOniIntro(true);
    oniChasePausedRef.current = true;
  }, []);

  const initRound = useCallback(() => {
    const { start, goal, startPos, goalPos: goalSpot } = pickStartAndGoal(capitals);
    setStartPref(start);
    setGoalPref(goal);
    goalPosRef.current = goalSpot;
    setPlayerPos(startPos);
    playerPosRef.current = startPos;
    setOniPos(null);
    oniPosRef.current = null;
    setOniActive(false);
    oniActiveRef.current = false;
    setOniIntro(false);
    oniChasePausedRef.current = false;
    setAnimFrame(0);
    setIsMoving(false);
    pointerRef.current = {
      active: false,
      clientX: 0,
      clientY: 0,
      grabOffsetX: 0,
      grabOffsetY: 0,
    };
    spawnOni();
  }, [capitals, spawnOni]);

  const applyPointerToPlayer = useCallback(() => {
    const ptr = pointerRef.current;
    if (!ptr.active) return false;

    const el = viewportRef.current;
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const { width: vw, height: vh } = viewSizeRef.current;
    const { width: ww, height: wh } = worldSizeRef.current;
    const cam = getCamera(playerPosRef.current, vw, vh, ww, wh);
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
  }, []);

  const worldPointFromClient = useCallback((clientX: number, clientY: number) => {
    const el = viewportRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const { width: vw, height: vh } = viewSizeRef.current;
    const { width: ww, height: wh } = worldSizeRef.current;
    const cam = getCamera(playerPosRef.current, vw, vh, ww, wh);
    return clientToWorld(clientX, clientY, rect, cam);
  }, []);

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
    if (phaseRef.current !== 'play') return;
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
    if (!oniIntro || phase !== 'play') return;
    const introClearTimer = window.setTimeout(() => {
      setOniIntro(false);
      oniChasePausedRef.current = false;
    }, ONI_INTRO_MS);
    return () => clearTimeout(introClearTimer);
  }, [oniIntro, phase]);

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

      if (oniActiveRef.current && oniPosRef.current && !oniChasePausedRef.current) {
        const nextOni = moveToward(oniPosRef.current, nextPlayer, ONI_SPEED);
        oniPosRef.current = nextOni;
        setOniPos(nextOni);

        if (mapDistance(nextOni, nextPlayer) < CATCH_RADIUS) {
          setPhase('lose');
          phaseRef.current = 'lose';
          return;
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
  const playerDir = lastDirRef.current;
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
            <li>👹 スタートと同時に、<strong>画面の外</strong>の別の県の県庁所在地（◎）から鬼が現れる！</li>
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
          <p>もんだい大王に追いつかれた！</p>
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

      <PlayerStatus />

      <div className="adventure-hud">
        <div className="adventure-goal-banner">
          <span className="adventure-goal-eyebrow">もくてきち</span>
          <p className="adventure-goal-main">
            <span className="adventure-goal-kanji">{goalPref?.kanji}</span>
            <span className="adventure-goal-tail">の県庁所在地 ◎ へ！</span>
          </p>
          {goalPref && (
            <p className="adventure-goal-hiragana">（{goalPref.hiragana}）</p>
          )}
        </div>
        {oniActive && !oniIntro && <p className="adventure-warning">👹 にげろ！</p>}
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
                transform: `translate(${-camera.x}px, ${-camera.y}px)`,
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
                    {Array.from(capitals.entries()).map(([kanji, pos]) => (
                      <div
                        key={kanji}
                        className="adventure-capital-marker"
                        style={{ left: pos.x, top: pos.y, fontSize: capitalMarkerSize }}
                        aria-hidden
                      >
                        ◎
                      </div>
                    ))}
                    <MapCharacterSprite
                      x={playerPos.x}
                      y={playerPos.y}
                      size={CHAR_SIZE}
                      imageSrc={getAvatarSpriteSrc(chosenAvatar, playerDir, playerStep)}
                      fallbackSrc={getAvatarFallbackSrc(chosenAvatar)}
                      direction={playerDir}
                      step={playerStep}
                      className="map-char--player"
                      interactive
                      onPointerDown={handlePlayerPointerDown}
                    />
                    {oniActive && oniPos && !oniIntro && (
                      <MapCharacterSprite
                        x={oniPos.x}
                        y={oniPos.y}
                        size={ONI_SIZE}
                        imageSrc={getOniSpriteSrc(oniDir, oniStep)}
                        direction={oniDir}
                        step={oniStep}
                        className="map-char--oni"
                      />
                    )}
                  </div>
                )}
              />
            </div>
          )}
          <p className="adventure-touch-hint">👆 アバターをつかんでスライド</p>
          {oniIntro && (
            <div className="adventure-oni-splash" role="status" aria-live="assertive">
              <img src={BOSS_IMAGE} alt="" className="adventure-oni-splash-img" />
              <p className="adventure-oni-splash-text">鬼登場！逃げろ！</p>
            </div>
          )}
        </div>
      </div>

      {startPref && (
        <p className="adventure-start-hint">スタート：{startPref.kanji}の県庁所在地</p>
      )}
    </div>
  );
}
