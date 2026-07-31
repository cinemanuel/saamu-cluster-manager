import Link from 'next/link'

export function SiteNav() {
  return (
    <nav className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-medium">
          Saamu Cluster Manager
        </Link>
        <Link href="/clusters" className="text-muted hover:underline">
          Clusters
        </Link>
        <Link href="/dashboard" className="text-muted hover:underline">
          Dashboard
        </Link>
      </div>
      <form action="/auth/signout" method="post">
        <button type="submit" className="rounded border border-border px-3 py-1.5">
          Sign out
        </button>
      </form>
    </nav>
  )
}
