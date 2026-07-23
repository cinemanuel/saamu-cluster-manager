const PAYMENT_METHODS = ['cash', 'bank_transfer', 'mobile_money'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export type MarkPaidInput = {
  payment_method: PaymentMethod
  notes: string | null
}

export function parseMarkPaidFormData(
  formData: FormData
): { ok: true; values: MarkPaidInput } | { ok: false; error: string } {
  const paymentMethod = String(formData.get('payment_method') ?? '')
  const notes = String(formData.get('notes') ?? '').trim()

  if (!PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)) {
    return { ok: false, error: 'Select a valid payment method.' }
  }

  return {
    ok: true,
    values: {
      payment_method: paymentMethod as PaymentMethod,
      notes: notes || null,
    },
  }
}

export function parseNotesFormData(formData: FormData): string | null {
  const notes = String(formData.get('notes') ?? '').trim()
  return notes || null
}
