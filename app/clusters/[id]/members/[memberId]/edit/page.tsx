import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { MemberForm } from '../../member-form'
import { updateMember } from '../../actions'
import { SiteNav } from '../../../../../site-nav'

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>
}) {
  const { id, memberId } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: member } = await supabase
    .from('members')
    .select('full_name, phone, email')
    .eq('id', memberId)
    .eq('cluster_id', id)
    .single()

  if (!member) {
    notFound()
  }

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-xl font-semibold">Edit member</h1>
        <MemberForm
          action={updateMember.bind(null, id, memberId)}
          defaultValues={member}
          submitLabel="Save changes"
        />
      </div>
    </>
  )
}
