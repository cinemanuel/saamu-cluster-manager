'use client'

import { useActionState } from 'react'
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
          className="rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {pending ? 'Advancing…' : 'Complete cycle & advance'}
      </button>

      {state.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  )
}
