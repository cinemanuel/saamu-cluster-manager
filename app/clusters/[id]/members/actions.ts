'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { parseMemberFormData } from './validation'

export type MemberFormState = { error: string | null }

const PHOTO_BUCKET = 'member-photos'

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

  const memberId = crypto.randomUUID()
  const photo = formData.get('photo')
  let photoPath: string | null = null

  if (photo instanceof File && photo.size > 0) {
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(memberId, photo, { contentType: photo.type, upsert: true })

    if (uploadError) {
      return { error: uploadError.message }
    }
    photoPath = memberId
  }

  const { error } = await supabase
    .from('members')
    .insert({ id: memberId, cluster_id: clusterId, photo_path: photoPath, ...parsed.values })

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

  const photo = formData.get('photo')
  const updates: typeof parsed.values & { photo_path?: string } = { ...parsed.values }

  if (photo instanceof File && photo.size > 0) {
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(memberId, photo, { contentType: photo.type, upsert: true })

    if (uploadError) {
      return { error: uploadError.message }
    }
    updates.photo_path = memberId
  }

  const { error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', memberId)
    .eq('cluster_id', clusterId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clusters/${clusterId}/members`)
  redirect(`/clusters/${clusterId}/members`)
}
