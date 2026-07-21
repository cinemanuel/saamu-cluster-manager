'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { parseSlotFormData } from './validation'

export type SlotFormState = { error: string | null }

const UNIQUE_VIOLATION = '23505'

export async function createSlot(
  clusterId: string,
  _prevState: SlotFormState,
  formData: FormData
): Promise<SlotFormState> {
  const parsed = parseSlotFormData(formData)
  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase
    .from('slots')
    .insert({ cluster_id: clusterId, ...parsed.values })

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: `Position ${parsed.values.position} already exists in this cluster.` }
    }
    return { error: error.message }
  }

  revalidatePath(`/clusters/${clusterId}/slots`)
  redirect(`/clusters/${clusterId}/slots`)
}

export async function assignMembers(
  clusterId: string,
  slotId: string,
  _prevState: SlotFormState,
  formData: FormData
): Promise<SlotFormState> {
  const memberIds = formData.getAll('member_ids').map(String).filter(Boolean)

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: slot } = await supabase
    .from('slots')
    .select('id')
    .eq('id', slotId)
    .eq('cluster_id', clusterId)
    .single()

  if (!slot) {
    return { error: 'That position does not belong to this cluster.' }
  }

  if (memberIds.length > 0) {
    const { data: validMembers } = await supabase
      .from('members')
      .select('id')
      .eq('cluster_id', clusterId)
      .in('id', memberIds)

    if (!validMembers || validMembers.length !== memberIds.length) {
      return { error: 'One or more selected members do not belong to this cluster.' }
    }
  }

  // Delete-then-insert as one atomic transaction via RPC — doing these
  // as separate PostgREST calls let a rejected reassignment (the
  // protected-head trigger raising on any inserted row) leave the slot
  // cleared, since the delete had already committed on its own.
  const { error: reassignError } = await supabase.rpc('set_slot_members', {
    p_slot_id: slotId,
    p_member_ids: memberIds,
  })

  if (reassignError) {
    return { error: reassignError.message }
  }

  revalidatePath(`/clusters/${clusterId}/slots`)
  redirect(`/clusters/${clusterId}/slots`)
}
