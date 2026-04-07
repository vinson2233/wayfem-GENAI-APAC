interface SafetyScoreRingProps {
  score: number
  size?: number
}

export default function SafetyScoreRing({ score, size = 120 }: SafetyScoreRingProps) {
  const radius = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  const clampedScore = Math.max(0, Math.min(10, score))
  const progress = clampedScore / 10
  const strokeDashoffset = circumference - progress * circumference

  const color =
    clampedScore >= 8
      ? '#16a34a'
      : clampedScore >= 5
      ? '#ca8a04'
      : clampedScore >= 3
      ? '#ea580c'
      : '#dc2626'

  const textColor =
    clampedScore >= 8
      ? 'text-green-700'
      : clampedScore >= 5
      ? 'text-yellow-700'
      : clampedScore >= 3
      ? 'text-orange-700'
      : 'text-red-700'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span className={`text-2xl font-bold ${textColor}`}>{clampedScore.toFixed(1)}</span>
          <span className="text-xs text-gray-400">/ 10</span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Safety Score</span>
    </div>
  )
}
