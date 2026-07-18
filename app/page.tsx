import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as {user?.email}
      </p>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="rounded border border-black/15 px-4 py-2 dark:border-white/20"
        >
          Sign out
        </button>
      </form>
    </div>
  )
}
