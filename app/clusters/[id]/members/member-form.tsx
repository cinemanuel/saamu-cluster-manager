'use client'

import { useActionState } from 'react'
import type { MemberFormState } from './actions'

const initialState: MemberFormState = { error: null }

export function MemberForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: MemberFormState, formData: FormData) => Promise<MemberFormState>
  defaultValues?: {
    full_name: string
    phone: string | null
    email: string | null
  }
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div className="space-y-1">
        <label htmlFor="full_name" className="text-sm font-medium">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          defaultValue={defaultValues?.full_name}
          className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="phone" className="text-sm font-medium">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaultValues?.phone ?? ''}
          className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ''}
          className="w-full rounded border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
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
