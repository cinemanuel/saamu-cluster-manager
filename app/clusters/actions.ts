'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { parseClusterFormData } from './validation'

export type ClusterFormState = { error: string | null }

export async function createCluster(
  _prevState: ClusterFormState,
  formData: FormData
): Promise<ClusterFormState> {
  const parsed = parseClusterFormData(formData)
  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase.from('clusters').insert(parsed.values)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clusters')
  redirect('/clusters')
}

export async function updateCluster(
  id: string,
  _prevState: ClusterFormState,
  formData: FormData
): Promise<ClusterFormState> {
  const parsed = parseClusterFormData(formData)
  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase
    .from('clusters')
    .update(parsed.values)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clusters')
  redirect('/clusters')
}
