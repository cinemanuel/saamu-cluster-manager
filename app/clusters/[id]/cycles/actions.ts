'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type CycleFormState = { error: string | null }

function parseOptionalDate(formData: FormData): string | null {
  const value = String(formData.get('start_date') ?? '').trim()
  return value || null
}

export async function startFirstCycle(
  clusterId: string,
  _prevState: CycleFormState,
  formData: FormData
): Promise<CycleFormState> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase.rpc('start_first_cycle', {
    p_cluster_id: clusterId,
    p_start_date: parseOptionalDate(formData),
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clusters/${clusterId}/cycles`)
  redirect(`/clusters/${clusterId}/cycles`)
}

export async function advanceCycle(
  clusterId: string,
  currentCycleId: string,
  _prevState: CycleFormState,
  formData: FormData
): Promise<CycleFormState> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase.rpc('advance_cycle', {
    p_cluster_id: clusterId,
    p_current_cycle_id: currentCycleId,
    p_next_start_date: parseOptionalDate(formData),
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clusters/${clusterId}/cycles`)
  redirect(`/clusters/${clusterId}/cycles`)
}
