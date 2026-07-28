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
  revalidatePath('/dashboard')
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

  const { data, error } = await supabase.rpc('advance_cycle', {
    p_cluster_id: clusterId,
    p_current_cycle_id: currentCycleId,
    p_next_start_date: parseOptionalDate(formData),
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clusters/${clusterId}/cycles`)
  revalidatePath('/dashboard')

  // advance_cycle now returns a warning (e.g. "payout not recorded") on
  // the very cycle that's about to stop being the active one, so the
  // form showing it is about to unmount — a query param survives the
  // redirect, in-memory action state wouldn't.
  const query = data ? `?warning=${encodeURIComponent(data)}` : ''
  redirect(`/clusters/${clusterId}/cycles${query}`)
}
