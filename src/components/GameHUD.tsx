import { Tachometer } from './Tachometer';
import { RolexTimer } from './RolexTimer';

interface GameHUDProps {
  speed: number;
  money: number;
  round: number;
  totalRounds: number;
  timeRemaining: number;
  totalTime?: number;
}

export function GameHUD({ speed, money, round, totalRounds, timeRemaining, totalTime = 45 }: GameHUDProps) {
  return (
    <div className="absolute top-6 left-0 right-0 px-4 flex justify-between items-start pointer-events-none z-10">
      {/* Ferrari tachometer */}
      <Tachometer speed={speed} maxSpeed={200} />

      {/* Rolex Oyster Perpetual Date timer */}
      <RolexTimer timeRemaining={timeRemaining} totalTime={totalTime} />

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
