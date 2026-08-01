import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { SiteNav } from '../site-nav'
import { StatusBadge, type StatusTone } from '../components/status-badge'
import { RotationRing } from '../components/rotation-ring'
import { buttonSecondary, buttonTertiary } from '../components/button-styles'

const clusterStatusTone: Record<string, StatusTone> = {
  draft: 'neutral',
  active: 'active',
  completed: 'positive',
  archived: 'neutral',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cluster?: string }>
}) {
  const { cluster: requestedClusterId } = await searchParams
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const [isSuperAdminResult, clustersResult] = await Promise.all([
    supabase.rpc('is_super_admin'),
    supabase
      .from('clusters')
      .select('id, name, contribution_amount, fee_type, fee_value, status, owner_id')
      .order('created_at', { ascending: false }),
  ])
  const isSuperAdmin = isSuperAdminResult.data === true
  // A failed role check must not fail open: defaulting to "not super-admin"
  // on an RPC error would render the Edit link for a real super-admin.
  const isSuperAdminUnknown = isSuperAdminResult.error !== null
  const { data: clusters, error: clustersError } = clustersResult

  // Same owner-email resolution as the clusters list — only a super-admin's
  // switcher (spanning every coordinator) ever reads this; skip the round
  // trip entirely for an ordinary coordinator, whose own email is redundant.
  const ownerIds = Array.from(new Set((clusters ?? []).map((cluster) => cluster.owner_id)))
  let owners: { id: string; email: string }[] = []
  if (isSuperAdmin && ownerIds.length > 0) {
    const { data } = await supabase.rpc('get_user_emails', { p_user_ids: ownerIds })
    owners = data ?? []
  }
  const emailByOwnerId = new Map(owners.map((owner) => [owner.id, owner.email]))

  const selectedClusterId = requestedClusterId ?? clusters?.[0]?.id ?? null
  const selectedCluster = (clusters ?? []).find((cluster) => cluster.id === selectedClusterId) ?? null

  let cycles: { id: string; cycle_number: number; slot_id: string; status: string; start_date: string; end_date: string | null }[] = []
  let cyclesError: { message: string } | null = null
  let members: { id: string; full_name: string }[] = []
  let payments: { status: string; due_date: string }[] = []
  let paymentsError: { message: string } | null = null
  let slotMembers: { member_id: string }[] = []
  let slotMembersError: { message: string } | null = null
  let payoutsTotalFees: number | null = null
  let payoutsError: { message: string } | null = null
  let feeAmountData: number | null = null
  let feeError: { message: string } | null = null
  let activeCycle: (typeof cycles)[number] | null = null
  let totalPot = 0
  let totalPositions = 0
  let slotsError: { message: string } | null = null

  if (selectedCluster) {
    const [cyclesResult, membersResult, slotsResult] = await Promise.all([
      supabase
        .from('cycles')
        .select('id, cycle_number, slot_id, status, start_date, end_date')
        .eq('cluster_id', selectedCluster.id)
        .order('cycle_number', { ascending: true }),
      supabase.from('members').select('id, full_name').eq('cluster_id', selectedCluster.id),
      supabase.from('slots').select('id').eq('cluster_id', selectedCluster.id),
    ])
    cycles = cyclesResult.data ?? []
    cyclesError = cyclesResult.error
    members = membersResult.data ?? []
    totalPositions = (slotsResult.data ?? []).length
    slotsError = slotsResult.error

    activeCycle = cycles.find((cycle) => cycle.status === 'active') ?? null
    totalPot = members.length * Number(selectedCluster.contribution_amount)

    if (activeCycle) {
      const [paymentsResult, slotMembersResult] = await Promise.all([
        supabase.from('payments').select('status, due_date').eq('cycle_id', activeCycle.id),
        supabase.from('slot_members').select('member_id').eq('slot_id', activeCycle.slot_id),
      ])
      payments = paymentsResult.data ?? []
      paymentsError = paymentsResult.error
      slotMembers = slotMembersResult.data ?? []
      slotMembersError = slotMembersResult.error

      const feeResult = await supabase.rpc('calculate_coordinator_fee', {
        p_fee_type: selectedCluster.fee_type,
        p_fee_value: selectedCluster.fee_value,
        p_total_pot: totalPot,
      })
      feeAmountData = feeResult.error ? null : Number(feeResult.data ?? 0)
      feeError = feeResult.error
    }

    const cycleIds = cycles.map((cycle) => cycle.id)
    const payoutsResult =
      cycleIds.length > 0
        ? await supabase.from('payouts').select('fee_amount').in('cycle_id', cycleIds)
        : { data: [], error: null }
    payoutsError = payoutsResult.error
    payoutsTotalFees = payoutsResult.error
      ? null
      : (payoutsResult.data ?? []).reduce((sum, payout) => sum + Number(payout.fee_amount), 0)
  }

  const lastCycle = cycles.length > 0 ? cycles[cycles.length - 1] : null
  const completedCount = cycles.filter((cycle) => cycle.status === 'completed').length
  const fullNameByMemberId = new Map(members.map((member) => [member.id, member.full_name]))
  const collectorNames = slotMembers
    .map((sm) => fullNameByMemberId.get(sm.member_id))
    .filter((name): name is string => Boolean(name))

  const today = new Date().toISOString().slice(0, 10)
  const paidCount = payments.filter((payment) => payment.status === 'paid').length
  const lateCount = payments.filter(
    (payment) => payment.status === 'pending' && payment.due_date < today
  ).length
  const pendingCount = payments.filter(
    (payment) => payment.status === 'pending' && payment.due_date >= today
  ).length
  const waivedCount = payments.filter((payment) => payment.status === 'waived').length

  const rawNetPayout = feeAmountData === null ? null : totalPot - feeAmountData
  // advance_cycle rejects any cycle completion where the fee would exceed
  // the pot (net_payout < 0) rather than recording a negative payout —
  // this is a live pre-completion projection, so it can't rely on that
  // guard existing yet and must clamp + warn the same way itself.
  const feeExceedsPot = rawNetPayout !== null && rawNetPayout < 0
  const netPayout = rawNetPayout === null ? null : Math.max(0, rawNetPayout)

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {isSuperAdmin && (
          <p className="mt-1 text-xs text-muted">
            Viewing as super-admin — read-only across all coordinators.
          </p>
        )}

        {clustersError ? (
          <p className="mt-6 text-sm text-danger">
            Could not load clusters: {clustersError.message}
          </p>
        ) : !clusters || clusters.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No clusters yet.{' '}
            <Link href="/clusters/new" className="underline">
              Create one
            </Link>{' '}
            to get started.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {clusters.map((cluster) => (
                <Link
                  key={cluster.id}
                  href={`/dashboard?cluster=${cluster.id}`}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    cluster.id === selectedCluster?.id
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-surface hover:border-primary hover:text-primary'
                  }`}
                >
                  {cluster.name}
                  {isSuperAdmin ? ` — ${emailByOwnerId.get(cluster.owner_id) ?? 'unknown owner'}` : ''}
                </Link>
              ))}
            </div>

            {!selectedCluster ? (
              <p className="mt-6 text-sm text-danger">
                Cluster not found, or you don&apos;t have access to it.
              </p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <Link href={`/clusters/${selectedCluster.id}/members`} className={`${buttonSecondary} px-3 py-2 text-sm`}>
                    Members
                  </Link>
                  <Link href={`/clusters/${selectedCluster.id}/slots`} className={`${buttonSecondary} px-3 py-2 text-sm`}>
                    Rotation
                  </Link>
                  <Link href={`/clusters/${selectedCluster.id}/cycles`} className={`${buttonSecondary} px-3 py-2 text-sm`}>
                    Cycles
                  </Link>
                  <Link href={`/clusters/${selectedCluster.id}/payouts`} className={`${buttonSecondary} px-3 py-2 text-sm`}>
                    Payouts
                  </Link>
                  {/* Other cluster pages (list, cycles, payments) don't yet hide their
                      write actions for super-admins — RLS blocks the write itself, but
                      the button still renders and would error if clicked. Only this
                      dashboard hides them so far; see BUILD_LOG Entry 9 fast-follow. */}
                  {!isSuperAdmin && !isSuperAdminUnknown && (
                    <Link href={`/clusters/${selectedCluster.id}/edit`} className={buttonTertiary}>
                      Edit
                    </Link>
                  )}
                </div>

                <div className="mt-6">
                  <h2 className="text-sm font-medium text-muted">
                    Cluster status
                  </h2>
                  {cyclesError ? (
                    <p className="mt-2 text-sm text-danger">
                      Could not load cluster status: {cyclesError.message}
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-6 text-sm shadow-sm sm:grid-cols-4">
                      <div>
                        <p className="text-muted">Status</p>
                        <p className="mt-1">
                          <StatusBadge tone={clusterStatusTone[selectedCluster.status] ?? 'neutral'}>
                            {selectedCluster.status}
                          </StatusBadge>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">Current cycle</p>
                        <p className="font-medium">
                          {activeCycle
                            ? `Cycle ${activeCycle.cycle_number}`
                            : selectedCluster.status === 'completed' && lastCycle
                              ? `Completed at cycle ${lastCycle.cycle_number}`
                              : 'Not started yet'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">Start date</p>
                        <p className="font-medium">
                          {activeCycle
                            ? activeCycle.start_date
                            : selectedCluster.status === 'completed' && lastCycle
                              ? lastCycle.start_date
                              : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">Rotation</p>
                        {slotsError ? (
                          <p className="text-sm text-danger">Unavailable</p>
                        ) : totalPositions > 0 ? (
                          (() => {
                            // Same clamp as the clusters list: coordinators
                            // have direct RLS write access to cycles with no
                            // cycle_number CHECK constraint, so a row outside
                            // what this cluster's slots support is reachable
                            // via a direct write, not just this app's UI.
                            const rawActivePosition = activeCycle?.cycle_number ?? null
                            const boundedActivePosition =
                              rawActivePosition !== null && rawActivePosition >= 1 && rawActivePosition <= totalPositions
                                ? rawActivePosition
                                : null
                            const boundedCompletedCount = Math.min(completedCount, totalPositions)
                            return (
                              <RotationRing
                                totalPositions={totalPositions}
                                activePosition={boundedActivePosition}
                                completedCount={boundedCompletedCount}
                                size={64}
                                ariaLabel={`${selectedCluster.name}: ${
                                  boundedActivePosition
                                    ? `position ${boundedActivePosition} of ${totalPositions} active`
                                    : `${boundedCompletedCount} of ${totalPositions} positions complete`
                                }`}
                              />
                            )
                          })()
                        ) : (
                          <p className="font-medium">—</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <h2 className="text-sm font-medium text-muted">
                    Payment status (active cycle)
                  </h2>
                  {cyclesError ? (
                    <p className="mt-2 text-sm text-danger">
                      Could not load payment status: {cyclesError.message}
                    </p>
                  ) : !activeCycle ? (
                    <p className="mt-2 text-sm text-muted">
                      No active cycle — nothing to collect right now.
                    </p>
                  ) : paymentsError ? (
                    <p className="mt-2 text-sm text-danger">
                      Could not load payment status: {paymentsError.message}
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-6 text-sm shadow-sm sm:grid-cols-4">
                      <div>
                        <p className="text-muted">Paid</p>
                        <p className="text-lg font-semibold text-primary">{paidCount}</p>
                      </div>
                      <div>
                        <p className="text-muted">Pending</p>
                        <p className="text-lg font-semibold">{pendingCount}</p>
                      </div>
                      <div>
                        <p className="text-muted">Late</p>
                        <p className="text-lg font-semibold text-danger">{lateCount}</p>
                      </div>
                      {waivedCount > 0 && (
                        <div>
                          <p className="text-muted">Waived</p>
                          <p className="text-lg font-semibold">{waivedCount}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <h2 className="text-sm font-medium text-muted">
                    Upcoming payout
                  </h2>
                  {cyclesError ? (
                    <p className="mt-2 text-sm text-danger">
                      Could not load the upcoming payout: {cyclesError.message}
                    </p>
                  ) : !activeCycle ? (
                    <p className="mt-2 text-sm text-muted">
                      No active cycle — no upcoming payout.
                    </p>
                  ) : feeError || slotMembersError ? (
                    <p className="mt-2 text-sm text-danger">
                      Could not load the upcoming payout: {(feeError ?? slotMembersError)?.message}
                    </p>
                  ) : (
                    <>
                      <div className="mt-2 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-6 text-sm shadow-sm sm:grid-cols-4">
                        <div>
                          <p className="text-muted">Next collector</p>
                          <p className="font-medium">
                            {collectorNames.length > 0 ? collectorNames.join(', ') : 'Unassigned'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted">Total pot</p>
                          <p className="text-lg font-semibold">{totalPot.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted">Coordinator fee</p>
                          <p className="text-lg font-semibold">{(feeAmountData ?? 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted">Net payout</p>
                          <p className="text-lg font-semibold">{(netPayout ?? 0).toFixed(2)}</p>
                        </div>
                      </div>
                      {feeExceedsPot && (
                        <p className="mt-2 text-sm text-danger">
                          Coordinator fee ({(feeAmountData ?? 0).toFixed(2)}) exceeds the total pot (
                          {totalPot.toFixed(2)}) — this cycle cannot be completed until the fee or
                          contribution amount changes.
                        </p>
                      )}
                      {slotMembers.length !== 1 && (
                        <p className="mt-2 text-sm text-muted">
                          This position currently has {slotMembers.length} collector
                          {slotMembers.length === 1 ? '' : 's'} — a payout won&apos;t be automatically
                          recorded when this cycle completes (shared-slot payouts aren&apos;t supported
                          yet).
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-6">
                  <h2 className="text-sm font-medium text-muted">
                    Lifetime totals
                  </h2>
                  {cyclesError ? (
                    <p className="mt-2 text-sm text-danger">
                      Could not load lifetime totals: {cyclesError.message}
                    </p>
                  ) : payoutsError ? (
                    <p className="mt-2 text-sm text-danger">
                      Could not load lifetime totals: {payoutsError.message}
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-6 text-sm shadow-sm">
                      <div>
                        <p className="text-muted">Total coordinator earnings</p>
                        <p className="text-lg font-semibold">
                          {payoutsTotalFees === null ? 'Unavailable' : payoutsTotalFees.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">Total fees collected</p>
                        <p className="text-lg font-semibold">
                          {payoutsTotalFees === null ? 'Unavailable' : payoutsTotalFees.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
