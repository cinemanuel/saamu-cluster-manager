import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { SiteNav } from '../../../site-nav'

export default async function MembersPage({
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

  const { data: members } = await supabase
    .from('members')
    .select('id, full_name, phone, email')
    .eq('cluster_id', id)
    .order('created_at', { ascending: false })

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/clusters" className="text-sm underline">
          ← Back to clusters
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{cluster.name} — Members</h1>
          <Link
            href={`/clusters/${id}/members/new`}
            className="rounded bg-foreground px-4 py-2 text-sm text-background"
          >
            New member
          </Link>
        </div>

        {members && members.length > 0 ? (
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/15">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Phone</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-black/5 dark:border-white/10">
                  <td className="py-2">{member.full_name}</td>
                  <td className="py-2">{member.phone ?? '—'}</td>
                  <td className="py-2">{member.email ?? '—'}</td>
                  <td className="py-2 text-right">
                    <Link href={`/clusters/${id}/members/${member.id}/edit`} className="underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            No members yet. Add one to get started.
          </p>
        )}
      </div>
    </>
  )
}
