import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { SiteNav } from '../../../../../site-nav'
import { buttonTertiary } from '../../../../../components/button-styles'
import { StatusBadge } from '../../../../../components/status-badge'
import { PendingPaymentActions, SettledPaymentActions } from './payment-actions'
import { markPaid, waivePayment, revertToPending } from './actions'

export default async function CyclePaymentsPage({
  params,
}: {
  params: Promise<{ id: string; cycleId: string }>
}) {
  const { id, cycleId } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: cluster } = await supabase
    .from('clusters')
    .select('id, name, contribution_amount, fee_type, fee_value')
    .eq('id', id)
    .single()

  if (!cluster) {
    notFound()
  }

  const { data: cycle } = await supabase
    .from('cycles')
    .select('id, cycle_number, cluster_id, start_date, end_date, status')
    .eq('id', cycleId)
    .eq('cluster_id', id)
    .single()

  if (!cycle) {
    notFound()
  }

  const { data: members } = await supabase
    .from('members')
    .select('id, full_name')
    .eq('cluster_id', id)
    .order('full_name', { ascending: true })

  const { data: payments } = await supabase
    .from('payments')
    .select('id, member_id, amount, status, due_date, paid_at, payment_method, notes')
    .eq('cycle_id', cycleId)

  const fullNameByMemberId = new Map((members ?? []).map((member) => [member.id, member.full_name]))
  const paymentsByMemberId = new Map((payments ?? []).map((payment) => [payment.member_id, payment]))

  const today = new Date().toISOString().slice(0, 10)

  const memberCount = (members ?? []).length
  const pool = memberCount * Number(cluster.contribution_amount)
  const collected = (payments ?? [])
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + Number(payment.amount), 0)
  const outstandingCount = (payments ?? []).filter((payment) => payment.status === 'pending').length

  const { data: feeAmountData, error: feeError } = await supabase.rpc('calculate_coordinator_fee', {
    p_fee_type: cluster.fee_type,
    p_fee_value: cluster.fee_value,
    p_total_pot: pool,
  })
  const feeAmount = feeError ? null : Number(feeAmountData ?? 0)
  const netPayout = feeAmount === null ? null : pool - feeAmount

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href={`/clusters/${id}/cycles`} className={`${buttonTertiary} text-sm`}>
          ← Back to {cluster.name} cycles
        </Link>

        <h1 className="mt-4 text-xl font-semibold">
          {cluster.name} — Cycle {cycle.cycle_number} payments
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-border bg-surface p-6 text-sm shadow-sm sm:grid-cols-5">
          <div>
            <p className="text-muted">Pool</p>
            <p className="text-lg font-semibold">{pool.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted">Collected</p>
            <p className="text-lg font-semibold">{collected.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted">Outstanding</p>
            <p className="text-lg font-semibold">{outstandingCount} member{outstandingCount === 1 ? '' : 's'}</p>
          </div>
          <div>
            <p className="text-muted">Coordinator fee</p>
            <p className="text-lg font-semibold">{feeAmount === null ? 'Unavailable' : feeAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted">Net payout after fee</p>
            <p className="text-lg font-semibold">{netPayout === null ? 'Unavailable' : netPayout.toFixed(2)}</p>
          </div>
        </div>

        {feeError && (
          <p className="mt-2 text-sm text-danger">
            Could not calculate the coordinator fee: {feeError.message}
          </p>
        )}

        {members && members.length > 0 ? (
          <div className="relative mt-6">
          <div className="overflow-x-auto rounded-xl border border-border bg-surface p-2 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium text-muted">Member</th>
                <th className="py-2 pr-4 font-medium text-muted">Amount</th>
                <th className="py-2 pr-4 font-medium text-muted">Due</th>
                <th className="py-2 pr-4 font-medium text-muted">Status</th>
                <th className="py-2 pr-4 font-medium text-muted">Paid</th>
                <th className="py-2 font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const payment = paymentsByMemberId.get(member.id)
                if (!payment) {
                  return (
                    <tr key={member.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-bg">
                      <td className="py-3 pr-4 align-top">{member.full_name}</td>
                      <td colSpan={5} className="py-3 align-top text-muted">
                        No payment record for this cycle.
                      </td>
                    </tr>
                  )
                }

                const isLate = payment.status === 'pending' && payment.due_date < today

                return (
                  <tr key={member.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-bg">
                    <td className="py-3 pr-4 align-top">{fullNameByMemberId.get(member.id)}</td>
                    <td className="py-3 pr-4 align-top">{Number(payment.amount).toFixed(2)}</td>
                    <td className="py-3 pr-4 align-top">{payment.due_date}</td>
                    <td className="py-3 pr-4 align-top">
                      {isLate ? (
                        <StatusBadge tone="danger">Late</StatusBadge>
                      ) : payment.status === 'paid' ? (
                        <StatusBadge tone="positive">Paid</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">{payment.status}</StatusBadge>
                      )}
                    </td>
                    <td className="py-3 pr-4 align-top">
                      {payment.status === 'paid'
                        ? `${payment.paid_at ? payment.paid_at.slice(0, 10) : '—'} (${payment.payment_method ?? '—'})`
                        : '—'}
                    </td>
                    <td className="py-3 align-top">
                      {payment.status === 'pending' ? (
                        <PendingPaymentActions
                          markPaidAction={markPaid.bind(null, id, cycleId, payment.id)}
                          waiveAction={waivePayment.bind(null, id, cycleId, payment.id)}
                        />
                      ) : (
                        <SettledPaymentActions
                          revertAction={revertToPending.bind(null, id, cycleId, payment.id)}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-xl bg-gradient-to-l from-surface to-transparent sm:hidden"
          />
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">No members in this cluster yet.</p>
        )}
      </div>
    </>
  )
}
