import { useCallback } from 'react';

interface GameControlsProps {
  onControl: (control: string, pressed: boolean) => void;
}

export function GameControls({ onControl }: GameControlsProps) {
  const bind = useCallback((control: string) => ({
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); onControl(control, true); },
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); onControl(control, false); },
    onMouseDown: () => onControl(control, true),
    onMouseUp: () => onControl(control, false),
    onMouseLeave: () => onControl(control, false),
  }), [onControl]);

  return (
    <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-between items-end z-10 md:hidden">
      {/* Steering */}
      <div className="flex gap-2">
        <button
          {...bind('left')}
          className="w-16 h-16 rounded-xl bg-card/70 backdrop-blur-sm border border-border flex items-center justify-center text-2xl active:bg-primary/30 transition-colors"
        >
          ◀
        </button>
        <button
          {...bind('right')}
          className="w-16 h-16 rounded-xl bg-card/70 backdrop-blur-sm border border-border flex items-center justify-center text-2xl active:bg-primary/30 transition-colors"
        >
          ▶
        </button>
      </div>
      
      {/* Horn: labelled like the pedals, so it does not look like a sound switch */}
      <button
        {...bind('horn')}
        aria-label="Horn"
        className="w-16 h-16 rounded-full bg-amber-400/80 backdrop-blur-sm border-2 border-amber-200 flex flex-col items-center justify-center font-arcade text-[10px] text-slate-900 shadow-lg active:bg-amber-300 transition-colors mb-1"
      >
        <span className="text-lg leading-none">🚗</span>
        HONK
      </button>
      
      {/* Pedals */}
      <div className="flex gap-2">
        <button
          {...bind('brake')}
          className="w-16 h-16 rounded-xl bg-destructive/40 backdrop-blur-sm border border-border flex items-center justify-center font-arcade text-[10px] text-foreground active:bg-destructive/60 transition-colors"
        >
          BRAKE
        </button>
        <button
          {...bind('accelerate')}
          className="w-16 h-20 rounded-xl bg-score-green/40 backdrop-blur-sm border border-border flex items-center justify-center font-arcade text-[10px] text-foreground active:bg-score-green/60 transition-colors"
        >
          GAS
        </button>
      </div>
    </div>
  );
}
