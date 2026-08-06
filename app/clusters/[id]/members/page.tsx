import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { SiteNav } from '../../../site-nav'
import { buttonPrimary, buttonTertiary } from '../../../components/button-styles'

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
    .select('id, full_name, phone, email, photo_path, kyc_tier')
    .eq('cluster_id', id)
    .order('created_at', { ascending: false })

  const photoPaths = (members ?? [])
    .map((member) => member.photo_path)
    .filter((path): path is string => Boolean(path))

  const photoUrlByPath = new Map<string, string>()
  if (photoPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from('member-photos')
      .createSignedUrls(photoPaths, 300)

    for (const entry of signedUrls ?? []) {
      if (entry.signedUrl && entry.path) {
        photoUrlByPath.set(entry.path, entry.signedUrl)
      }
    }
  }

  return (
    <>
      <SiteNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/clusters" className={`${buttonTertiary} text-sm`}>
          ← Back to clusters
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{cluster.name} — Members</h1>
          <Link href={`/clusters/${id}/members/new`} className={`${buttonPrimary} px-4 py-2 text-sm`}>
            New member
          </Link>
        </div>

        {members && members.length > 0 ? (
          <div className="relative mt-6">
          <div className="overflow-x-auto rounded-xl border border-border bg-surface p-2 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium text-muted">Photo</th>
                <th className="py-2 pr-4 font-medium text-muted">Name</th>
                <th className="py-2 pr-4 font-medium text-muted">Phone</th>
                <th className="py-2 pr-4 font-medium text-muted">Email</th>
                <th className="py-2 pr-4 font-medium text-muted">Tier</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const photoUrl = member.photo_path ? photoUrlByPath.get(member.photo_path) : undefined
                return (
                  <tr key={member.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-bg">
                    <td className="py-3 pr-4 align-middle">
                      {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <span className="block h-8 w-8 rounded bg-border" />
                      )}
                    </td>
                    <td className="py-3 pr-4 align-middle">{member.full_name}</td>
                    <td className="py-3 pr-4 align-middle">{member.phone ?? '—'}</td>
                    <td className="py-3 pr-4 align-middle">{member.email ?? '—'}</td>
                    <td className="py-3 pr-4 align-middle">Tier {member.kyc_tier}</td>
                    <td className="py-3 align-middle text-right">
                      <Link href={`/clusters/${id}/members/${member.id}/edit`} className={buttonTertiary}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-xl bg-gradient-to-l from-surface to-transparent sm:hidden"
          />
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted shadow-sm">
            No members yet. Add one to get started.
          </p>
        )}
      </div>
    </>
  )
}
