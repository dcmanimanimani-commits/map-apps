import {
  getTitleForLevel,
  type PlayerProgress,
  TITLES,
  migrateProgress,
} from './progress';

export interface PlayerSlot {
  id: string;
  name: string;
  progress: PlayerProgress;
}

interface PlayersStore {
  version: 2;
  activePlayerId: string | null;
  players: PlayerSlot[];
}

const STORAGE_KEY = 'nihon-chizu-players';
const LEGACY_KEY = 'nihon-chizu-progress';

function defaultProgress(): PlayerProgress {
  return {
    level: 1,
    xp: 0,
    masteredRegions: [],
    title: TITLES[0].title,
    avatarLevel: 1,
    earnedStickerIds: [],
    stickerBookResetAt: Date.now(),
  };
}

function loadStore(): PlayersStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PlayersStore;
  } catch {
    /* ignore */
  }
  return { version: 2, activePlayerId: null, players: [] };
}

function saveStore(store: PlayersStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function normalizeProgress(progress: PlayerProgress): PlayerProgress {
  const migrated = migrateProgress(progress);
  const title = getTitleForLevel(migrated.level);
  return migrated.title === title ? migrated : { ...migrated, title };
}

function migrateLegacyIfNeeded(store: PlayersStore): PlayersStore | null {
  if (store.players.length > 0) return null;

  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;

    const legacy = normalizeProgress(JSON.parse(raw) as PlayerProgress);
    const player: PlayerSlot = {
      id: crypto.randomUUID(),
      name: 'ぷれいやー1',
      progress: legacy,
    };
    localStorage.removeItem(LEGACY_KEY);
    return { version: 2, activePlayerId: player.id, players: [player] };
  } catch {
    return null;
  }
}

function ensureStore(): PlayersStore {
  let store = loadStore();
  const legacyMigrated = migrateLegacyIfNeeded(store);
  if (legacyMigrated) {
    saveStore(legacyMigrated);
    return legacyMigrated;
  }

  const players = store.players.map((p) => ({
    ...p,
    progress: normalizeProgress(p.progress),
  }));

  const normalized: PlayersStore = { ...store, players };
  saveStore(normalized);
  return normalized;
}

export function listPlayers(): PlayerSlot[] {
  return ensureStore().players;
}

export function getActivePlayer(): PlayerSlot | null {
  const store = ensureStore();
  if (!store.activePlayerId) return null;
  return store.players.find((p) => p.id === store.activePlayerId) ?? null;
}

export function getActiveProgress(): PlayerProgress {
  return getActivePlayer()?.progress ?? defaultProgress();
}

export function saveActiveProgress(progress: PlayerProgress): void {
  const store = loadStore();
  const activeId = store.activePlayerId;
  if (!activeId) return;

  const normalized = normalizeProgress(progress);
  const players = store.players.map((p) =>
    p.id === activeId ? { ...p, progress: normalized } : p,
  );
  saveStore({ ...store, players });
}

export function setActivePlayer(id: string): PlayerSlot | null {
  const store = ensureStore();
  const player = store.players.find((p) => p.id === id);
  if (!player) return null;
  saveStore({ ...store, activePlayerId: id });
  return player;
}

export function createPlayer(name: string): PlayerSlot {
  const trimmed = name.trim().slice(0, 12) || 'ななし';
  const store = ensureStore();
  const player: PlayerSlot = {
    id: crypto.randomUUID(),
    name: trimmed,
    progress: defaultProgress(),
  };
  saveStore({
    version: 2,
    activePlayerId: player.id,
    players: [...store.players, player],
  });
  return player;
}
