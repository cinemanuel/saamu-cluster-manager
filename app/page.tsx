import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { SiteNav } from './site-nav'
import { buttonPrimary } from './components/button-styles'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <>
      <SiteNav />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted">
          Signed in as {user?.email}
        </p>
        <Link href="/clusters" className={`${buttonPrimary} px-4 py-2`}>
          Manage clusters
        </Link>
      </div>
    </>
  )
}
