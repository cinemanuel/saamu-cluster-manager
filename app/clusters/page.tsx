import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { SiteNav } from '../site-nav'

export default async function ClustersPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: clusters } = await supabase
    .from('clusters')
    .select('id, name, contribution_amount, fee_amount, frequency, status, owner_id')
    .order('created_at', { ascending: false })

  // Resolving owner_id to an email so cross-coordinator oversight
  // (super-admins seeing every cluster) is actually usable — without
  // this there'd be no way to tell whose data is whose. For a
  // coordinator this just redundantly shows their own email on every
  // row, since RLS already limits them to their own clusters.
  const ownerIds = Array.from(new Set((clusters ?? []).map((cluster) => cluster.owner_id)))
  let owners: { user_id: string; email: string }[] = []
  if (ownerIds.length > 0) {
    const { data } = await supabase.rpc('get_user_emails', { p_user_ids: ownerIds })
    owners = data ?? []
  }
  const emailByOwnerId = new Map(owners.map((owner) => [owner.user_id, owner.email]))

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
                <th className="py-2 font-medium">Owner</th>
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
                  <td className="py-2">{emailByOwnerId.get(cluster.owner_id) ?? '—'}</td>
                  <td className="py-2">{Number(cluster.contribution_amount).toFixed(2)}</td>
                  <td className="py-2">{Number(cluster.fee_amount).toFixed(2)}</td>
                  <td className="py-2 capitalize">{cluster.frequency}</td>
                  <td className="py-2 capitalize">{cluster.status}</td>
                  <td className="py-2 text-right">
                    <Link href={`/clusters/${cluster.id}/members`} className="underline">
                      Members
                    </Link>{' '}
                    <Link href={`/clusters/${cluster.id}/slots`} className="ml-2 underline">
                      Rotation
                    </Link>{' '}
                    <Link href={`/clusters/${cluster.id}/cycles`} className="ml-2 underline">
                      Cycles
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
