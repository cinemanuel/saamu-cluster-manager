const FREQUENCIES = ['weekly', 'biweekly', 'monthly'] as const

export type ClusterInput = {
  name: string
  contribution_amount: number
  fee_amount: number
  frequency: (typeof FREQUENCIES)[number]
}

export function parseClusterFormData(
  formData: FormData
): { ok: true; values: ClusterInput } | { ok: false; error: string } {
  const name = String(formData.get('name') ?? '').trim()
  const frequency = String(formData.get('frequency') ?? '')
  const contributionAmount = Number(formData.get('contribution_amount'))
  const feeAmount = Number(formData.get('fee_amount'))

  if (!name) {
    return { ok: false, error: 'Cluster name is required.' }
  }
  if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) {
    return { ok: false, error: 'Contribution amount must be a positive number.' }
  }
  if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
    return { ok: false, error: 'Fee amount must be a positive number.' }
  }
  if (!(FREQUENCIES as readonly string[]).includes(frequency)) {
    return { ok: false, error: 'Select a valid frequency.' }
  }

  return {
    ok: true,
    values: {
      name,
      contribution_amount: contributionAmount,
      fee_amount: feeAmount,
      frequency: frequency as ClusterInput['frequency'],
    },
  }
}
