'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useSyncExternalStore } from 'react'
import { buttonSecondary } from './components/button-styles'

// SiteNav is rendered per-page (not from a shared layout), so it remounts on
// every navigation -- React state here would reset every time.
//
// Back/forward availability is derived from an index stamped onto each
// browser history entry's own `state` object (via history.replaceState), not
// from a session-wide "have I ever navigated" flag. That first version had a
// real bug: going /clusters -> /dashboard -> Back (to /clusters) left Back
// enabled, because the flag only ever asked "have I navigated at all this
// session," not "am I at the entry the app actually started from." A second
// Back click from there would have gone past /clusters to whatever was
// before the app (an auth redirect, an external referrer) -- silently
// leaving the app. history.state is restored per-entry by the browser
// itself on back/forward, so comparing the *current* entry's stamped index
// against the app's root index is correct even across SiteNav's remounts,
// and correctly re-disables Back once the user is actually back at the
// entry point again.
const NEXT_INDEX_KEY = 'saamu-nav-next-index'
const ROOT_INDEX_KEY = 'saamu-nav-root-index'

type NavHistoryState = { appNavIndex?: number } & Record<string, unknown>

function reconcileHistoryIndex() {
  const currentState = (window.history.state ?? {}) as NavHistoryState
  if (typeof currentState.appNavIndex === 'number') {
    return
  }
  const nextIndex = Number(sessionStorage.getItem(NEXT_INDEX_KEY) ?? '0')
  window.history.replaceState({ ...currentState, appNavIndex: nextIndex }, '')
  sessionStorage.setItem(NEXT_INDEX_KEY, String(nextIndex + 1))
  if (sessionStorage.getItem(ROOT_INDEX_KEY) === null) {
    sessionStorage.setItem(ROOT_INDEX_KEY, String(nextIndex))
  }
}

let listeners: Array<() => void> = []
function notifyListeners() {
  for (const listener of listeners) listener()
}
function subscribe(listener: () => void) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}
function getSnapshot() {
  const currentState = (window.history.state ?? {}) as NavHistoryState
  const currentIndex = currentState.appNavIndex
  const rootIndex = sessionStorage.getItem(ROOT_INDEX_KEY)
  const nextIndex = sessionStorage.getItem(NEXT_INDEX_KEY)
  if (typeof currentIndex !== 'number' || rootIndex === null || nextIndex === null) {
    return '0:0'
  }
  const canGoBack = currentIndex > Number(rootIndex)
  // The highest index handed out so far is the "front" of history any entry
  // could reach by going forward. Branching to a new link after going back
  // doesn't need special handling here -- the browser itself truncates the
  // old forward entries from real history, so there's nothing to reach even
  // though this counter never decreases.
  const canGoForward = currentIndex < Number(nextIndex) - 1
  return `${canGoBack ? '1' : '0'}:${canGoForward ? '1' : '0'}`
}
// sessionStorage/history.state don't exist during SSR -- disabled-by-default
// matches the first client paint too, since real state only lands once the
// effects below run and notify.
function getServerSnapshot() {
  return '0:0'
}

const navChromeButton =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:text-ink disabled:opacity-50 disabled:pointer-events-none'

function HistoryNav() {
  const router = useRouter()

  // No dependency array: reruns after every render, including a same-instance
  // re-render that isn't a remount (e.g. the dashboard's ?cluster= switcher,
  // which changes search params but not pathname). reconcileHistoryIndex()
  // is a no-op once the current entry is already stamped, so this is cheap.
  useEffect(() => {
    reconcileHistoryIndex()
    notifyListeners()
  })

  // Belt-and-suspenders for the case where a back/forward navigation somehow
  // doesn't produce a re-render of this instance at all.
  useEffect(() => {
    const handlePopState = () => {
      reconcileHistoryIndex()
      notifyListeners()
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [canGoBack, canGoForward] = snapshot.split(':').map((flag) => flag === '1')

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => router.back()} disabled={!canGoBack} aria-label="Go back" className={navChromeButton}>
        &larr;
      </button>
      <button type="button" onClick={() => router.forward()} disabled={!canGoForward} aria-label="Go forward" className={navChromeButton}>
        &rarr;
      </button>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      className={`border-b-2 pb-1 transition-colors ${
        isActive ? 'border-primary font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {children}
    </Link>
  )
}

export function SiteNav() {
  return (
    <nav className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <HistoryNav />
        <Link href="/" className="text-base font-semibold text-ink">
          Saamu Cluster Manager
        </Link>
        <NavLink href="/clusters">Clusters</NavLink>
        <NavLink href="/dashboard">Dashboard</NavLink>
      </div>
      <form action="/auth/signout" method="post">
        <button type="submit" className={`${buttonSecondary} px-3 py-2 text-sm`}>
          Sign out
        </button>
      </form>
    </nav>
  )
}
