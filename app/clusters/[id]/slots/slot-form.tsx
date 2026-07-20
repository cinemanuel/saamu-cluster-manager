'use client'

import { useActionState } from 'react'
import type { SlotFormState } from './actions'

const initialState: SlotFormState = { error: null }

export function SlotForm({
  action,
}: {
  action: (prevState: SlotFormState, formData: FormData) => Promise<SlotFormState>
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="mt-6 flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="position" className="text-sm font-medium">
          Position
        </label>
        <input
          id="position"
          name="position"
          type="number"
          min="1"
          step="1"
          required
          className="w-24 rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="label" className="text-sm font-medium">
          Label (optional)
        </label>
        <input
          id="label"
          name="label"
          className="rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add position'}
      </button>

      {state.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  )
}
