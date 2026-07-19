import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  await supabase.auth.signOut()

  // 303 forces the follow-up request to be a GET regardless of this
  // handler's POST method; the default 307 would preserve POST and hit
  // /login (a page, GET-only) with a 405.
  return NextResponse.redirect(new URL('/login', request.url), 303)
}
