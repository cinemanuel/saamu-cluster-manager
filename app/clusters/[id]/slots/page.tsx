import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { SiteNav } from '../../../site-nav'
import { SlotForm } from './slot-form'
import { AssignMemberForm } from './assign-member-form'
import { createSlot, assignMember } from './actions'

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
    .select('id, position, label')
    .eq('cluster_id', id)
    .order('position', { ascending: true })

  const { data: members } = await supabase
    .from('members')
    .select('id, full_name')
    .eq('cluster_id', id)
    .order('full_name', { ascending: true })

  const { data: assignments } = await supabase
    .from('slot_members')
    .select('slot_id, member_id, members(full_name)')
    .in('slot_id', (slots ?? []).map((slot) => slot.id))

  const assignmentBySlotId = new Map<string, { member_id: string; full_name: string }>()
  for (const assignment of assignments ?? []) {
    const member = Array.isArray(assignment.members) ? assignment.members[0] : assignment.members
    if (member) {
      assignmentBySlotId.set(assignment.slot_id, {
        member_id: assignment.member_id,
        full_name: member.full_name,
      })
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
              <tr className="border-b border-black/10 dark:border-white/15">
                <th className="py-2 font-medium">Position</th>
                <th className="py-2 font-medium">Label</th>
                <th className="py-2 font-medium">Assigned member</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const assignment = assignmentBySlotId.get(slot.id)
                return (
                  <tr key={slot.id} className="border-b border-black/5 dark:border-white/10">
                    <td className="py-2">{slot.position}</td>
                    <td className="py-2">{slot.label ?? '—'}</td>
                    <td className="py-2">
                      <AssignMemberForm
                        action={assignMember.bind(null, id, slot.id)}
                        members={members ?? []}
                        currentMemberId={assignment?.member_id ?? null}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            No rotation positions yet. Add one above.
          </p>
        )}
      </div>
    </>
  )
}
