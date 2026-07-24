import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { ClusterForm } from '../../cluster-form'
import { updateCluster } from '../../actions'
import { SiteNav } from '../../../site-nav'

export default async function EditClusterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: cluster } = await supabase
    .from('clusters')
    .select('name, contribution_amount, fee_type, fee_value, frequency')
    .eq('id', id)
    .single()

  if (!cluster) {
    notFound()
  }

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-xl font-semibold">Edit cluster</h1>
        <ClusterForm
          action={updateCluster.bind(null, id)}
          defaultValues={cluster}
          submitLabel="Save changes"
        />
      </div>
    </>
  )
}
