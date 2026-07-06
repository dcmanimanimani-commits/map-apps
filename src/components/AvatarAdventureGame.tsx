import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JapanGeoJSON } from '../hooks/useJapanGeo';
import { useMapSize } from '../hooks/useMapSize';
import { prefectures, type Prefecture } from '../data/prefectures';
import { usePlayer } from '../context/PlayerContext';
import { resolveAvatarLevel } from '../data/progress';
import {
  buildPrefectureCentroids,
  clampToMap,
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
import { MovementPad } from './MovementPad';
import { PlayerStatus } from './PlayerStatus';

interface AvatarAdventureGameProps {
  geo: JapanGeoJSON;
  onBack: () => void;
}

type Phase = 'intro' | 'play' | 'win' | 'lose';

const PLAYER_SPEED = 2.9;
const ONI_SPEED = 2.55;
const ONI_DELAY_MS = 3000;
const ARRIVE_RADIUS = 38;
const CATCH_RADIUS = 32;
const CHAR_SIZE = 44;
const ONI_SIZE = 52;

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
  return {
    start,
    goal,
    startPos: centroids.get(start.kanji)!,
    goalPos: centroids.get(goal.kanji)!,
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { width: mapW, height: mapH } = useMapSize(mapContainerRef);
  const [startPref, setStartPref] = useState<Prefecture | null>(null);
  const [goalPref, setGoalPref] = useState<Prefecture | null>(null);
  const [playerPos, setPlayerPos] = useState<MapPoint>({ x: 350, y: 260 });
  const [oniPos, setOniPos] = useState<MapPoint | null>(null);
  const [oniActive, setOniActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [animFrame, setAnimFrame] = useState(0);

  const inputRef = useRef({ dx: 0, dy: 0 });
  const playerPosRef = useRef(playerPos);
  const oniPosRef = useRef<MapPoint | null>(null);
  const oniActiveRef = useRef(false);
  const goalPosRef = useRef<MapPoint>({ x: 0, y: 0 });
  const phaseRef = useRef<Phase>('intro');
  const lastDirRef = useRef<CharDirection>('down');

  playerPosRef.current = playerPos;
  oniPosRef.current = oniPos;
  oniActiveRef.current = oniActive;
  phaseRef.current = phase;

  const centroids = useMemo(
    () => buildPrefectureCentroids(geo, mapW, mapH),
    [geo, mapW, mapH],
  );

  const initRound = useCallback(() => {
    const { start, goal, startPos, goalPos } = pickStartAndGoal(centroids);
    setStartPref(start);
    setGoalPref(goal);
    setPlayerPos(startPos);
    playerPosRef.current = startPos;
    goalPosRef.current = goalPos;
    setOniPos(null);
    oniPosRef.current = null;
    setOniActive(false);
    oniActiveRef.current = false;
    setCountdown(3);
    setAnimFrame(0);
    inputRef.current = { dx: 0, dy: 0 };
  }, [centroids]);

  const requestStart = useCallback(() => {
    setPhase('play');
    setPendingStart(true);
  }, []);

  useEffect(() => {
    if (!pendingStart || phase !== 'play' || mapW < 200) return;
    initRound();
    setPendingStart(false);
  }, [pendingStart, phase, mapW, mapH, initRound]);

  useEffect(() => {
    if (phase !== 'play') return;

    const onKey = (e: KeyboardEvent) => {
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp' || e.key === 'w') dy = -1;
      if (e.key === 'ArrowDown' || e.key === 's') dy = 1;
      if (e.key === 'ArrowLeft' || e.key === 'a') dx = -1;
      if (e.key === 'ArrowRight' || e.key === 'd') dx = 1;
      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        inputRef.current = { dx, dy };
      }
    };
    const onKeyUp = () => {
      inputRef.current = { dx: 0, dy: 0 };
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'play') return;

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

      const { dx, dy } = inputRef.current;
      const moving = dx !== 0 || dy !== 0;
      if (moving) lastDirRef.current = directionFromVector(dx, dy);

      let nextPlayer = playerPosRef.current;
      if (moving) {
        const len = Math.hypot(dx, dy) || 1;
        nextPlayer = clampToMap(
          {
            x: nextPlayer.x + (dx / len) * PLAYER_SPEED,
            y: nextPlayer.y + (dy / len) * PLAYER_SPEED,
          },
          mapW,
          mapH,
        );
        playerPosRef.current = nextPlayer;
        setPlayerPos(nextPlayer);
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
  }, [phase, centroids, mapW, mapH]);

  const isMoving = inputRef.current.dx !== 0 || inputRef.current.dy !== 0;
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
            <li>🎯 ランダムな<strong>目的地</strong>までたどり着け！</li>
            <li>🕹️ 矢印ボタンで自由に動ける</li>
            <li>👹 開始<strong>3秒後</strong>、もんだい大王が追いかけてくる！</li>
            <li>❌ 捕まったら負け…</li>
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
          <h2>到着（とうちゃく）！</h2>
          <p>{goalPref?.kanji}にたどり着いた！</p>
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
          🎯 もくてき：<strong>{goalPref?.kanji}</strong>（{goalPref?.hiragana}）
        </p>
        {!oniActive && countdown > 0 && (
          <p className="adventure-countdown">鬼（おに）まで {countdown}…</p>
        )}
        {oniActive && <p className="adventure-warning">👹 にげろ！</p>}
      </div>

      <div className="adventure-play-area">
        <div className="map-container adventure-map" ref={mapContainerRef}>
          <JapanMap
            geo={geo}
            highlightedKanji={goalPref?.kanji ?? null}
            interactive={false}
            renderOverlay={() => {
              const goalPos = goalPref ? centroids.get(goalPref.kanji) : null;

              return (
                <div className="adventure-overlay" style={{ width: mapW, height: mapH }}>
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
              );
            }}
          />
        </div>

        <MovementPad
          disabled={phase !== 'play'}
          onDirection={(dx, dy) => {
            inputRef.current = { dx, dy };
          }}
        />
      </div>

      {startPref && (
        <p className="adventure-start-hint">スタート：{startPref.kanji}</p>
      )}
    </div>
  );
}
