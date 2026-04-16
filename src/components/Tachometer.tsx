interface TachometerProps {
  speed: number;
  maxSpeed?: number;
}

// Ferrari-style yellow tachometer. Speed is mapped to RPM-style sweep (0..10).
export function Tachometer({ speed, maxSpeed = 200 }: TachometerProps) {
  const size = 130;
  const cx = size / 2;
  const cy = size / 2;
  const r = 54;

  // Sweep from -135deg (left) to +135deg (right) = 270deg total
  const startAngle = -135;
  const endAngle = 135;
  const totalSweep = endAngle - startAngle;

  const ratio = Math.max(0, Math.min(1, speed / maxSpeed));
  const needleAngle = startAngle + totalSweep * ratio;

  // Tick marks: 0..10
  const ticks = Array.from({ length: 11 }, (_, i) => i);

  const polar = (angleDeg: number, radius: number) => {
    const a = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };

  return (
    <div
      className="relative"
      style={{ width: size, height: size, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.55))' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="tachFace" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#fff48a" />
            <stop offset="55%" stopColor="#f5c518" />
            <stop offset="100%" stopColor="#c98a05" />
          </radialGradient>
          <radialGradient id="tachBezel" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="#3a3a3a" />
            <stop offset="92%" stopColor="#1a1a1a" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
          <linearGradient id="needleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f8f8f8" />
            <stop offset="100%" stopColor="#9a9a9a" />
          </linearGradient>
        </defs>

        {/* Outer bezel */}
        <circle cx={cx} cy={cy} r={size / 2 - 1} fill="url(#tachBezel)" />
        <circle cx={cx} cy={cy} r={size / 2 - 6} fill="#0a0a0a" />
        {/* Yellow face */}
        <circle cx={cx} cy={cy} r={r + 6} fill="url(#tachFace)" />
        {/* Inner ring shadow */}
        <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />

        {/* Tick marks + numbers */}
        {ticks.map((t) => {
          const angle = startAngle + (totalSweep * t) / 10;
          const isRedline = t >= 8;
          const outer = polar(angle, r + 2);
          const inner = polar(angle, r - 6);
          const numPos = polar(angle, r - 17);
          return (
            <g key={t}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={isRedline ? '#c00' : '#0a0a0a'}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <text
                x={numPos.x}
                y={numPos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={700}
                fontFamily="'Orbitron', sans-serif"
                fill={isRedline ? '#c00' : '#0a0a0a'}
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* Minor ticks */}
        {Array.from({ length: 51 }, (_, i) => i).map((i) => {
          if (i % 5 === 0) return null;
          const angle = startAngle + (totalSweep * i) / 50;
          const isRedline = i >= 40;
          const outer = polar(angle, r + 1);
          const inner = polar(angle, r - 3);
          return (
            <line
              key={`m-${i}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={isRedline ? '#c00' : '#0a0a0a'}
              strokeWidth={1}
            />
          );
        })}

        {/* RPM label */}
        <text
          x={cx}
          y={cy - 16}
          textAnchor="middle"
          fontSize={7}
          fontWeight={700}
          fontFamily="'Orbitron', sans-serif"
          fill="#0a0a0a"
          letterSpacing={1}
        >
          RPM
        </text>
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fontSize={5}
          fontFamily="'Orbitron', sans-serif"
          fill="#0a0a0a"
        >
          x1000
        </text>

        {/* Prancing horse stand-in (shield) */}
        <g transform={`translate(${cx - 6}, ${cy + 2})`}>
          <path
            d="M6 0 L12 3 L12 8 Q12 12 6 14 Q0 12 0 8 L0 3 Z"
            fill="#0a0a0a"
          />
          <text
            x={6}
            y={9}
            textAnchor="middle"
            fontSize={6}
            fontWeight={900}
            fill="#f5c518"
            fontFamily="'Orbitron', sans-serif"
          >
            F
          </text>
        </g>

        {/* Digital speed window */}
        <rect
          x={cx + 14}
          y={cy + 18}
          width={32}
          height={14}
          rx={2}
          fill="#0a0a0a"
          stroke="#000"
        />
        <text
          x={cx + 30}
          y={cy + 25.5}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontWeight={700}
          fontFamily="'Orbitron', sans-serif"
          fill="#7fffa8"
        >
          {Math.round(speed)}
        </text>

        {/* Needle */}
        <g
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <polygon
            points={`${cx - 2},${cy + 8} ${cx + 2},${cy + 8} ${cx + 1},${cy - r + 4} ${cx - 1},${cy - r + 4}`}
            fill="url(#needleGrad)"
            stroke="#222"
            strokeWidth={0.5}
          />
          <circle cx={cx} cy={cy} r={6} fill="#1a1a1a" stroke="#444" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={2} fill="#666" />
        </g>
      </svg>

      {/* km/h label below */}
      <div className="absolute -bottom-1 left-0 right-0 text-center font-arcade text-[8px] text-foreground/80">
        km/h
      </div>
    </div>
  );
}
