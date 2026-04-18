interface RolexTimerProps {
  timeRemaining: number;
  totalTime: number;
}

export function RolexTimer({ timeRemaining, totalTime }: RolexTimerProps) {
  const seconds = Math.ceil(timeRemaining);
  const isLow = seconds <= 10;
  // Map remaining time to a clock position: full = 12 o'clock, empty = 12 o'clock again (one full sweep)
  const progress = Math.max(0, Math.min(1, 1 - timeRemaining / totalTime));
  // Sweep second hand: 360deg over the round (acts like "time elapsed")
  const secondAngle = progress * 360;
  // Minute hand moves slower (quarter speed) for visual interest
  const minuteAngle = progress * 90;
  // Hour hand barely moves
  const hourAngle = progress * 30 + 90; // start ~3 o'clock-ish

  const size = 110;
  const cx = size / 2;
  const cy = size / 2;

  // Tick marks around dial
  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="relative pointer-events-none select-none" style={{ width: size, height: size }}>
      {/* Outer engraved bezel (knurled gold) */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'repeating-conic-gradient(from 0deg, #6b4a13 0deg 3deg, #c9962b 3deg 6deg, #f5d271 6deg 9deg, #b8821f 9deg 12deg)',
          boxShadow:
            '0 4px 12px rgba(0,0,0,0.6), inset 0 0 0 2px #4a3208, inset 0 2px 4px rgba(255,230,150,0.4)',
        }}
      />
      {/* Inner case rim */}
      <div
        className="absolute rounded-full"
        style={{
          inset: 8,
          background: 'radial-gradient(circle at 30% 25%, #f7e08a, #c9962b 60%, #8a5e10)',
          boxShadow: 'inset 0 0 6px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,240,180,0.6)',
        }}
      />
      {/* Champagne sunburst dial */}
      <div
        className="absolute rounded-full overflow-hidden"
        style={{
          inset: 14,
          background:
            'radial-gradient(circle at 50% 50%, #f5d98a 0%, #e0b860 45%, #b48830 100%)',
          boxShadow: 'inset 0 0 8px rgba(80,50,10,0.6)',
        }}
      >
        {/* Sunburst rays */}
        <div
          className="absolute inset-0 rounded-full opacity-50"
          style={{
            background:
              'repeating-conic-gradient(from 0deg, rgba(255,240,200,0.5) 0deg 1deg, rgba(120,80,20,0.15) 1deg 3deg)',
          }}
        />

        <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 w-full h-full">
          {/* Tick marks */}
          {ticks.map((i) => {
            const angle = (i * 6 * Math.PI) / 180;
            const isHour = i % 5 === 0;
            const r1 = size / 2 - (isHour ? 16 : 15);
            const r2 = size / 2 - (isHour ? 19 : 17);
            const x1 = cx + Math.sin(angle) * r1;
            const y1 = cy - Math.cos(angle) * r1;
            const x2 = cx + Math.sin(angle) * r2;
            const y2 = cy - Math.cos(angle) * r2;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#3a2608"
                strokeWidth={isHour ? 1.3 : 0.6}
                strokeLinecap="round"
              />
            );
          })}

          {/* Hour markers (small applied dots) */}
          {[0, 1, 2, 4, 5, 6, 7, 8, 10, 11].map((h) => {
            const angle = (h * 30 * Math.PI) / 180;
            const r = size / 2 - 22;
            const x = cx + Math.sin(angle) * r;
            const y = cy - Math.cos(angle) * r;
            return (
              <circle
                key={h}
                cx={x}
                cy={y}
                r={1.6}
                fill="#3a2608"
              />
            );
          })}

          {/* Crown at 12 */}
          <g transform={`translate(${cx}, ${cy - size / 2 + 22})`}>
            <path
              d="M -3 0 L -2 -2 L -1 -1 L 0 -2.5 L 1 -1 L 2 -2 L 3 0 Z"
              fill="#3a2608"
            />
          </g>

          {/* ROLEX text */}
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            fontSize="5"
            fontWeight="700"
            fill="#2a1a05"
            fontFamily="serif"
            letterSpacing="0.5"
          >
            ROLEX
          </text>
          <text
            x={cx}
            y={cy - 2.5}
            textAnchor="middle"
            fontSize="2.4"
            fill="#2a1a05"
            fontFamily="serif"
            letterSpacing="0.3"
          >
            OYSTER PERPETUAL
          </text>
          <text
            x={cx}
            y={cy + 1.2}
            textAnchor="middle"
            fontSize="2.2"
            fill="#2a1a05"
            fontFamily="serif"
            letterSpacing="0.3"
          >
            — DATE —
          </text>

          {/* Date window at 3 o'clock */}
          <g>
            <rect
              x={cx + size / 2 - 32}
              y={cy - 5}
              width={12}
              height={10}
              rx={1}
              fill="#fdf6e3"
              stroke="#2a1a05"
              strokeWidth={0.4}
            />
            {/* Cyclops magnifier highlight */}
            <rect
              x={cx + size / 2 - 32}
              y={cy - 5}
              width={12}
              height={10}
              rx={1}
              fill="url(#cyclops)"
              opacity={0.35}
            />
            <text
              x={cx + size / 2 - 26}
              y={cy + 2.8}
              textAnchor="middle"
              fontSize="7"
              fontWeight="700"
              fill={isLow ? '#c0392b' : '#1a1205'}
              fontFamily="serif"
            >
              {seconds}
            </text>
          </g>

          {/* SUPERLATIVE CHRONOMETER */}
          <text
            x={cx}
            y={cy + size / 4 + 4}
            textAnchor="middle"
            fontSize="2.2"
            fill="#2a1a05"
            fontFamily="serif"
            letterSpacing="0.3"
          >
            SUPERLATIVE CHRONOMETER
          </text>
          <text
            x={cx}
            y={cy + size / 4 + 7}
            textAnchor="middle"
            fontSize="2.2"
            fill="#2a1a05"
            fontFamily="serif"
            letterSpacing="0.3"
          >
            OFFICIALLY CERTIFIED
          </text>

          {/* Hour hand */}
          <g transform={`rotate(${hourAngle} ${cx} ${cy})`}>
            <rect x={cx - 1.2} y={cy - size / 2 + 26} width={2.4} height={size / 2 - 32} rx={0.6} fill="#2a1a05" />
          </g>
          {/* Minute hand */}
          <g transform={`rotate(${minuteAngle} ${cx} ${cy})`}>
            <rect x={cx - 0.9} y={cy - size / 2 + 20} width={1.8} height={size / 2 - 24} rx={0.4} fill="#2a1a05" />
          </g>
          {/* Second hand (sweep) */}
          <g transform={`rotate(${secondAngle} ${cx} ${cy})`}>
            <rect
              x={cx - 0.4}
              y={cy - size / 2 + 16}
              width={0.8}
              height={size / 2 - 12}
              fill={isLow ? '#c0392b' : '#1a1205'}
            />
            <circle cx={cx} cy={cy} r={1.6} fill={isLow ? '#c0392b' : '#1a1205'} />
          </g>

          {/* Center pin */}
          <circle cx={cx} cy={cy} r={1} fill="#f5d98a" />

          <defs>
            <linearGradient id="cyclops" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#fff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Glass reflection */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 100%)',
          }}
        />
      </div>

      {/* Low-time pulse ring */}
      {isLow && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{ boxShadow: '0 0 16px 4px rgba(192,57,43,0.7)' }}
        />
      )}
    </div>
  );
}
