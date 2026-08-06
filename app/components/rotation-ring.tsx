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
  size = 40,
  ariaLabel,
}: {
  /** Total number of positions in the cluster's rotation. */
  totalPositions: number
  /** 1-indexed turn currently active, or null if not started / no active cycle. */
  activePosition: number | null
  /** Count of positions that have already completed their payout. */
  completedCount: number
  /** Diameter in pixels. Defaults to a legible size for list/tile use -- this
   * is the app's signature element, not incidental decoration, so it should
   * never shrink to the point of being unreadable. */
  size?: number
  /** Required -- this is a visual-only indicator otherwise. */
  ariaLabel: string
}) {
  if (totalPositions <= 0) {
    return null
  }

  const cx = size / 2
  const cy = size / 2
  const strokeWidth = size * 0.16
  // Inset by half the stroke width (plus a 1px margin) so the round stroke
  // caps stay inside the viewBox instead of clipping at the outer edge.
  const r = size / 2 - strokeWidth / 2 - 1
  const segmentDeg = 360 / totalPositions
  const gapDeg = totalPositions > 1 ? Math.min(6, segmentDeg * 0.2) : 0
  // The ring alone doesn't communicate "3 of 5" at a glance -- the legend
  // makes it a legible readout, not just a decorative dial.
  const legend = activePosition !== null ? `${activePosition}/${totalPositions}` : `${completedCount}/${totalPositions}`
  const legendTextClass = size >= 48 ? 'text-sm font-medium text-ink' : 'text-xs font-medium text-muted'

  const colorForSegment = (index: number) => {
    const isActive = activePosition !== null && index === activePosition - 1
    const isCompleted = index < completedCount
    return isActive ? 'var(--color-ring-active)' : isCompleted ? 'var(--color-primary)' : 'var(--color-muted)'
  }

  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
        {totalPositions === 1 ? (
          // A single position has no gap to draw between -- a 0deg-360deg arc
          // has coincident start/end points and doesn't render. Two 180deg
          // arcs trace the same full circle without that degenerate case.
          <>
            <path d={describeArc(cx, cy, r, 0, 180)} fill="none" stroke={colorForSegment(0)} strokeWidth={strokeWidth} strokeLinecap="round" />
            <path d={describeArc(cx, cy, r, 180, 360)} fill="none" stroke={colorForSegment(0)} strokeWidth={strokeWidth} strokeLinecap="round" />
          </>
        ) : (
          Array.from({ length: totalPositions }).map((_, index) => {
            const startAngle = index * segmentDeg + gapDeg / 2
            const endAngle = (index + 1) * segmentDeg - gapDeg / 2
            return (
              <path
                key={index}
                d={describeArc(cx, cy, r, startAngle, endAngle)}
                fill="none"
                stroke={colorForSegment(index)}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            )
          })
        )}
      </svg>
      <span className={legendTextClass} aria-hidden="true">
        {legend}
      </span>
    </span>
  )
}
