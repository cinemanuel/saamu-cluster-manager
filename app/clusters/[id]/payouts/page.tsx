import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { SiteNav } from '../../../site-nav'

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
  const { data: payouts } =
    cycleIds.length > 0
      ? await supabase
          .from('payouts')
          .select('id, cycle_id, total_pot, fee_amount, net_payout, payout_date')
          .in('cycle_id', cycleIds)
          .order('payout_date', { ascending: false })
      : { data: [] }

  const payoutIds = (payouts ?? []).map((payout) => payout.id)
  const { data: transactions } =
    payoutIds.length > 0
      ? await supabase
          .from('payout_transactions')
          .select('payout_id, type, member_id, amount')
          .in('payout_id', payoutIds)
      : { data: [] }

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

  const totalFeesCollected = (payouts ?? []).reduce((sum, payout) => sum + Number(payout.fee_amount), 0)

  // "Upcoming payout" — the active cycle's projected figures, using the
  // exact same fee formula that will be used when it actually completes,
  // so this never disagrees with what eventually gets recorded.
  const activeCycle = (cycles ?? []).find((cycle) => cycle.status === 'active') ?? null
  let upcoming: { totalPot: number; feeAmount: number; netPayout: number; collectorCount: number } | null =
    null

  if (activeCycle) {
    const memberCount = (members ?? []).length
    const totalPot = memberCount * Number(cluster.contribution_amount)

    const { data: feeAmountData } = await supabase.rpc('calculate_coordinator_fee', {
      p_fee_type: cluster.fee_type,
      p_fee_value: cluster.fee_value,
      p_total_pot: totalPot,
    })
    const feeAmount = Number(feeAmountData ?? 0)

    const { data: slotMembers } = await supabase
      .from('slot_members')
      .select('member_id')
      .eq('slot_id', activeCycle.slot_id)

    upcoming = {
      totalPot,
      feeAmount,
      netPayout: totalPot - feeAmount,
      collectorCount: (slotMembers ?? []).length,
    }
  }

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href={`/clusters/${id}/cycles`} className="text-sm underline">
          ← Back to {cluster.name} cycles
        </Link>

        <h1 className="mt-4 text-xl font-semibold">{cluster.name} — Coordinator payouts</h1>

        {upcoming && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Upcoming payout</h2>
            <div className="mt-2 grid grid-cols-2 gap-4 rounded border border-black/15 p-4 text-sm dark:border-white/20 sm:grid-cols-4">
              <div>
                <p className="text-zinc-600 dark:text-zinc-400">Total pot</p>
                <p className="font-medium">{upcoming.totalPot.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-zinc-600 dark:text-zinc-400">Coordinator fee</p>
                <p className="font-medium">{upcoming.feeAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-zinc-600 dark:text-zinc-400">Net payout</p>
                <p className="font-medium">{upcoming.netPayout.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-zinc-600 dark:text-zinc-400">Contribution frequency</p>
                <p className="font-medium capitalize">{cluster.frequency}</p>
              </div>
            </div>
            {upcoming.collectorCount !== 1 && (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                This position currently has {upcoming.collectorCount} collector
                {upcoming.collectorCount === 1 ? '' : 's'} — a payout won&apos;t be automatically
                recorded when this cycle completes (shared-slot payouts aren&apos;t supported yet).
              </p>
            )}
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Lifetime totals</h2>
          <div className="mt-2 grid grid-cols-2 gap-4 rounded border border-black/15 p-4 text-sm dark:border-white/20">
            <div>
              <p className="text-zinc-600 dark:text-zinc-400">Total coordinator earnings</p>
              <p className="font-medium">{totalFeesCollected.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-zinc-600 dark:text-zinc-400">Total fees collected</p>
              <p className="font-medium">{totalFeesCollected.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Payout history</h2>
          {payouts && payouts.length > 0 ? (
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/15">
                  <th className="py-2 font-medium">Cycle</th>
                  <th className="py-2 font-medium">Payout date</th>
                  <th className="py-2 font-medium">Total pot</th>
                  <th className="py-2 font-medium">Coordinator fee</th>
                  <th className="py-2 font-medium">Net payout</th>
                  <th className="py-2 font-medium">Recipient</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-black/5 dark:border-white/10">
                    <td className="py-2">{cycleById.get(payout.cycle_id)?.cycle_number ?? '—'}</td>
                    <td className="py-2">{payout.payout_date}</td>
                    <td className="py-2">{Number(payout.total_pot).toFixed(2)}</td>
                    <td className="py-2">{Number(payout.fee_amount).toFixed(2)}</td>
                    <td className="py-2">{Number(payout.net_payout).toFixed(2)}</td>
                    <td className="py-2">{recipientByPayoutId.get(payout.id) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No payouts recorded yet.</p>
          )}
        </div>
      </div>
    </>
  )
}
