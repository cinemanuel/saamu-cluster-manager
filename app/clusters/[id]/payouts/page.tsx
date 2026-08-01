import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { SiteNav } from '../../../site-nav'
import { buttonTertiary } from '../../../components/button-styles'

export default async function ClusterPayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: cluster } = await supabase
    .from('clusters')
    .select('id, name, contribution_amount, fee_type, fee_value, frequency')
    .eq('id', id)
    .single()

  if (!cluster) {
    notFound()
  }

  const { data: cycles } = await supabase
    .from('cycles')
    .select('id, cycle_number, slot_id, status')
    .eq('cluster_id', id)

  const { data: members } = await supabase.from('members').select('id, full_name').eq('cluster_id', id)

  const cycleIds = (cycles ?? []).map((cycle) => cycle.id)
  const { data: payouts, error: payoutsError } =
    cycleIds.length > 0
      ? await supabase
          .from('payouts')
          .select('id, cycle_id, total_pot, fee_amount, net_payout, payout_date')
          .in('cycle_id', cycleIds)
          .order('payout_date', { ascending: false })
      : { data: [], error: null }

  const payoutIds = (payouts ?? []).map((payout) => payout.id)
  const { data: transactions, error: transactionsError } =
    payoutIds.length > 0
      ? await supabase
          .from('payout_transactions')
          .select('payout_id, type, member_id, amount')
          .in('payout_id', payoutIds)
      : { data: [], error: null }

  const cycleById = new Map((cycles ?? []).map((cycle) => [cycle.id, cycle]))
  const fullNameByMemberId = new Map((members ?? []).map((member) => [member.id, member.full_name]))

  const recipientByPayoutId = new Map<string, string>()
  for (const transaction of transactions ?? []) {
    if (transaction.type === 'member_payout' && transaction.member_id) {
      recipientByPayoutId.set(
        transaction.payout_id,
        fullNameByMemberId.get(transaction.member_id) ?? 'Unknown member'
      )
    }
  }

  const totalFeesCollected = payoutsError
    ? null
    : (payouts ?? []).reduce((sum, payout) => sum + Number(payout.fee_amount), 0)

  // "Upcoming payout" — the active cycle's projected figures, using the
  // exact same fee formula that will be used when it actually completes,
  // so this never disagrees with what eventually gets recorded.
  const activeCycle = (cycles ?? []).find((cycle) => cycle.status === 'active') ?? null
  let upcoming: { totalPot: number; feeAmount: number; netPayout: number; collectorCount: number } | null =
    null
  let upcomingError: string | null = null

  if (activeCycle) {
    const memberCount = (members ?? []).length
    const totalPot = memberCount * Number(cluster.contribution_amount)

    const { data: feeAmountData, error: feeError } = await supabase.rpc('calculate_coordinator_fee', {
      p_fee_type: cluster.fee_type,
      p_fee_value: cluster.fee_value,
      p_total_pot: totalPot,
    })

    const { data: slotMembers, error: slotMembersError } = await supabase
      .from('slot_members')
      .select('member_id')
      .eq('slot_id', activeCycle.slot_id)

    if (feeError || slotMembersError) {
      upcomingError = (feeError ?? slotMembersError)?.message ?? 'Could not load the upcoming payout.'
    } else {
      const feeAmount = Number(feeAmountData ?? 0)
      upcoming = {
        totalPot,
        feeAmount,
        netPayout: totalPot - feeAmount,
        collectorCount: (slotMembers ?? []).length,
      }
    }
  }

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href={`/clusters/${id}/cycles`} className={`${buttonTertiary} text-sm`}>
          ← Back to {cluster.name} cycles
        </Link>

        <h1 className="mt-4 text-xl font-semibold">{cluster.name} — Coordinator payouts</h1>

        {activeCycle && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-muted">Upcoming payout</h2>
            {upcomingError ? (
              <p className="mt-2 text-sm text-danger">
                Could not load the upcoming payout: {upcomingError}
              </p>
            ) : upcoming ? (
              <>
                <div className="mt-2 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-6 text-sm shadow-sm sm:grid-cols-4">
                  <div>
                    <p className="text-muted">Total pot</p>
                    <p className="text-lg font-semibold">{upcoming.totalPot.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Coordinator fee</p>
                    <p className="text-lg font-semibold">{upcoming.feeAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Net payout</p>
                    <p className="text-lg font-semibold">{upcoming.netPayout.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Contribution frequency</p>
                    <p className="font-medium capitalize">{cluster.frequency}</p>
                  </div>
                </div>
                {upcoming.collectorCount !== 1 && (
                  <p className="mt-2 text-sm text-muted">
                    This position currently has {upcoming.collectorCount} collector
                    {upcoming.collectorCount === 1 ? '' : 's'} — a payout won&apos;t be automatically
                    recorded when this cycle completes (shared-slot payouts aren&apos;t supported yet).
                  </p>
                )}
              </>
            ) : null}
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-sm font-medium text-muted">Lifetime totals</h2>
          {payoutsError && (
            <p className="mt-2 text-sm text-danger">
              Could not load lifetime totals: {payoutsError.message}
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-6 text-sm shadow-sm">
            <div>
              <p className="text-muted">Total coordinator earnings</p>
              <p className="text-lg font-semibold">
                {totalFeesCollected === null ? 'Unavailable' : totalFeesCollected.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-muted">Total fees collected</p>
              <p className="text-lg font-semibold">
                {totalFeesCollected === null ? 'Unavailable' : totalFeesCollected.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-medium text-muted">Payout history</h2>
          {transactionsError && (
            <p className="mt-2 text-sm text-danger">
              Recipient names could not be loaded: {transactionsError.message}
            </p>
          )}
          {payoutsError ? (
            <p className="mt-2 text-sm text-danger">
              Could not load payout history: {payoutsError.message}
            </p>
          ) : payouts && payouts.length > 0 ? (
            <div className="relative mt-2">
            <div className="overflow-x-auto rounded-xl border border-border bg-surface p-2 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium text-muted">Cycle</th>
                  <th className="py-2 pr-4 font-medium text-muted">Payout date</th>
                  <th className="py-2 pr-4 font-medium text-muted">Total pot</th>
                  <th className="py-2 pr-4 font-medium text-muted">Coordinator fee</th>
                  <th className="py-2 pr-4 font-medium text-muted">Net payout</th>
                  <th className="py-2 font-medium text-muted">Recipient</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-bg">
                    <td className="py-3 pr-4 align-middle">{cycleById.get(payout.cycle_id)?.cycle_number ?? '—'}</td>
                    <td className="py-3 pr-4 align-middle">{payout.payout_date}</td>
                    <td className="py-3 pr-4 align-middle">{Number(payout.total_pot).toFixed(2)}</td>
                    <td className="py-3 pr-4 align-middle">{Number(payout.fee_amount).toFixed(2)}</td>
                    <td className="py-3 pr-4 align-middle">{Number(payout.net_payout).toFixed(2)}</td>
                    <td className="py-3 align-middle">{recipientByPayoutId.get(payout.id) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-xl bg-gradient-to-l from-surface to-transparent sm:hidden"
            />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">No payouts recorded yet.</p>
          )}
        </div>
      </div>
    </>
  )
}
