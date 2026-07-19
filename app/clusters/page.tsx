import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { SiteNav } from '../site-nav'

export default async function ClustersPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: clusters } = await supabase
    .from('clusters')
    .select('id, name, contribution_amount, fee_amount, frequency, status')
    .order('created_at', { ascending: false })

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Clusters</h1>
          <Link
            href="/clusters/new"
            className="rounded bg-foreground px-4 py-2 text-sm text-background"
          >
            New cluster
          </Link>
        </div>

        {clusters && clusters.length > 0 ? (
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/15">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Contribution</th>
                <th className="py-2 font-medium">Fee</th>
                <th className="py-2 font-medium">Frequency</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster) => (
                <tr key={cluster.id} className="border-b border-black/5 dark:border-white/10">
                  <td className="py-2">{cluster.name}</td>
                  <td className="py-2">{Number(cluster.contribution_amount).toFixed(2)}</td>
                  <td className="py-2">{Number(cluster.fee_amount).toFixed(2)}</td>
                  <td className="py-2 capitalize">{cluster.frequency}</td>
                  <td className="py-2 capitalize">{cluster.status}</td>
                  <td className="py-2 text-right">
                    <Link href={`/clusters/${cluster.id}/members`} className="underline">
                      Members
                    </Link>{' '}
                    <Link href={`/clusters/${cluster.id}/edit`} className="ml-2 underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            No clusters yet. Create one to get started.
          </p>
        )}
      </div>
    </>
  )
}
