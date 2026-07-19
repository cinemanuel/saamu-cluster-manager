export type MemberInput = {
  full_name: string
  phone: string | null
  email: string | null
  residential_address: string | null
  business_name: string | null
  business_address: string | null
}

export function parseMemberFormData(
  formData: FormData
): { ok: true; values: MemberInput } | { ok: false; error: string } {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const residentialAddress = String(formData.get('residential_address') ?? '').trim()
  const businessName = String(formData.get('business_name') ?? '').trim()
  const businessAddress = String(formData.get('business_address') ?? '').trim()

  if (!fullName) {
    return { ok: false, error: 'Member name is required.' }
  }

  return {
    ok: true,
    values: {
      full_name: fullName,
      phone: phone || null,
      email: email || null,
      residential_address: residentialAddress || null,
      business_name: businessName || null,
      business_address: businessAddress || null,
    },
  }
}
