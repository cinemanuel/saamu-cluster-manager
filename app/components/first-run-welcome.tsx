import Link from 'next/link'
import { buttonPrimary } from './button-styles'

// The real page flow, in order -- not invented, not a marketing pitch.
// Plain text, not links: there's no cluster yet for these to point at.
const FIRST_RUN_STEPS = ['Add members', 'Set up the rotation', 'Start your first cycle'] as const

/**
 * Replaces the terse "No clusters yet" card for a coordinator with zero
 * clusters -- same core message, but with a real CTA and an honest preview
 * of what happens next. `showCta` is false on the clusters list, which
 * already has its own prominent "New cluster" button in the page header;
 * showing a second, identical CTA directly below it would just be clutter.
 */
export function FirstRunWelcome({ showCta = true }: { showCta?: boolean }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
      <p className="text-sm text-muted">Create your first savings cluster to get started.</p>
      {showCta && (
        <Link href="/clusters/new" className={`${buttonPrimary} mt-4 inline-flex px-4 py-2 text-sm`}>
          Create your first cluster
        </Link>
      )}
      <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
        {FIRST_RUN_STEPS.map((step, index) => (
          <span key={step} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">&rarr;</span>}
            <span>{step}</span>
          </span>
        ))}
      </p>
    </div>
  )
}
