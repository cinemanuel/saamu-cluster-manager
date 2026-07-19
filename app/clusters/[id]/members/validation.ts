export type MemberInput = {
  full_name: string
  phone: string | null
  email: string | null
}

export function parseMemberFormData(
  formData: FormData
): { ok: true; values: MemberInput } | { ok: false; error: string } {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()

  if (!fullName) {
    return { ok: false, error: 'Member name is required.' }
  }

  return {
    ok: true,
    values: {
      full_name: fullName,
      phone: phone || null,
      email: email || null,
    },
  }
}
