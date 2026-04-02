import { GameData, GAME_CONFIG } from '@/game/config';

interface GameOverScreenProps {
  data: GameData;
}

export function GameOverScreen({ data }: GameOverScreenProps) {
  const totalAccidents = data.totalAccidents.car + data.totalAccidents.obstacle + data.totalAccidents.pedestrian;
  const rating = data.totalDeliveries >= 8 ? '🏆 LEGENDARY' : data.totalDeliveries >= 6 ? '⭐ GREAT' : data.totalDeliveries >= 4 ? '👍 DECENT' : '💩 NEEDS WORK';
  
  return (
    <div className="absolute inset-0 flex items-center justify-center z-20 bg-background/90 backdrop-blur-lg">
      <div className="text-center max-w-md mx-4">
        <h1 className="font-display text-4xl font-black mb-2 text-glow-orange text-primary">
          GAME OVER
        </h1>
        <p className="font-display text-xl mb-6 text-foreground">{rating}</p>
        
        <div className="bg-card rounded-xl border border-border p-4 mb-6 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Final Cash</span>
            <span className="font-display font-bold text-score-green">${data.totalMoney}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deliveries</span>
            <span className="font-display font-bold text-accent">{data.totalDeliveries}/{GAME_CONFIG.totalRounds}</span>
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <div className="font-arcade text-[10px] text-muted-foreground mb-1">ACCIDENT REPORT</div>
            <div className="flex justify-between text-sm">
              <span>🚗 Car collisions</span>
              <span className="text-destructive font-bold">{data.totalAccidents.car}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>🌳 Obstacle hits</span>
              <span className="text-destructive font-bold">{data.totalAccidents.obstacle}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>💦 Pedestrian splashes</span>
              <span className="text-destructive font-bold">{data.totalAccidents.pedestrian}</span>
            </div>
          </div>
        </div>
        
        <p className="font-arcade text-[10px] text-muted-foreground animate-pulse-glow">
          DATA READY FOR MASTER PLATFORM
        </p>
      </div>
    </div>
  );
}
