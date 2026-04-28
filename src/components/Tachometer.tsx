interface TachometerProps {
  speed: number;
  maxSpeed?: number;
  size?: number;
}

// Ferrari-style yellow speedometer (km/h). Needle sweeps from 0 to maxSpeed.
export function Tachometer({ speed, maxSpeed = 220, size = 190 }: TachometerProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  // Sweep from -135deg (left) to +135deg (right) = 270deg total
  const startAngle = -135;
  const endAngle = 135;
  const totalSweep = endAngle - startAngle;

  const ratio = Math.max(0, Math.min(1, speed / maxSpeed));
  const needleAngle = startAngle + totalSweep * ratio;

  // Major ticks every 20 km/h: 0, 20, 40, ..., 220
  const step = 20;
  const majorTicks: number[] = [];
  for (let v = 0; v <= maxSpeed; v += step) majorTicks.push(v);

  const polar = (angleDeg: number, radius: number) => {
    const a = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };

  const redlineSpeed = maxSpeed * 0.8; // last 20% is redline

  return (
    <div
      className="relative pointer-events-none"
      style={{ width: size, height: size, filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.55))' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id="tachFace" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#fff48a" />
            <stop offset="55%" stopColor="#f5c518" />
            <stop offset="100%" stopColor="#b67d04" />
          </radialGradient>
          <radialGradient id="tachBezel" cx="50%" cy="50%" r="50%">
            <stop offset="78%" stopColor="#4a4a4a" />
            <stop offset="92%" stopColor="#1a1a1a" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
          <linearGradient id="needleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#888888" />
          </linearGradient>
          <radialGradient id="hubGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#666" />
            <stop offset="60%" stopColor="#1c1c1c" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
        </defs>

        {/* Outer bezel */}
        <circle cx={cx} cy={cy} r={size / 2 - 1} fill="url(#tachBezel)" />
        <circle cx={cx} cy={cy} r={size / 2 - 8} fill="#0a0a0a" />
        {/* Yellow face */}
        <circle cx={cx} cy={cy} r={r + 8} fill="url(#tachFace)" />
        <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={1} />

        {/* Redline arc */}
        {(() => {
          const a1 = startAngle + totalSweep * (redlineSpeed / maxSpeed);
          const a2 = endAngle;
          const arcR = r + 4;
          const p1 = polar(a1, arcR);
          const p2 = polar(a2, arcR);
          const largeArc = a2 - a1 > 180 ? 1 : 0;
          return (
            <path
              d={`M ${p1.x} ${p1.y} A ${arcR} ${arcR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`}
              stroke="#c00"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
            />
          );
        })()}

        {/* Major ticks + numbers */}
        {majorTicks.map((v) => {
          const angle = startAngle + (totalSweep * v) / maxSpeed;
          const isRedline = v >= redlineSpeed;
          const outer = polar(angle, r + 2);
          const inner = polar(angle, r - 8);
          const numPos = polar(angle, r - 22);
          return (
            <g key={v}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={isRedline ? '#c00' : '#0a0a0a'}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <text
                x={numPos.x}
                y={numPos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={800}
                fontFamily="'Orbitron', sans-serif"
                fill={isRedline ? '#c00' : '#0a0a0a'}
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Minor ticks every 5 km/h */}
        {Array.from({ length: Math.floor(maxSpeed / 5) + 1 }, (_, i) => i * 5).map((v) => {
          if (v % step === 0) return null;
          const angle = startAngle + (totalSweep * v) / maxSpeed;
          const isRedline = v >= redlineSpeed;
          const outer = polar(angle, r + 1);
          const inner = polar(angle, r - 4);
          return (
            <line
              key={`m-${v}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={isRedline ? '#c00' : '#0a0a0a'}
              strokeWidth={1.2}
            />
          );
        })}

        {/* km/h label */}
        <text
          x={cx}
          y={cy - 28}
          textAnchor="middle"
          fontSize={9}
          fontWeight={800}
          fontFamily="'Orbitron', sans-serif"
          fill="#0a0a0a"
          letterSpacing={2}
        >
          km/h
        </text>

        {/* Prancing horse stand-in (shield) */}
        <g transform={`translate(${cx - 9}, ${cy - 14})`}>
          <path
            d="M9 0 L18 4 L18 12 Q18 18 9 21 Q0 18 0 12 L0 4 Z"
            fill="#0a0a0a"
            stroke="#c00"
            strokeWidth={0.8}
          />
          <text
            x={9}
            y={13}
            textAnchor="middle"
            fontSize={9}
            fontWeight={900}
            fill="#f5c518"
            fontFamily="'Orbitron', sans-serif"
          >
            F
          </text>
        </g>

        {/* Digital speed window */}
        <rect
          x={cx - 26}
          y={cy + 22}
          width={52}
          height={20}
          rx={3}
          fill="#0a0a0a"
          stroke="#000"
        />
        <text
          x={cx}
          y={cy + 33}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={14}
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
            transition: 'transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <polygon
            points={`${cx - 3},${cy + 14} ${cx + 3},${cy + 14} ${cx + 1.2},${cy - r + 6} ${cx - 1.2},${cy - r + 6}`}
            fill="url(#needleGrad)"
            stroke="#222"
            strokeWidth={0.6}
          />
          <circle cx={cx} cy={cy} r={9} fill="url(#hubGrad)" stroke="#000" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={3} fill="#888" />
        </g>
      </svg>
    </div>
  );
}
