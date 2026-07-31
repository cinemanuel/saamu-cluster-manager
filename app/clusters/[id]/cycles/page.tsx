import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { SiteNav } from '../../../site-nav'
import { StatusBadge, type StatusTone } from '../../../components/status-badge'
import { StartCycleForm } from './start-cycle-form'
import { AdvanceCycleForm } from './advance-cycle-form'
import { startFirstCycle, advanceCycle } from './actions'

const cycleStatusTone: Record<string, StatusTone> = {
  pending: 'neutral',
  active: 'active',
  completed: 'positive',
}

export default async function CyclesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ warning?: string }>
}) {
  const { id } = await params
  const { warning } = await searchParams
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: cluster } = await supabase
    .from('clusters')
    .select('id, name, status')
    .eq('id', id)
    .single()

  if (!cluster) {
    notFound()
  }

  const { data: cycles } = await supabase
    .from('cycles')
    .select('id, cycle_number, slot_id, status, start_date, end_date')
    .eq('cluster_id', id)
    .order('cycle_number', { ascending: true })

  const { data: slots } = await supabase
    .from('slots')
    .select('id, position, label, is_shared')
    .eq('cluster_id', id)

  const { data: members } = await supabase.from('members').select('id, full_name').eq('cluster_id', id)

  const slotIds = (slots ?? []).map((slot) => slot.id)
  const { data: slotMembers } =
    slotIds.length > 0
      ? await supabase.from('slot_members').select('slot_id, member_id').in('slot_id', slotIds)
      : { data: [] }

  const cycleIds = (cycles ?? []).map((cycle) => cycle.id)
  const { data: payments } =
    cycleIds.length > 0
      ? await supabase.from('payments').select('cycle_id, status').in('cycle_id', cycleIds)
      : { data: [] }

  const outstandingByCycleId = new Map<string, number>()
  for (const payment of payments ?? []) {
    if (payment.status === 'pending') {
      outstandingByCycleId.set(payment.cycle_id, (outstandingByCycleId.get(payment.cycle_id) ?? 0) + 1)
    }
  }

  const slotById = new Map((slots ?? []).map((slot) => [slot.id, slot]))
  const fullNameByMemberId = new Map((members ?? []).map((member) => [member.id, member.full_name]))

  const collectorNamesBySlotId = new Map<string, string[]>()
  for (const sm of slotMembers ?? []) {
    const fullName = fullNameByMemberId.get(sm.member_id)
    if (fullName) {
      const existing = collectorNamesBySlotId.get(sm.slot_id) ?? []
      existing.push(fullName)
      collectorNamesBySlotId.set(sm.slot_id, existing)
    }
  }

  const activeCycle = (cycles ?? []).find((cycle) => cycle.status === 'active') ?? null
  const rotationComplete = cluster.status === 'completed'

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href={`/clusters/${id}/slots`} className="text-sm underline">
          ← Back to {cluster.name} rotation positions
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{cluster.name} — Cycles</h1>
          <Link href={`/clusters/${id}/payouts`} className="text-sm underline">
            Coordinator payouts
          </Link>
        </div>

        {warning && (
          <p className="mt-4 rounded bg-border px-4 py-3 text-sm text-ink">{warning}</p>
        )}

        {rotationComplete ? (
          <p className="mt-6 rounded bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            Rotation complete — all positions have collected.
          </p>
        ) : activeCycle ? (
          <div className="mt-6 rounded border border-border p-4">
            {(() => {
              const slot = slotById.get(activeCycle.slot_id)
              const collectors = collectorNamesBySlotId.get(activeCycle.slot_id) ?? []
              return (
                <>
                  <p className="text-sm">
                    <span className="font-medium">Cycle {activeCycle.cycle_number}</span> — Position{' '}
                    {slot?.position ?? '—'}
                    {slot?.label ? ` (${slot.label})` : ''}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Collector{collectors.length > 1 ? 's' : ''}:{' '}
                    {collectors.length > 0 ? collectors.join(', ') : 'Unassigned'}
                  </p>
                </>
              )
            })()}
            {(outstandingByCycleId.get(activeCycle.id) ?? 0) > 0 && (
              <p className="mt-3 text-sm text-danger">
                {`${outstandingByCycleId.get(activeCycle.id)} member${
                  outstandingByCycleId.get(activeCycle.id) === 1 ? '' : 's'
                } still owe for this cycle.`}
              </p>
            )}
            <AdvanceCycleForm action={advanceCycle.bind(null, id, activeCycle.id)} />
          </div>
        ) : (
          <StartCycleForm action={startFirstCycle.bind(null, id)} />
        )}

        {cycles && cycles.length > 0 ? (
          <table className="mt-8 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Cycle</th>
                <th className="py-2 font-medium">Position</th>
                <th className="py-2 font-medium">Collector(s)</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Start</th>
                <th className="py-2 font-medium">End</th>
                <th className="py-2 font-medium">Payments</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => {
                const slot = slotById.get(cycle.slot_id)
                const collectors = collectorNamesBySlotId.get(cycle.slot_id) ?? []
                return (
                  <tr key={cycle.id} className="border-b border-border">
                    <td className="py-2">{cycle.cycle_number}</td>
                    <td className="py-2">
                      {slot?.position ?? '—'}
                      {slot?.label ? ` (${slot.label})` : ''}
                    </td>
                    <td className="py-2">{collectors.length > 0 ? collectors.join(', ') : '—'}</td>
                    <td className="py-2">
                      <StatusBadge tone={cycleStatusTone[cycle.status] ?? 'neutral'}>
                        {cycle.status}
                      </StatusBadge>
                    </td>
                    <td className="py-2">{cycle.start_date}</td>
                    <td className="py-2">{cycle.end_date ?? '—'}</td>
                    <td className="py-2">
                      <Link href={`/clusters/${id}/cycles/${cycle.id}/payments`} className="underline">
                        View payments
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="mt-8 text-sm text-muted">No cycles yet.</p>
        )}
      </div>
    </>
  )
}
