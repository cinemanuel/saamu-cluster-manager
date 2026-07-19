'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { parseMemberFormData } from './validation'

export type MemberFormState = { error: string | null }

export async function createMember(
  clusterId: string,
  _prevState: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const parsed = parseMemberFormData(formData)
  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase
    .from('members')
    .insert({ cluster_id: clusterId, ...parsed.values })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clusters/${clusterId}/members`)
  redirect(`/clusters/${clusterId}/members`)
}

export async function updateMember(
  clusterId: string,
  memberId: string,
  _prevState: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const parsed = parseMemberFormData(formData)
  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase
    .from('members')
    .update(parsed.values)
    .eq('id', memberId)
    .eq('cluster_id', clusterId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clusters/${clusterId}/members`)
  redirect(`/clusters/${clusterId}/members`)
}
