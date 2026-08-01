'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buttonSecondary } from './components/button-styles'

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
    <nav className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 text-sm shadow-sm">
      <div className="flex items-center gap-6">
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
