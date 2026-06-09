interface ScorePanelProps {
  score: number;
  streak: number;
  total: number;
  label?: string;
}

export function ScorePanel({ score, streak, total, label = 'もくひょう' }: ScorePanelProps) {
  return (
    <div className="score-panel">
      <div className="score-item">
        <span className="score-label">⭐ スコア</span>
        <span className="score-value">{score}</span>
      </div>
      <div className="score-item">
        <span className="score-label">🔥 れんぞく</span>
        <span className="score-value">{streak}</span>
      </div>
      <div className="score-item">
        <span className="score-label">🎯 {label}</span>
        <span className="score-value">{total}</span>
      </div>
    </div>
  );
}
