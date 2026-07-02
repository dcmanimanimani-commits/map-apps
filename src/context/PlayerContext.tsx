import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createPlayer,
  getActivePlayer,
  listPlayers,
  setActivePlayer,
  type PlayerSlot,
} from '../data/players';
import type { PlayerProgress } from '../data/progress';
import { masterRegion as masterRegionProgress } from '../data/progress';

interface PlayerContextValue {
  activePlayer: PlayerSlot | null;
  players: PlayerSlot[];
  refresh: () => void;
  selectPlayer: (id: string) => void;
  addPlayer: (name: string) => PlayerSlot;
  masterRegion: (regionId: string) => PlayerProgress;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo<PlayerContextValue>(() => {
    void version;
    const players = listPlayers();
    const activePlayer = getActivePlayer();

    return {
      activePlayer,
      players,
      refresh,
      selectPlayer: (id: string) => {
        setActivePlayer(id);
        refresh();
      },
      addPlayer: (name: string) => {
        const player = createPlayer(name);
        refresh();
        return player;
      },
      masterRegion: (regionId: string) => {
        const updated = masterRegionProgress(regionId);
        refresh();
        return updated;
      },
    };
  }, [version, refresh]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
