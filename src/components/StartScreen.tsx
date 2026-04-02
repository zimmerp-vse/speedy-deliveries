interface StartScreenProps {
  onStart: () => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-20 bg-background/95 backdrop-blur-lg">
      <div className="text-center max-w-sm mx-4">
        <div className="text-7xl mb-4">🚗</div>
        
        <h1 className="font-display text-4xl font-black mb-2 text-glow text-accent">
          DASH
        </h1>
        <h2 className="font-display text-xl font-bold mb-1 text-primary">
          DELIVERY
        </h2>
        <p className="font-arcade text-[10px] text-muted-foreground mb-8 leading-relaxed">
          Deliver packages • Avoid crashes • Earn cash
        </p>
        
        <button
          onClick={onStart}
          className="font-arcade text-sm gradient-sunset text-primary-foreground px-10 py-4 rounded-xl hover:opacity-90 transition-all active:scale-95 animate-pulse-glow"
        >
          START ENGINE
        </button>
        
        <div className="mt-8 space-y-2 text-left bg-card/50 rounded-lg p-4 border border-border">
          <p className="font-arcade text-[9px] text-muted-foreground">CONTROLS</p>
          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            <span>⬆ / W</span><span>Accelerate</span>
            <span>⬇ / S</span><span>Brake</span>
            <span>⬅ ➡ / A D</span><span>Steer</span>
            <span>Space / H</span><span>Horn 📢</span>
          </div>
          <p className="font-arcade text-[8px] text-accent mt-2">
            💡 Horn scares pedestrians away!
          </p>
        </div>
      </div>
    </div>
  );
}
