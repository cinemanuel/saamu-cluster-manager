export type StatusTone = 'positive' | 'active' | 'neutral' | 'danger'

// Amber (accent) fails AA contrast as plain text (2.86:1) -- it is only
// ever used as a badge fill with ink text. See DESIGN_SYSTEM.md.
const toneClasses: Record<StatusTone, string> = {
  positive: 'bg-primary text-white',
  active: 'bg-accent text-ink',
  neutral: 'bg-border text-ink',
  danger: 'bg-danger text-white',
}

export function StatusBadge({
  tone,
  children,
  className = '',
}: {
  tone: StatusTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
