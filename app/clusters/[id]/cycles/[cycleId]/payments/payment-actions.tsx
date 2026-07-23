'use client'

import { useActionState } from 'react'
import type { PaymentFormState } from './actions'

const initialState: PaymentFormState = { error: null }

type PaymentAction = (prevState: PaymentFormState, formData: FormData) => Promise<PaymentFormState>

export function PendingPaymentActions({
  markPaidAction,
  waiveAction,
}: {
  markPaidAction: PaymentAction
  waiveAction: PaymentAction
}) {
  const [markPaidState, markPaidFormAction, markPaidPending] = useActionState(markPaidAction, initialState)
  const [waiveState, waiveFormAction, waivePending] = useActionState(waiveAction, initialState)

  return (
    <div className="flex flex-col gap-2">
      <form action={markPaidFormAction} className="flex flex-wrap items-center gap-2">
        <select
          name="payment_method"
          defaultValue=""
          required
          className="rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent"
        >
          <option value="" disabled>
            Method
          </option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="mobile_money">Mobile money</option>
        </select>
        <input
          type="text"
          name="notes"
          placeholder="Notes (optional)"
          className="rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={markPaidPending}
          className="rounded bg-foreground px-2 py-1 text-sm text-background disabled:opacity-50"
        >
          {markPaidPending ? 'Saving…' : 'Mark paid'}
        </button>
      </form>
      {markPaidState.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{markPaidState.error}</p>
      )}

      <form action={waiveFormAction} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="notes"
          placeholder="Reason (optional)"
          className="rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={waivePending}
          className="rounded border border-black/15 px-2 py-1 text-sm disabled:opacity-50 dark:border-white/20"
        >
          {waivePending ? 'Saving…' : 'Waive'}
        </button>
      </form>
      {waiveState.error && <p className="text-sm text-red-600 dark:text-red-400">{waiveState.error}</p>}
    </div>
  )
}

export function SettledPaymentActions({ revertAction }: { revertAction: PaymentAction }) {
  const [state, formAction, pending] = useActionState(revertAction, initialState)

  return (
    <div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-black/15 px-2 py-1 text-sm disabled:opacity-50 dark:border-white/20"
        >
          {pending ? 'Saving…' : 'Revert to pending'}
        </button>
      </form>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </div>
  )
}
