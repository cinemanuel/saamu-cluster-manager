'use client'

import { useActionState } from 'react'
import type { SlotFormState } from './actions'

const initialState: SlotFormState = { error: null }

export function AssignMemberForm({
  action,
  members,
  currentMemberIds,
  isShared,
}: {
  action: (prevState: SlotFormState, formData: FormData) => Promise<SlotFormState>
  members: { id: string; full_name: string }[]
  currentMemberIds: string[]
  isShared: boolean
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  if (members.length === 0) {
    return <p className="text-sm text-muted">No members in this cluster yet.</p>
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {isShared ? (
        <div className="flex flex-col gap-1">
          {members.map((member) => (
            <label key={member.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="member_ids"
                value={member.id}
                defaultChecked={currentMemberIds.includes(member.id)}
              />
              {member.full_name}
            </label>
          ))}
        </div>
      ) : (
        <select
          name="member_ids"
          defaultValue={currentMemberIds[0] ?? ''}
          className="rounded border border-border px-2 py-1 text-sm"
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
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-border px-2 py-1 text-sm disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Assign'}
        </button>
        {state.error && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  )
}
