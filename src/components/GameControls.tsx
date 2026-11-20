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
      
      {/* Pedals, with the horn above them: the middle of the screen stays free for the car */}
      <div className="flex flex-col items-end gap-3">
        <button
          {...bind('horn')}
          aria-label="Horn"
          className="w-16 h-16 rounded-full bg-amber-400/80 backdrop-blur-sm border-2 border-amber-200 flex flex-col items-center justify-center font-arcade text-[10px] text-slate-900 shadow-lg active:bg-amber-300 transition-colors"
        >
          {/* a bulb horn */}
          <svg viewBox="0 0 28 24" className="h-8 w-9 -mb-0.5" aria-hidden="true">
            <g fill="currentColor">
              <circle cx="6.5" cy="17" r="5" />
              <path d="M9 12 11.5 14.5 14 12 11.5 9.5Z" />
              <path d="M11.5 8.5 15 12 21.5 10.5 13 2Z" />
            </g>
            <path d="M21 3.5 23.5 1.5M23 7 26.5 6.5M24 11 27 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          HONK
        </button>
        <div className="flex items-end gap-2">
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
    </div>
  );
}
