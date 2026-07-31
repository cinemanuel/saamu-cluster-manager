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
        <Link href="/clusters" className="text-sm underline">
          ← Back to clusters
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{cluster.name} — Members</h1>
          <Link
            href={`/clusters/${id}/members/new`}
            className="rounded bg-primary px-4 py-2 text-sm text-white"
          >
            New member
          </Link>
        </div>

        {members && members.length > 0 ? (
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Photo</th>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Phone</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Tier</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const photoUrl = member.photo_path ? photoUrlByPath.get(member.photo_path) : undefined
                return (
                  <tr key={member.id} className="border-b border-border">
                    <td className="py-2">
                      {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photoUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <span className="block h-8 w-8 rounded bg-border" />
                      )}
                    </td>
                    <td className="py-2">{member.full_name}</td>
                    <td className="py-2">{member.phone ?? '—'}</td>
                    <td className="py-2">{member.email ?? '—'}</td>
                    <td className="py-2">Tier {member.kyc_tier}</td>
                    <td className="py-2 text-right">
                      <Link href={`/clusters/${id}/members/${member.id}/edit`} className="underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="mt-6 text-sm text-muted">
            No members yet. Add one to get started.
          </p>
        )}
      </div>
    </>
  )
}
