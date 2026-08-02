interface Props {
  value: number
  goal: number
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
}

export default function GoalRing({ value, goal, size = 80, stroke = 7, label, sublabel }: Props) {
  const v = value || 0
  const g = goal || 0
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = g > 0 ? Math.min(v / g, 1) : 0
  const offset = circumference * (1 - ratio)
  const pct = Math.round(ratio * 100)
  const reached = v >= g && g > 0

  const color = reached ? '#1a1a1a' : ratio >= 0.5 ? '#3a3a3a' : '#888888'

  return (
    <div className="goal-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="goal-ring-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e8e8e6"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="goal-ring-progress"
        />
      </svg>
      <div className="goal-ring-center">
        <span className="goal-ring-value" style={{ fontSize: Math.round(size * 0.24) }}>{pct}%</span>
        {label && <span className="goal-ring-label">{label}</span>}
      </div>
      {sublabel && <span className="goal-ring-sub">{sublabel}</span>}
    </div>
  )
}