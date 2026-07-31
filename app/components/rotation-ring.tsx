// A small circular dial representing a cluster's rotation: one segment
// per position, filled as each position completes its payout, with the
// current turn highlighted -- the real ajo/esusu "wheel," not decoration.
// See DESIGN_SYSTEM.md for the prop contract and color rules.

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

export function RotationRing({
  totalPositions,
  activePosition,
  completedCount,
  size = 32,
  ariaLabel,
}: {
  /** Total number of positions in the cluster's rotation. */
  totalPositions: number
  /** 1-indexed turn currently active, or null if not started / no active cycle. */
  activePosition: number | null
  /** Count of positions that have already completed their payout. */
  completedCount: number
  /** Diameter in pixels. Defaults to a compact size for list/tile use. */
  size?: number
  /** Required -- this is a visual-only indicator otherwise. */
  ariaLabel: string
}) {
  if (totalPositions <= 0) {
    return null
  }

  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 3
  const segmentDeg = 360 / totalPositions
  const gapDeg = totalPositions > 1 ? Math.min(6, segmentDeg * 0.2) : 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
      {Array.from({ length: totalPositions }).map((_, index) => {
        const startAngle = index * segmentDeg + gapDeg / 2
        const endAngle = (index + 1) * segmentDeg - gapDeg / 2
        const isActive = activePosition !== null && index === activePosition - 1
        const isCompleted = index < completedCount
        const color = isActive
          ? 'var(--color-accent)'
          : isCompleted
            ? 'var(--color-primary)'
            : 'var(--color-border)'
        return (
          <path
            key={index}
            d={describeArc(cx, cy, r, startAngle, endAngle)}
            fill="none"
            stroke={color}
            strokeWidth={size * 0.16}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}
