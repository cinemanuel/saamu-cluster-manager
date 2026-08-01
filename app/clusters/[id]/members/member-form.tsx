'use client'

import { useActionState } from 'react'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { buttonPrimary } from '../../../components/button-styles'
import type { MemberFormState } from './actions'

const initialState: MemberFormState = { error: null }
const PHOTO_BUCKET = 'member-photos'

export function MemberForm({
  action,
  memberId,
  defaultValues,
  currentPhotoUrl,
  kycTier,
  submitLabel,
}: {
  action: (prevState: MemberFormState, formData: FormData) => Promise<MemberFormState>
  memberId?: string
  defaultValues?: {
    full_name: string
    phone: string | null
    email: string | null
    residential_address: string | null
    business_name: string | null
    business_address: string | null
  }
  currentPhotoUrl?: string | null
  kycTier?: number
  submitLabel: string
}) {
  // Uploads the photo directly from the browser to Supabase Storage,
  // then strips the file out of formData before calling the Server
  // Action — only the resulting storage key crosses that boundary, so
  // a multi-MB phone photo never hits the Server Action body limit.
  const uploadThenSubmit = async (
    prevState: MemberFormState,
    formData: FormData
  ): Promise<MemberFormState> => {
    const photo = formData.get('photo')
    formData.delete('photo')

    if (photo instanceof File && photo.size > 0) {
      const photoKey = memberId ?? crypto.randomUUID()
      const supabase = createBrowserClient()
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(photoKey, photo, { contentType: photo.type, upsert: true })

      if (error) {
        return { error: error.message }
      }

      formData.set('photo_path', photoKey)
      if (!memberId) {
        formData.set('id', photoKey)
      }
    }

    return action(prevState, formData)
  }

  const [state, formAction, pending] = useActionState(uploadThenSubmit, initialState)

  return (
    <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      {kycTier !== undefined && (
        <p className="text-sm text-muted">
          KYC tier: <span className="font-medium text-ink">Tier {kycTier}</span>{' '}
          (calculated automatically from the fields below)
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="full_name" className="text-sm font-medium">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          defaultValue={defaultValues?.full_name}
          className="w-full rounded border border-border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="photo" className="text-sm font-medium">
          Photo
        </label>
        {currentPhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentPhotoUrl}
            alt=""
            className="h-16 w-16 rounded object-cover"
          />
        )}
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          className="w-full text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="phone" className="text-sm font-medium">
          WhatsApp number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          defaultValue={defaultValues?.phone ?? ''}
          className="w-full rounded border border-border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ''}
          className="w-full rounded border border-border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="residential_address" className="text-sm font-medium">
          Residential address
        </label>
        <input
          id="residential_address"
          name="residential_address"
          defaultValue={defaultValues?.residential_address ?? ''}
          className="w-full rounded border border-border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="business_name" className="text-sm font-medium">
          Business name
        </label>
        <input
          id="business_name"
          name="business_name"
          defaultValue={defaultValues?.business_name ?? ''}
          className="w-full rounded border border-border px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="business_address" className="text-sm font-medium">
          Business address
        </label>
        <input
          id="business_address"
          name="business_address"
          defaultValue={defaultValues?.business_address ?? ''}
          className="w-full rounded border border-border px-3 py-2"
        />
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <button type="submit" disabled={pending} className={`${buttonPrimary} w-full px-4 py-2`}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
