'use client'

import { useActionState } from 'react'
import type { SlotFormState } from './actions'

const initialState: SlotFormState = { error: null }

export function AssignMemberForm({
  action,
  members,
  currentMemberId,
}: {
  action: (prevState: SlotFormState, formData: FormData) => Promise<SlotFormState>
  members: { id: string; full_name: string }[]
  currentMemberId: string | null
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  if (members.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">No members in this cluster yet.</p>
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        name="member_id"
        defaultValue={currentMemberId ?? ''}
        className="rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20 dark:bg-transparent"
      >
        <option value="" disabled>
          Unassigned
        </option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.full_name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-black/15 px-2 py-1 text-sm disabled:opacity-50 dark:border-white/20"
      >
        {pending ? 'Saving…' : 'Assign'}
      </button>
      {state.error && <span className="text-sm text-red-600 dark:text-red-400">{state.error}</span>}
    </form>
  )
}
