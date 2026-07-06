import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { useMapSize } from '../hooks/useMapSize';
import { prefectures, type Prefecture } from '../data/prefectures';
import { usePlayer } from '../context/PlayerContext';
import { resolveAvatarLevel } from '../data/progress';
import {
  buildGoalSpotInPrefecture,
  buildPrefectureCentroids,
  buildWorldSize,
  clampToMap,
  clientToWorld,
  getCamera,
  mapDistance,
  moveToward,
  type MapPoint,
} from '../utils/mapPositions';
import {
  directionFromVector,
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

type Phase = 'intro' | 'play' | 'win' | 'lose';

const PLAYER_SPEED = 4.2;
const ONI_SPEED = 3.75;
const ONI_DELAY_MS = 3000;
const ARRIVE_RADIUS = 36;
const CATCH_RADIUS = 34;
const CHAR_SIZE = 48;
const ONI_SIZE = 56;

function pickStartAndGoal(centroids: Map<string, MapPoint>): {
  start: Prefecture;
  goal: Prefecture;
  startPos: MapPoint;
  goalPos: MapPoint;
} {
  const available = prefectures.filter((p) => centroids.has(p.kanji));
  const goal = available[Math.floor(Math.random() * available.length)];
  const others = available.filter((p) => p.kanji !== goal.kanji);
  const start = others[Math.floor(Math.random() * others.length)];
  const goalCentroid = centroids.get(goal.kanji)!;
  return {
    start,
    goal,
    startPos: centroids.get(start.kanji)!,
    goalPos: buildGoalSpotInPrefecture(goalCentroid),
  };
}

function pickOniSpawn(centroids: Map<string, MapPoint>, player: MapPoint): MapPoint {
  let best: MapPoint = { x: 40, y: 40 };
  let bestDist = -1;
  for (const pos of centroids.values()) {
    const d = mapDistance(pos, player);
    if (d > bestDist) {
      bestDist = d;
      best = pos;
    }
  }
  return best;
}

function stepFromMotion(moving: boolean, frame: number): CharStep {
  if (!moving) return 'idle';
  return frame % 2 === 0 ? 'rightFoot' : 'leftFoot';
}

export function AvatarAdventureGame({ geo, onBack }: AvatarAdventureGameProps) {
  const { activePlayer } = usePlayer();
  const avatarLevel = activePlayer ? resolveAvatarLevel(activePlayer.progress) : 1;

  const [phase, setPhase] = useState<Phase>('intro');
  const [pendingStart, setPendingStart] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { width: viewW, height: viewH } = useMapSize(viewportRef);
  const worldSize = useMemo(
    () => (viewW >= 200 ? buildWorldSize(viewW, viewH) : { width: 0, height: 0 }),
    [viewW, viewH],
  );

  const [startPref, setStartPref] = useState<Prefecture | null>(null);
  const [goalPref, setGoalPref] = useState<Prefecture | null>(null);
  const [goalPos, setGoalPos] = useState<MapPoint | null>(null);
  const [playerPos, setPlayerPos] = useState<MapPoint>({ x: 350, y: 260 });
  const [oniPos, setOniPos] = useState<MapPoint | null>(null);
  const [oniActive, setOniActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [animFrame, setAnimFrame] = useState(0);
  const [isMoving, setIsMoving] = useState(false);

  const pointerRef = useRef({ active: false, worldX: 0, worldY: 0 });
  const playerPosRef = useRef(playerPos);
  const oniPosRef = useRef<MapPoint | null>(null);
  const oniActiveRef = useRef(false);
  const goalPosRef = useRef<MapPoint>({ x: 0, y: 0 });
  const phaseRef = useRef<Phase>('intro');
  const lastDirRef = useRef<CharDirection>('down');
  const worldSizeRef = useRef(worldSize);

  playerPosRef.current = playerPos;
  oniPosRef.current = oniPos;
  oniActiveRef.current = oniActive;
  phaseRef.current = phase;
  worldSizeRef.current = worldSize;

  const centroids = useMemo(() => {
    if (worldSize.width < 200) return new Map<string, MapPoint>();
    return buildPrefectureCentroids(geo, worldSize.width, worldSize.height);
  }, [geo, worldSize.width, worldSize.height]);

  const camera = useMemo(
    () => getCamera(playerPos, viewW, viewH, worldSize.width, worldSize.height),
    [playerPos, viewW, viewH, worldSize.width, worldSize.height],
  );

  const initRound = useCallback(() => {
    const { start, goal, startPos, goalPos: goalSpot } = pickStartAndGoal(centroids);
    setStartPref(start);
    setGoalPref(goal);
    setGoalPos(goalSpot);
    goalPosRef.current = goalSpot;
    setPlayerPos(startPos);
    playerPosRef.current = startPos;
    setOniPos(null);
    oniPosRef.current = null;
    setOniActive(false);
    oniActiveRef.current = false;
    setCountdown(3);
    setAnimFrame(0);
    setIsMoving(false);
    pointerRef.current = { active: false, worldX: 0, worldY: 0 };
  }, [centroids]);

  const requestStart = useCallback(() => {
    setPhase('play');
    setPendingStart(true);
  }, []);

  useEffect(() => {
    if (!pendingStart || phase !== 'play' || worldSize.width < 200 || centroids.size === 0) return;
    initRound();
    setPendingStart(false);
  }, [pendingStart, phase, worldSize.width, centroids.size, initRound]);

  const updatePointerWorld = useCallback((clientX: number, clientY: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cam = getCamera(
      playerPosRef.current,
      rect.width,
      rect.height,
      worldSizeRef.current.width,
      worldSizeRef.current.height,
    );
    const world = clientToWorld(clientX, clientY, rect, cam);
    pointerRef.current = { ...pointerRef.current, worldX: world.x, worldY: world.y };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current !== 'play') return;
    e.preventDefault();
    pointerRef.current.active = true;
    updatePointerWorld(e.clientX, e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [updatePointerWorld]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerRef.current.active) return;
    e.preventDefault();
    updatePointerWorld(e.clientX, e.clientY);
  }, [updatePointerWorld]);

  const handlePointerEnd = useCallback(() => {
    pointerRef.current.active = false;
    setIsMoving(false);
  }, []);

  useEffect(() => {
    if (phase !== 'play' || worldSize.width < 200) return;

    const oniTimer = window.setTimeout(() => {
      const spawn = pickOniSpawn(centroids, playerPosRef.current);
      setOniPos(spawn);
      oniPosRef.current = spawn;
      setOniActive(true);
      oniActiveRef.current = true;
    }, ONI_DELAY_MS);

    const countInterval = window.setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    let raf = 0;
    let frame = 0;

    const tick = () => {
      if (phaseRef.current !== 'play') return;

      const { width: ww, height: wh } = worldSizeRef.current;
      let nextPlayer = playerPosRef.current;
      let moving = false;

      if (pointerRef.current.active) {
        const before = nextPlayer;
        nextPlayer = moveToward(
          nextPlayer,
          { x: pointerRef.current.worldX, y: pointerRef.current.worldY },
          PLAYER_SPEED,
        );
        nextPlayer = clampToMap(nextPlayer, ww, wh);
        moving = mapDistance(before, nextPlayer) > 0.1;
        if (moving) {
          lastDirRef.current = directionFromVector(
            nextPlayer.x - before.x,
            nextPlayer.y - before.y,
          );
        }
      }

      if (moving) {
        playerPosRef.current = nextPlayer;
        setPlayerPos(nextPlayer);
        setIsMoving(true);
      } else {
        setIsMoving(false);
      }

      if (oniActiveRef.current && oniPosRef.current) {
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
      clearTimeout(oniTimer);
      clearInterval(countInterval);
      cancelAnimationFrame(raf);
    };
  }, [phase, centroids, worldSize.width]);

  const playerStep = stepFromMotion(isMoving, animFrame);
  const playerDir = lastDirRef.current;
  const oniStep = oniActive ? stepFromMotion(true, animFrame) : 'idle';
  const oniDir: CharDirection = oniPos
    ? directionFromVector(playerPos.x - oniPos.x, playerPos.y - oniPos.y)
    : 'left';

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
            <li>🎯 県の中の<strong>目的地</strong>までたどり着け！</li>
            <li>👆 指やPencilで<strong>タップ</strong>した方向へ歩ける</li>
            <li>🗺️ 画面は1地方くらい。歩くと地図がスクロール</li>
            <li>👹 開始<strong>3秒後</strong>、もんだい大王が追いかけてくる！</li>
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
          <p>{goalPref?.kanji}の目的地にたどり着いた！</p>
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
        <p className="adventure-goal">
          🎯 {goalPref?.landmarkEmoji} <strong>{goalPref?.kanji}</strong>のなかへ！
        </p>
        {!oniActive && countdown > 0 && (
          <p className="adventure-countdown">鬼まで {countdown}…</p>
        )}
        {oniActive && <p className="adventure-warning">👹 にげろ！</p>}
      </div>

      <div className="adventure-play-area">
        <div
          ref={viewportRef}
          className="adventure-viewport map-container adventure-map"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
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
                highlightedKanji={goalPref?.kanji ?? null}
                interactive={false}
                renderOverlay={() => (
                  <div
                    className="adventure-overlay"
                    style={{ width: worldSize.width, height: worldSize.height }}
                  >
                    {goalPos && (
                      <div
                        className="adventure-goal-marker"
                        style={{ left: goalPos.x, top: goalPos.y }}
                        aria-hidden
                      >
                        🎯
                      </div>
                    )}
                    <MapCharacterSprite
                      x={playerPos.x}
                      y={playerPos.y}
                      size={CHAR_SIZE}
                      imageSrc={getAvatarSpriteSrc(avatarLevel, playerDir, playerStep)}
                      direction={playerDir}
                      step={playerStep}
                      className="map-char--player"
                    />
                    {oniActive && oniPos && (
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
          <p className="adventure-touch-hint">👆 タップした方向へ歩く</p>
        </div>
      </div>

      {startPref && (
        <p className="adventure-start-hint">スタート：{startPref.kanji}</p>
      )}
    </div>
  );
}
