// Three-tier button hierarchy. See DESIGN_SYSTEM.md.
// These are class strings, not components, so they work identically on
// <button> (Server Action submits) and <Link> (navigation) alike. Callers
// append their own padding/text-size classes -- deliberately excluded here
// so a caller's sizing never fights the base string for the same property
// in Tailwind's generated stylesheet (last-in-source-order wins, not
// last-in-className).

export const buttonPrimary =
  'inline-flex items-center justify-center rounded-lg bg-primary font-medium text-white shadow-sm transition-colors hover:bg-primary-hover active:bg-primary-active disabled:opacity-50 disabled:pointer-events-none'

export const buttonSecondary =
  'inline-flex items-center justify-center rounded-lg border border-border bg-surface text-ink transition-colors hover:border-primary hover:text-primary'

export const buttonTertiary =
  'text-muted transition-colors hover:text-ink hover:underline'
