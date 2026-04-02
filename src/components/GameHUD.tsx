interface GameHUDProps {
  speed: number;
  money: number;
  round: number;
  totalRounds: number;
}

export function GameHUD({ speed, money, round, totalRounds }: GameHUDProps) {
  return (
    <div className="absolute top-6 left-0 right-0 px-4 flex justify-between items-start pointer-events-none z-10">
      {/* Speed */}
      <div className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border">
        <div className="font-arcade text-[10px] text-muted-foreground">SPEED</div>
        <div className="font-display text-xl font-bold text-foreground">
          {Math.round(speed)}
          <span className="text-xs text-muted-foreground ml-1">km/h</span>
        </div>
      </div>
      
      {/* Round */}
      <div className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border text-center">
        <div className="font-arcade text-[10px] text-muted-foreground">ROUND</div>
        <div className="font-display text-xl font-bold text-accent">
          {round}<span className="text-sm text-muted-foreground">/{totalRounds}</span>
        </div>
      </div>
      
      {/* Money */}
      <div className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border text-right">
        <div className="font-arcade text-[10px] text-muted-foreground">CASH</div>
        <div className="font-display text-xl font-bold text-score-green">
          ${money}
        </div>
      </div>
    </div>
  );
}
