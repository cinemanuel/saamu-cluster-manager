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

export async function assignMember(
  clusterId: string,
  slotId: string,
  _prevState: SlotFormState,
  formData: FormData
): Promise<SlotFormState> {
  const memberId = String(formData.get('member_id') ?? '').trim()

  if (!memberId) {
    return { error: 'Choose a member to assign.' }
  }

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

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('id', memberId)
    .eq('cluster_id', clusterId)
    .single()

  if (!member) {
    return { error: 'That member does not belong to this cluster.' }
  }

  const { error: deleteError } = await supabase
    .from('slot_members')
    .delete()
    .eq('slot_id', slotId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  const { error: insertError } = await supabase
    .from('slot_members')
    .insert({ slot_id: slotId, member_id: memberId })

  if (insertError) {
    return { error: insertError.message }
  }

  revalidatePath(`/clusters/${clusterId}/slots`)
  redirect(`/clusters/${clusterId}/slots`)
}
