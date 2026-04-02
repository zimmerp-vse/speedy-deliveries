import { GAME_CONFIG, RoundResult } from '@/game/config';

interface RoundEndScreenProps {
  result: RoundResult;
  onContinue: () => void;
}

export function RoundEndScreen({ result, onContinue }: RoundEndScreenProps) {
  const isSuccess = result.success;
  
  const message = isSuccess
    ? GAME_CONFIG.deliveryRewards[Math.floor(Math.random() * GAME_CONFIG.deliveryRewards.length)]
    : result.accidentType === 'pedestrian'
    ? GAME_CONFIG.pedestrianEffects[Math.floor(Math.random() * GAME_CONFIG.pedestrianEffects.length)]
    : GAME_CONFIG.accidentReactions[Math.floor(Math.random() * GAME_CONFIG.accidentReactions.length)];

  return (
    <div className="absolute inset-0 flex items-center justify-center z-20 bg-background/80 backdrop-blur-md">
      <div className="text-center max-w-sm mx-4">
        <div className="text-6xl mb-4">
          {isSuccess ? '🎉' : result.accidentType === 'car' ? '💥' : result.accidentType === 'obstacle' ? '🚧' : '💦'}
        </div>
        
        <h2 className="font-display text-2xl font-bold mb-2 text-foreground">
          {isSuccess ? 'DELIVERED!' : 'CRASH!'}
        </h2>
        
        <p className="font-arcade text-xs mb-4 text-muted-foreground leading-relaxed">
          {message}
        </p>
        
        <div className={`font-display text-3xl font-bold mb-6 ${isSuccess ? 'text-score-green' : 'text-destructive'}`}>
          {isSuccess ? `+$${result.moneyEarned}` : `-$${result.moneyLost}`}
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          📍 {result.scene} • ⏱ {(result.timeMs / 1000).toFixed(1)}s
        </p>
        
        <button
          onClick={onContinue}
          className="font-arcade text-sm bg-primary text-primary-foreground px-8 py-3 rounded-lg hover:opacity-90 transition-opacity active:scale-95"
        >
          NEXT DELIVERY →
        </button>
      </div>
    </div>
  );
}
