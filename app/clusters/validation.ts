const FREQUENCIES = ['weekly', 'biweekly', 'monthly'] as const
const FEE_TYPES = ['fixed', 'percentage', 'none'] as const

export type ClusterInput = {
  name: string
  contribution_amount: number
  fee_type: (typeof FEE_TYPES)[number]
  fee_value: number | null
  frequency: (typeof FREQUENCIES)[number]
}

export function parseClusterFormData(
  formData: FormData
): { ok: true; values: ClusterInput } | { ok: false; error: string } {
  const name = String(formData.get('name') ?? '').trim()
  const frequency = String(formData.get('frequency') ?? '')
  const contributionAmount = Number(formData.get('contribution_amount'))
  const feeType = String(formData.get('fee_type') ?? '')
  const feeValueRaw = String(formData.get('fee_value') ?? '').trim()

  if (!name) {
    return { ok: false, error: 'Cluster name is required.' }
  }
  if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) {
    return { ok: false, error: 'Contribution amount must be a positive number.' }
  }
  if (!(FEE_TYPES as readonly string[]).includes(feeType)) {
    return { ok: false, error: 'Select a valid coordinator fee type.' }
  }
  if (!(FREQUENCIES as readonly string[]).includes(frequency)) {
    return { ok: false, error: 'Select a valid frequency.' }
  }

  let feeValue: number | null = null
  if (feeType !== 'none') {
    feeValue = Number(feeValueRaw)
    if (!Number.isFinite(feeValue) || feeValue <= 0) {
      return { ok: false, error: 'Coordinator fee value must be a positive number.' }
    }
    if (feeType === 'percentage' && feeValue > 100) {
      return { ok: false, error: 'A percentage fee cannot be more than 100.' }
    }
  }

  return {
    ok: true,
    values: {
      name,
      contribution_amount: contributionAmount,
      fee_type: feeType as ClusterInput['fee_type'],
      fee_value: feeValue,
      frequency: frequency as ClusterInput['frequency'],
    },
  }
}
