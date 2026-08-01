import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { SiteNav } from '../site-nav'
import { StatusBadge, type StatusTone } from '../components/status-badge'
import { RotationRing } from '../components/rotation-ring'
import { buttonPrimary, buttonSecondary, buttonTertiary } from '../components/button-styles'

const clusterStatusTone: Record<string, StatusTone> = {
  draft: 'neutral',
  active: 'active',
  completed: 'positive',
  archived: 'neutral',
}

export default async function ClustersPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: clusters, error: clustersError } = await supabase
    .from('clusters')
    .select('id, name, contribution_amount, fee_type, fee_value, frequency, status, owner_id')
    .order('created_at', { ascending: false })

  const clusterIds = (clusters ?? []).map((cluster) => cluster.id)
  const ownerIds = Array.from(new Set((clusters ?? []).map((cluster) => cluster.owner_id)))

  // Resolving owner_id to an email so cross-coordinator oversight
  // (super-admins seeing every cluster) is actually usable — without
  // this there'd be no way to tell whose data is whose. For a
  // coordinator this just redundantly shows their own email on every
  // row, since RLS already limits them to their own clusters.
  let owners: { id: string; email: string }[] = []
  if (ownerIds.length > 0) {
    const { data } = await supabase.rpc('get_user_emails', { p_user_ids: ownerIds })
    owners = data ?? []
  }
  const emailByOwnerId = new Map(owners.map((owner) => [owner.id, owner.email]))

  const { data: slots } =
    clusterIds.length > 0
      ? await supabase.from('slots').select('cluster_id').in('cluster_id', clusterIds)
      : { data: [] }

  const { data: rotationCycles } =
    clusterIds.length > 0
      ? await supabase.from('cycles').select('cluster_id, cycle_number, status').in('cluster_id', clusterIds)
      : { data: [] }

  const positionCountByClusterId = new Map<string, number>()
  for (const slot of slots ?? []) {
    positionCountByClusterId.set(slot.cluster_id, (positionCountByClusterId.get(slot.cluster_id) ?? 0) + 1)
  }

  const activeCycleNumberByClusterId = new Map<string, number>()
  const completedCountByClusterId = new Map<string, number>()
  for (const cycle of rotationCycles ?? []) {
    if (cycle.status === 'active') {
      activeCycleNumberByClusterId.set(cycle.cluster_id, cycle.cycle_number)
    }
    if (cycle.status === 'completed') {
      completedCountByClusterId.set(
        cycle.cluster_id,
        (completedCountByClusterId.get(cycle.cluster_id) ?? 0) + 1
      )
    }
  }

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Clusters</h1>
          <Link href="/clusters/new" className={`${buttonPrimary} px-4 py-2 text-sm`}>
            New cluster
          </Link>
        </div>

        {clustersError ? (
          <p className="mt-6 text-sm text-danger">
            Could not load clusters: {clustersError.message}
          </p>
        ) : clusters && clusters.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-2 shadow-sm">
          <table className="w-full min-w-[880px] table-auto text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium text-muted">Name</th>
                <th className="py-2 pr-4 font-medium text-muted">Owner</th>
                <th className="py-2 pr-4 font-medium text-muted">Contribution</th>
                <th className="py-2 pr-4 font-medium text-muted">Fee</th>
                <th className="py-2 pr-4 font-medium text-muted">Frequency</th>
                <th className="py-2 pr-4 font-medium text-muted">Status</th>
                <th className="py-2 pr-4 font-medium text-muted">Rotation</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster) => {
                const totalPositions = positionCountByClusterId.get(cluster.id) ?? 0
                const activePosition = activeCycleNumberByClusterId.get(cluster.id) ?? null
                const completedCount = completedCountByClusterId.get(cluster.id) ?? 0
                return (
                  <tr key={cluster.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-bg">
                    <td className="py-3 pr-4 align-middle">{cluster.name}</td>
                    <td className="py-3 pr-4 align-middle">
                      {emailByOwnerId.get(cluster.owner_id) ?? '—'}
                    </td>
                    <td className="py-3 pr-4 align-middle">
                      {Number(cluster.contribution_amount).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 align-middle">
                      {cluster.fee_type === 'none'
                        ? 'No fee'
                        : cluster.fee_type === 'percentage'
                          ? `${Number(cluster.fee_value)}%`
                          : Number(cluster.fee_value).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 align-middle capitalize">{cluster.frequency}</td>
                    <td className="py-3 pr-4 align-middle">
                      <StatusBadge tone={clusterStatusTone[cluster.status] ?? 'neutral'}>
                        {cluster.status}
                      </StatusBadge>
                    </td>
                    <td className="py-3 pr-4 align-middle">
                      {totalPositions > 0 ? (
                        <RotationRing
                          totalPositions={totalPositions}
                          activePosition={activePosition}
                          completedCount={completedCount}
                          size={36}
                          ariaLabel={`${cluster.name}: ${
                            activePosition
                              ? `position ${activePosition} of ${totalPositions} active`
                              : `${completedCount} of ${totalPositions} positions complete`
                          }`}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 align-middle">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link href={`/clusters/${cluster.id}/members`} className={`${buttonSecondary} px-2 py-1 text-xs`}>
                          Members
                        </Link>
                        <Link href={`/clusters/${cluster.id}/slots`} className={`${buttonSecondary} px-2 py-1 text-xs`}>
                          Rotation
                        </Link>
                        <Link href={`/clusters/${cluster.id}/cycles`} className={`${buttonSecondary} px-2 py-1 text-xs`}>
                          Cycles
                        </Link>
                        <Link href={`/clusters/${cluster.id}/payouts`} className={`${buttonSecondary} px-2 py-1 text-xs`}>
                          Payouts
                        </Link>
                        <Link href={`/clusters/${cluster.id}/edit`} className={`${buttonTertiary} text-xs`}>
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            No clusters yet. Create one to get started.
          </p>
        )}
      </div>
    </>
  )
}
