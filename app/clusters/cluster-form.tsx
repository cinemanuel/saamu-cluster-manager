'use client'

import { useActionState, useState } from 'react'
import { buttonPrimary } from '../components/button-styles'
import type { ClusterFormState } from './actions'

const initialState: ClusterFormState = { error: null }

export function ClusterForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ClusterFormState, formData: FormData) => Promise<ClusterFormState>
  defaultValues?: {
    name: string
    contribution_amount: number
    fee_type: string
    fee_value: number | null
    frequency: string
  }
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [feeType, setFeeType] = useState(defaultValues?.fee_type ?? 'fixed')

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Cluster name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name}
          className="w-full rounded border border-border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="contribution_amount" className="text-sm font-medium">
          Contribution amount
        </label>
        <input
          id="contribution_amount"
          name="contribution_amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={defaultValues?.contribution_amount}
          className="w-full rounded border border-border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="fee_type" className="text-sm font-medium">
          Coordinator fee type
        </label>
        <select
          id="fee_type"
          name="fee_type"
          required
          value={feeType}
          onChange={(e) => setFeeType(e.target.value)}
          className="w-full rounded border border-border px-3 py-2"
        >
          <option value="fixed">Fixed amount</option>
          <option value="percentage">Percentage</option>
          <option value="none">No fee</option>
        </select>
      </div>

      {feeType !== 'none' && (
        <div className="space-y-1">
          <label htmlFor="fee_value" className="text-sm font-medium">
            {feeType === 'percentage' ? 'Fee percentage' : 'Fee amount'}
          </label>
          <input
            id="fee_value"
            name="fee_value"
            type="number"
            step="0.01"
            min="0.01"
            max={feeType === 'percentage' ? 100 : undefined}
            required
            defaultValue={defaultValues?.fee_value ?? undefined}
            className="w-full rounded border border-border px-3 py-2"
          />
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="frequency" className="text-sm font-medium">
          Frequency
        </label>
        <select
          id="frequency"
          name="frequency"
          required
          defaultValue={defaultValues?.frequency ?? 'monthly'}
          className="w-full rounded border border-border px-3 py-2"
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <button type="submit" disabled={pending} className={`${buttonPrimary} w-full px-4 py-2`}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
