'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { parseMemberFormData } from './validation'

export type MemberFormState = { error: string | null }

// The photo itself is uploaded directly from the browser to Supabase
// Storage (see member-form.tsx) — never through this Server Action.
// Server Action request bodies are capped (1MB by default, and Vercel's
// own serverless functions cap at ~4.5MB regardless of Next.js config),
// which a real phone photo blows past easily. Only the resulting
// storage key (`photo_path`) crosses this boundary.

export async function createMember(
  clusterId: string,
  _prevState: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const parsed = parseMemberFormData(formData)
  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const id = formData.get('id')
  const photoPath = formData.get('photo_path')

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase.from('members').insert({
    ...(typeof id === 'string' && id ? { id } : {}),
    cluster_id: clusterId,
    photo_path: typeof photoPath === 'string' && photoPath ? photoPath : null,
    ...parsed.values,
  })

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

  const photoPath = formData.get('photo_path')
  const updates: typeof parsed.values & { photo_path?: string } = { ...parsed.values }
  if (typeof photoPath === 'string' && photoPath) {
    updates.photo_path = photoPath
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
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
