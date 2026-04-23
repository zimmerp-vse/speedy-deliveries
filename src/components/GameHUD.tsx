import { Tachometer } from './Tachometer';
import { RolexTimer } from './RolexTimer';
import { useEffect, useState } from 'react';
import { sounds } from '@/game/sounds';
import { Volume2, VolumeX } from 'lucide-react';

interface GameHUDProps {
  speed: number;
  money: number;
  round: number;
  totalRounds: number;
  timeRemaining: number;
  totalTime?: number;
}

// Luxury plaque shared by CASH and ROUND — black lacquer + gold trim
function LuxePlaque({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-md px-3 py-1.5 text-center ${className}`}
      style={{
        background:
          'linear-gradient(145deg, #0a0604 0%, #1a1208 45%, #0a0604 100%)',
        border: '1px solid #8a6418',
        boxShadow:
          '0 2px 6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(245,210,113,0.35), inset 0 0 0 1px rgba(0,0,0,0.4)',
      }}
    >
      {/* gold inner hairline */}
      <div
        className="pointer-events-none absolute rounded-[3px]"
        style={{
          inset: 3,
          border: '1px solid rgba(201,150,43,0.55)',
        }}
      />
      <div
        className="relative font-serif text-[9px] tracking-[0.25em]"
        style={{
          color: '#e6c976',
          textShadow: '0 1px 0 rgba(0,0,0,0.8)',
          letterSpacing: '0.25em',
        }}
      >
        {label}
      </div>
      <div
        className="relative font-serif text-lg font-bold leading-tight"
        style={{
          background:
            'linear-gradient(180deg, #fff2c2 0%, #f5d271 45%, #b8821f 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textShadow: '0 1px 0 rgba(0,0,0,0.4)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function GameHUD({
  speed,
  money,
  round,
  totalRounds,
  timeRemaining,
  totalTime = 45,
}: GameHUDProps) {
  // Responsive: smaller Rolex on mobile, and reposition so it doesn't cover the road
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const rolexSize = isMobile ? 92 : 200;

  return (
    <>
      {/* Top row: tachometer (left) + cash/round (center) + small Rolex on mobile (right) */}
      <div className="absolute top-3 sm:top-6 left-0 right-0 px-3 sm:px-4 flex justify-between items-start pointer-events-none z-10 gap-2">
        {/* Ferrari tachometer */}
        <div className="flex-shrink-0">
          <Tachometer speed={speed} maxSpeed={200} />
        </div>

        {/* Center cluster: ROUND + CASH luxury plaques */}
        <div className="flex flex-col gap-1.5 sm:gap-2 items-center pt-1">
          <LuxePlaque label="ROUND">
            {round}
            <span
              className="text-xs"
              style={{
                background:
                  'linear-gradient(180deg, #c9962b 0%, #6b4a13 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              /{totalRounds}
            </span>
          </LuxePlaque>
          <LuxePlaque label="CASH">${money.toLocaleString()}</LuxePlaque>
        </div>

        {/* Right slot: on mobile show small Rolex; on desktop keep right side reserved (Rolex shown below) */}
        <div className="flex-shrink-0">
          {isMobile && (
            <RolexTimer
              timeRemaining={timeRemaining}
              totalTime={totalTime}
              size={rolexSize}
            />
          )}
        </div>
      </div>

      {/* Desktop-only large Rolex, positioned top-right so it doesn't crowd the center */}
      {!isMobile && (
        <div className="absolute top-6 right-4 pointer-events-none z-10">
          <RolexTimer
            timeRemaining={timeRemaining}
            totalTime={totalTime}
            size={rolexSize}
          />
        </div>
      )}

      {/* Mute toggle */}
      <MuteButton />
    </>
  );
}

function MuteButton() {
  const [muted, setMuted] = useState(sounds.isMuted());
  return (
    <button
      type="button"
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      onClick={() => {
        sounds.ensureContext();
        const next = !muted;
        sounds.setMuted(next);
        setMuted(next);
      }}
      className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border text-foreground/80 backdrop-blur-sm transition hover:text-foreground"
      style={{
        background: 'linear-gradient(145deg, #0a0604 0%, #1a1208 45%, #0a0604 100%)',
        borderColor: '#8a6418',
        boxShadow: '0 2px 6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(245,210,113,0.35)',
        color: '#e6c976',
      }}
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
}
