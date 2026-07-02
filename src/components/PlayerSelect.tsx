import { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { PlayerAvatar } from './PlayerAvatar';

interface PlayerSelectProps {
  onReady: () => void;
  allowBack?: boolean;
  onBack?: () => void;
}

export function PlayerSelect({ onReady, allowBack, onBack }: PlayerSelectProps) {
  const { players, selectPlayer, addPlayer } = usePlayer();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addPlayer(name);
    setName('');
    setCreating(false);
    onReady();
  }

  function handleSelect(id: string) {
    selectPlayer(id);
    onReady();
  }

  return (
    <div className="player-select-screen">
      <header className="player-select-header">
        {allowBack && onBack ? (
          <button type="button" className="btn-back" onClick={onBack}>← もどる</button>
        ) : (
          <span className="player-select-spacer" />
        )}
        <h1 className="player-select-title">🎮 プレイヤーをえらぼう</h1>
      </header>

      <p className="player-select-intro">だれがあそぶ？名前をつけてはじめよう！</p>

      <div className="player-list">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            className="player-card"
            onClick={() => handleSelect(player.id)}
          >
            <PlayerAvatar title={player.progress.title} size="md" />
            <div className="player-card-info">
              <span className="player-card-name">{player.name}</span>
              <span className="player-card-title">{player.progress.title}</span>
              <span className="player-card-level">Lv.{player.progress.level}</span>
            </div>
          </button>
        ))}
      </div>

      {creating ? (
        <form className="player-create-form" onSubmit={handleCreate}>
          <input
            className="player-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="なまえをいれてね"
            maxLength={12}
            autoFocus
          />
          <div className="player-create-actions">
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
              やめる
            </button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              つくる！
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn-primary player-create-btn" onClick={() => setCreating(true)}>
          ＋ 新しいプレイヤーをつくる
        </button>
      )}
    </div>
  );
}
