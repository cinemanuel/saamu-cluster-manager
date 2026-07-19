'use client'

import { useActionState } from 'react'
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
    fee_amount: number
    frequency: string
  }
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium">
          Cluster name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name}
          className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
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
          className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="fee_amount" className="text-sm font-medium">
          Fee amount
        </label>
        <input
          id="fee_amount"
          name="fee_amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={defaultValues?.fee_amount}
          className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="frequency" className="text-sm font-medium">
          Frequency
        </label>
        <select
          id="frequency"
          name="frequency"
          required
          defaultValue={defaultValues?.frequency ?? 'monthly'}
          className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
