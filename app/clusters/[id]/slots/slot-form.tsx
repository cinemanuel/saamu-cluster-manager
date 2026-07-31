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
          className="w-24 rounded border border-border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="label" className="text-sm font-medium">
          Label (optional)
        </label>
        <input
          id="label"
          name="label"
          className="rounded border border-border px-3 py-2"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input id="is_shared" name="is_shared" type="checkbox" />
        Shared position (multiple collectors)
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add position'}
      </button>

      {state.error && (
        <p className="w-full text-sm text-danger">{state.error}</p>
      )}
    </form>
  )
}
