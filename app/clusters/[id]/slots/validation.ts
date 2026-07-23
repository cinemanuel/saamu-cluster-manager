export type SlotInput = {
  position: number
  label: string | null
  is_shared: boolean
}

export function parseSlotFormData(
  formData: FormData
): { ok: true; values: SlotInput } | { ok: false; error: string } {
  const position = Number(formData.get('position'))
  const label = String(formData.get('label') ?? '').trim()
  const isShared = formData.get('is_shared') === 'on'

  if (!Number.isInteger(position) || position <= 0) {
    return { ok: false, error: 'Position must be a positive whole number.' }
  }

  return {
    ok: true,
    values: {
      position,
      label: label || null,
      is_shared: isShared,
    },
  }
}
