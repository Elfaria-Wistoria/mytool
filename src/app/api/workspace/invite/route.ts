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

// POST /api/workspace/invite — create an invite for a workspace
export async function POST(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = makeSupabase(request, response)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { workspaceId, email } = body as { workspaceId: string; email?: string }

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 })
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("profile_id", user.id)
    .single()

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: invite, error: invErr } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email: email?.toLowerCase() || null,
      invited_by: user.id,
    })
    .select()
    .single()

  if (invErr || !invite) {
    return NextResponse.json({ error: invErr?.message ?? "Failed to create invite" }, { status: 500 })
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const inviteLink = `${origin}/team/accept?token=${invite.token}`

  return NextResponse.json({ invite, inviteLink }, { status: 201 })
}

// DELETE /api/workspace/invite?inviteId=xxx — revoke an invite
export async function DELETE(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = makeSupabase(request, response)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const inviteId = request.nextUrl.searchParams.get("inviteId")
  if (!inviteId) return NextResponse.json({ error: "inviteId required" }, { status: 400 })

  const { error } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
