import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { SiteNav } from '../../../../../site-nav'
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
    .select('id, name, contribution_amount, fee_amount')
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
  const netPayout = pool - Number(cluster.fee_amount)

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href={`/clusters/${id}/cycles`} className="text-sm underline">
          ← Back to {cluster.name} cycles
        </Link>

        <h1 className="mt-4 text-xl font-semibold">
          {cluster.name} — Cycle {cycle.cycle_number} payments
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-4 rounded border border-black/15 p-4 text-sm dark:border-white/20 sm:grid-cols-4">
          <div>
            <p className="text-zinc-600 dark:text-zinc-400">Pool</p>
            <p className="font-medium">{pool.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-zinc-600 dark:text-zinc-400">Collected</p>
            <p className="font-medium">{collected.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-zinc-600 dark:text-zinc-400">Outstanding</p>
            <p className="font-medium">{outstandingCount} member{outstandingCount === 1 ? '' : 's'}</p>
          </div>
          <div>
            <p className="text-zinc-600 dark:text-zinc-400">Net payout after fee</p>
            <p className="font-medium">{netPayout.toFixed(2)}</p>
          </div>
        </div>

        {members && members.length > 0 ? (
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/15">
                <th className="py-2 font-medium">Member</th>
                <th className="py-2 font-medium">Amount</th>
                <th className="py-2 font-medium">Due</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Paid</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const payment = paymentsByMemberId.get(member.id)
                if (!payment) {
                  return (
                    <tr key={member.id} className="border-b border-black/5 dark:border-white/10">
                      <td className="py-2 align-top">{member.full_name}</td>
                      <td colSpan={5} className="py-2 align-top text-zinc-600 dark:text-zinc-400">
                        No payment record for this cycle.
                      </td>
                    </tr>
                  )
                }

                const isLate = payment.status === 'pending' && payment.due_date < today

                return (
                  <tr key={member.id} className="border-b border-black/5 dark:border-white/10">
                    <td className="py-2 align-top">{fullNameByMemberId.get(member.id)}</td>
                    <td className="py-2 align-top">{Number(payment.amount).toFixed(2)}</td>
                    <td className="py-2 align-top">{payment.due_date}</td>
                    <td className="py-2 align-top">
                      {isLate ? (
                        <span className="text-red-600 dark:text-red-400">Late</span>
                      ) : (
                        <span className="capitalize">{payment.status}</span>
                      )}
                    </td>
                    <td className="py-2 align-top">
                      {payment.status === 'paid'
                        ? `${payment.paid_at ? payment.paid_at.slice(0, 10) : '—'} (${payment.payment_method ?? '—'})`
                        : '—'}
                    </td>
                    <td className="py-2 align-top">
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
        ) : (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No members in this cluster yet.</p>
        )}
      </div>
    </>
  )
}
