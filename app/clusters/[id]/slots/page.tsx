import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { SiteNav } from '../../../site-nav'
import { SlotForm } from './slot-form'
import { AssignMemberForm } from './assign-member-form'
import { createSlot, assignMembers } from './actions'

export default async function SlotsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: cluster } = await supabase
    .from('clusters')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!cluster) {
    notFound()
  }

  const { data: slots } = await supabase
    .from('slots')
    .select('id, position, label, is_shared')
    .eq('cluster_id', id)
    .order('position', { ascending: true })

  const { data: members } = await supabase
    .from('members')
    .select('id, full_name')
    .eq('cluster_id', id)
    .order('full_name', { ascending: true })

  const slotIds = (slots ?? []).map((slot) => slot.id)

  const { data: assignments } =
    slotIds.length > 0
      ? await supabase.from('slot_members').select('slot_id, member_id').in('slot_id', slotIds)
      : { data: [] }

  // Look up member names from the members list already fetched above,
  // rather than an embedded `members(full_name)` join on slot_members.
  // If that embed ever fails to resolve for any reason, this silently
  // treats a real, intact assignment as unassigned — which is exactly
  // indistinguishable from actual data loss from the UI's perspective.
  const fullNameByMemberId = new Map((members ?? []).map((member) => [member.id, member.full_name]))

  const assignmentsBySlotId = new Map<string, { member_id: string; full_name: string }[]>()
  for (const assignment of assignments ?? []) {
    const fullName = fullNameByMemberId.get(assignment.member_id)
    if (fullName) {
      const existing = assignmentsBySlotId.get(assignment.slot_id) ?? []
      existing.push({ member_id: assignment.member_id, full_name: fullName })
      assignmentsBySlotId.set(assignment.slot_id, existing)
    }
  }

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href={`/clusters/${id}/members`} className="text-sm underline">
          ← Back to {cluster.name}
        </Link>

        <h1 className="mt-4 text-xl font-semibold">{cluster.name} — Rotation positions</h1>

        <SlotForm action={createSlot.bind(null, id)} />

        {slots && slots.length > 0 ? (
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Position</th>
                <th className="py-2 font-medium">Label</th>
                <th className="py-2 font-medium">Assigned member(s)</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const assignment = assignmentsBySlotId.get(slot.id) ?? []
                return (
                  <tr key={slot.id} className="border-b border-border">
                    <td className="py-2 align-top">
                      {slot.position}
                      {slot.position <= 2 && (
                        <span className="ml-2 rounded bg-border px-1.5 py-0.5 text-xs text-muted">
                          Requires Tier 3
                        </span>
                      )}
                      {slot.is_shared && (
                        <span className="ml-2 rounded bg-border px-1.5 py-0.5 text-xs text-muted">
                          Shared
                        </span>
                      )}
                    </td>
                    <td className="py-2 align-top">{slot.label ?? '—'}</td>
                    <td className="py-2">
                      <AssignMemberForm
                        action={assignMembers.bind(null, id, slot.id)}
                        members={members ?? []}
                        currentMemberIds={assignment.map((entry) => entry.member_id)}
                        isShared={slot.is_shared}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="mt-6 text-sm text-muted">
            No rotation positions yet. Add one above.
          </p>
        )}
      </div>
    </>
  )
}
