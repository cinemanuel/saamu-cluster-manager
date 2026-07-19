import Link from 'next/link'

export function SiteNav() {
  return (
    <nav className="flex items-center justify-between border-b border-black/10 px-4 py-3 text-sm dark:border-white/15">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-medium">
          Saamu Cluster Manager
        </Link>
        <Link href="/clusters" className="text-zinc-600 hover:underline dark:text-zinc-400">
          Clusters
        </Link>
      </div>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
        >
          Sign out
        </button>
      </form>
    </nav>
  )
}
