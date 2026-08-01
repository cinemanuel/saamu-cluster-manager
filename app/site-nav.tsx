'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useSyncExternalStore } from 'react'
import { buttonSecondary } from './components/button-styles'

// SiteNav is rendered per-page (not from a shared layout), so it remounts on
// every navigation -- React state here would reset every time. sessionStorage
// survives the remount but is scoped to this tab, which is the right lifetime
// for "history within this visit." useSyncExternalStore (rather than
// effect+setState) is the React-recommended way to read a mutable source like
// this: the effect below only writes to storage and notifies subscribers, it
// never calls setState itself.
const LAST_PATH_KEY = 'saamu-nav-last-path'
const CAN_FORWARD_KEY = 'saamu-nav-can-forward'
const CAN_GO_BACK_KEY = 'saamu-nav-can-go-back'
const PENDING_ACTION_KEY = 'saamu-nav-pending-action'

function updateNavState(pathname: string) {
  const lastPath = sessionStorage.getItem(LAST_PATH_KEY)
  const isFirstPageOfSession = lastPath === null
  const pendingAction = sessionStorage.getItem(PENDING_ACTION_KEY)
  sessionStorage.removeItem(PENDING_ACTION_KEY)

  let canForward = sessionStorage.getItem(CAN_FORWARD_KEY) === '1'
  if (!isFirstPageOfSession && pathname !== lastPath) {
    if (pendingAction === 'back') {
      canForward = true
    } else if (pendingAction !== 'forward') {
      // A regular navigation (not our own back/forward buttons) breaks the
      // forward chain, the same way clicking a link does in any browser.
      canForward = false
    }
  }

  sessionStorage.setItem(LAST_PATH_KEY, pathname)
  sessionStorage.setItem(CAN_FORWARD_KEY, canForward ? '1' : '0')
  sessionStorage.setItem(CAN_GO_BACK_KEY, isFirstPageOfSession ? '0' : '1')
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
  return `${sessionStorage.getItem(CAN_GO_BACK_KEY)}:${sessionStorage.getItem(CAN_FORWARD_KEY)}`
}
// sessionStorage doesn't exist during SSR -- disabled-by-default matches the
// first client paint too, since real state only lands once the effect below
// runs and notifies.
function getServerSnapshot() {
  return '0:0'
}

const navChromeButton =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:text-ink disabled:opacity-50 disabled:pointer-events-none'

function HistoryNav() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    updateNavState(pathname)
    notifyListeners()
  }, [pathname])

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [canGoBack, canGoForward] = snapshot.split(':').map((flag) => flag === '1')

  const handleBack = () => {
    sessionStorage.setItem(PENDING_ACTION_KEY, 'back')
    router.back()
  }

  const handleForward = () => {
    sessionStorage.setItem(PENDING_ACTION_KEY, 'forward')
    router.forward()
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={handleBack} disabled={!canGoBack} aria-label="Go back" className={navChromeButton}>
        &larr;
      </button>
      <button type="button" onClick={handleForward} disabled={!canGoForward} aria-label="Go forward" className={navChromeButton}>
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
