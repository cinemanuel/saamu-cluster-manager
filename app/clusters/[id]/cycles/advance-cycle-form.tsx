'use client'

import { useActionState } from 'react'
import { buttonPrimary } from '../../../components/button-styles'
import type { CycleFormState } from './actions'

const initialState: CycleFormState = { error: null }

export function AdvanceCycleForm({
  action,
}: {
  action: (prevState: CycleFormState, formData: FormData) => Promise<CycleFormState>
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="start_date" className="text-sm font-medium">
          Next cycle&apos;s start date
        </label>
        <input
          id="start_date"
          name="start_date"
          type="date"
          className="rounded border border-border px-3 py-2"
        />
      </div>

      <button type="submit" disabled={pending} className={`${buttonPrimary} px-4 py-2 text-sm`}>
        {pending ? 'Advancing…' : 'Complete cycle & advance'}
      </button>

      {state.error && (
        <p className="w-full text-sm text-danger">{state.error}</p>
      )}
    </form>
  )
}
