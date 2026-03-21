import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/lib/supabase/types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

function makeSupabase(request: NextRequest, response: NextResponse): AnyClient {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}

// POST /api/workspace/accept-invite — accept an invite by token
export async function POST(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = makeSupabase(request, response)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { token } = body as { token: string }

  if (!token) return NextResponse.json({ error: "token is required" }, { status: 400 })

  const { data: invite, error: invErr } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("token", token)
    .single()

  if (invErr || !invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 })
  }

  if (invite.status !== "pending") {
    return NextResponse.json({ error: `Invite is already ${invite.status}` }, { status: 400 })
  }

  const now = new Date()
  const expiry = new Date(invite.expires_at)
  if (now > expiry) {
    await supabase
      .from("workspace_invites")
      .update({ status: "expired" })
      .eq("id", invite.id)
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 })
  }

  const { data: existing } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", invite.workspace_id)
    .eq("profile_id", user.id)
    .single()

  if (!existing) {
    const { error: memErr } = await supabase
      .from("workspace_members")
      .insert({
        workspace_id: invite.workspace_id,
        profile_id: user.id,
        role: "member",
      })

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 })
    }
  }

  await supabase
    .from("workspace_invites")
    .update({ status: "accepted" })
    .eq("id", invite.id)

  return NextResponse.json({ workspaceId: invite.workspace_id })
}
