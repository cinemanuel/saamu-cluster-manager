'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { parseMarkPaidFormData, parseNotesFormData } from './validation'

export type PaymentFormState = { error: string | null }

async function getScopedPaymentClient(clusterId: string, cycleId: string, paymentId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: cycle } = await supabase
    .from('cycles')
    .select('id')
    .eq('id', cycleId)
    .eq('cluster_id', clusterId)
    .single()

  if (!cycle) {
    return { supabase, error: 'That cycle does not belong to this cluster.' }
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('id')
    .eq('id', paymentId)
    .eq('cycle_id', cycleId)
    .single()

  if (!payment) {
    return { supabase, error: 'That payment does not belong to this cycle.' }
  }

  return { supabase, error: null as string | null }
}

export async function markPaid(
  clusterId: string,
  cycleId: string,
  paymentId: string,
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const parsed = parseMarkPaidFormData(formData)
  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const { supabase, error: scopeError } = await getScopedPaymentClient(clusterId, cycleId, paymentId)
  if (scopeError) {
    return { error: scopeError }
  }

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString().slice(0, 10),
      payment_method: parsed.values.payment_method,
      notes: parsed.values.notes,
    })
    .eq('id', paymentId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clusters/${clusterId}/cycles/${cycleId}/payments`)
  return { error: null }
}

export async function waivePayment(
  clusterId: string,
  cycleId: string,
  paymentId: string,
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const notes = parseNotesFormData(formData)

  const { supabase, error: scopeError } = await getScopedPaymentClient(clusterId, cycleId, paymentId)
  if (scopeError) {
    return { error: scopeError }
  }

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'waived',
      paid_at: null,
      payment_method: null,
      notes,
    })
    .eq('id', paymentId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clusters/${clusterId}/cycles/${cycleId}/payments`)
  return { error: null }
}

export async function revertToPending(
  clusterId: string,
  cycleId: string,
  paymentId: string,
  // Required by useActionState's (prevState, formData) action signature,
  // even though a revert takes no form input of its own.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: PaymentFormState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData
): Promise<PaymentFormState> {
  const { supabase, error: scopeError } = await getScopedPaymentClient(clusterId, cycleId, paymentId)
  if (scopeError) {
    return { error: scopeError }
  }

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'pending',
      paid_at: null,
      payment_method: null,
    })
    .eq('id', paymentId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/clusters/${clusterId}/cycles/${cycleId}/payments`)
  return { error: null }
}
