'use client'

import { useActionState } from 'react'
import { buttonPrimary, buttonSecondary } from '../../../../../components/button-styles'
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
          className="rounded border border-border px-2 py-1 text-sm"
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
          className="rounded border border-border px-2 py-1 text-sm"
        />
        <button type="submit" disabled={markPaidPending} className={`${buttonPrimary} px-3 py-1 text-sm`}>
          {markPaidPending ? 'Saving…' : 'Mark paid'}
        </button>
      </form>
      {markPaidState.error && (
        <p className="text-sm text-danger">{markPaidState.error}</p>
      )}

      <form action={waiveFormAction} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="notes"
          placeholder="Reason (optional)"
          className="rounded border border-border px-2 py-1 text-sm"
        />
        <button type="submit" disabled={waivePending} className={`${buttonSecondary} px-3 py-1 text-sm`}>
          {waivePending ? 'Saving…' : 'Waive'}
        </button>
      </form>
      {waiveState.error && <p className="text-sm text-danger">{waiveState.error}</p>}
    </div>
  )
}

export function SettledPaymentActions({ revertAction }: { revertAction: PaymentAction }) {
  const [state, formAction, pending] = useActionState(revertAction, initialState)

  return (
    <div>
      <form action={formAction}>
        <button type="submit" disabled={pending} className={`${buttonSecondary} px-3 py-1 text-sm`}>
          {pending ? 'Saving…' : 'Revert to pending'}
        </button>
      </form>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  )
}
