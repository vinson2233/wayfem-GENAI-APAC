interface SafetyScoreRingProps {
  score: number
  size?: number
}

export default function SafetyScoreRing({ score, size = 120 }: SafetyScoreRingProps) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const clampedScore = Math.max(0, Math.min(10, score))
  const progress = clampedScore / 10
  const strokeDashoffset = circumference - progress * circumference

  const color =
    clampedScore >= 8
      ? '#16a34a'
      : clampedScore >= 5
      ? '#cf6f68'
      : clampedScore >= 3
      ? '#a85049'
      : '#7d3a36'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#ece5e0"
            strokeWidth="2"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[2.4rem] leading-none text-ink-500 tracking-tightest">
            {clampedScore.toFixed(1)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mt-1">/ ten</span>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-[0.22em] text-ink-300">Safety index</span>
    </div>
  )
}
