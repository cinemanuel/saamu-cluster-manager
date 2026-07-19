import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { MemberForm } from '../member-form'
import { createMember } from '../actions'
import { SiteNav } from '../../../../site-nav'

export default async function NewMemberPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: cluster } = await supabase
    .from('clusters')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!cluster) {
    notFound()
  }

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-xl font-semibold">New member — {cluster.name}</h1>
        <MemberForm action={createMember.bind(null, id)} submitLabel="Add member" />
      </div>
    </>
  )
}
